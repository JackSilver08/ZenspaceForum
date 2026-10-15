package httpapi

import (
    "context"
    "database/sql"
    "errors"
    "strings"
    "time"
    "unicode/utf8"

    "github.com/gin-gonic/gin"
    mysql "github.com/go-sql-driver/mysql"
)

func validCommentContent(content string) bool {
    n := utf8.RuneCountInString(strings.TrimSpace(content))
    return n > 0 && n <= 10000
}

func (a *App) listComments(c *gin.Context) {
    postID,ok := intParam(c,"id"); if !ok { return }
    if !a.requireView(c,postID) { return }
    viewer := a.viewer(c)
    rows,err := a.DB.QueryContext(c.Request.Context(),`
        SELECT b.id,b.idBaiDang,b.idTaiKhoan,b.noiDung,b.ngayBinhLuan,
            t.tenDangNhap,COALESCE(t.avatar,''),b.parent_id,b.edited_at,
            (SELECT COUNT(*) FROM comment_likes likes WHERE likes.comment_id=b.id),
            EXISTS(SELECT 1 FROM comment_likes likes WHERE likes.comment_id=b.id AND likes.user_id=?)
        FROM binhluan b JOIN TaiKhoan t ON t.id=b.idTaiKhoan
        WHERE b.idBaiDang=? ORDER BY b.ngayBinhLuan ASC,b.id ASC`,viewer,postID)
    if err != nil { fail(c,500,"Không tải được bình luận");return }
    defer rows.Close()
    result := make([]gin.H,0)
    for rows.Next() {
        var id,pid,owner,likes int
        var content,name,avatar string
        var created time.Time
        var parent sql.NullInt64
        var edited sql.NullTime
        var liked bool
        if err := rows.Scan(&id,&pid,&owner,&content,&created,&name,&avatar,&parent,&edited,&likes,&liked);err != nil {
            fail(c,500,"Không đọc được bình luận");return
        }
        var parentValue,editedValue interface{}
        if parent.Valid { parentValue=parent.Int64 }
        if edited.Valid { editedValue=edited.Time.Format(time.RFC3339Nano) }
        result=append(result,gin.H{
            "id":id,"idBaiDang":pid,"idTaiKhoan":owner,"noiDung":content,
            "tenDangNhap":name,"avatar":avatar,"ngayBinhLuan":created.Format(time.RFC3339),
            "parentId":parentValue,"editedAt":editedValue,"likeCount":likes,"likedByMe":liked,
        })
    }
    if err:=rows.Err();err != nil { fail(c,500,"Không đọc được bình luận");return }
    c.JSON(200,result) // Preserve the legacy array response.
}

func (a *App) addComment(c *gin.Context) {
    var body map[string]interface{}
    if err:=c.ShouldBindJSON(&body);err!=nil { fail(c,400,"JSON không hợp lệ");return }
    content:=strings.TrimSpace(textVal(body,"noiDung"))
    if !validCommentContent(content) { fail(c,400,"Bình luận phải có từ 1 đến 10.000 ký tự");return }
    postID,ok:=parsePositiveID(body["idBaiDang"])
    if !ok { postID,ok=parsePositiveID(body["postId"]) }
    if !ok { fail(c,400,"ID bài viết phải là số nguyên dương");return }
    if !a.requireView(c,postID) { return }
    var author int
    var enabled bool
    err:=a.DB.QueryRowContext(c.Request.Context(),
        "SELECT idTaiKhoan,commentsEnabled FROM BaiDang WHERE id=?",postID).Scan(&author,&enabled)
    if errors.Is(err,sql.ErrNoRows) { fail(c,404,"Bài viết không tồn tại");return }
    if err!=nil { fail(c,500,"Không kiểm tra được bài viết");return }
    if !enabled { fail(c,403,"Bài viết đã tắt bình luận");return }
    blocked,err:=a.blockedBetween(c.Request.Context(),userID(c),author)
    if err!=nil { fail(c,500,"Không kiểm tra được quyền bình luận");return }
    if blocked { fail(c,403,"Không thể bình luận do trạng thái chặn");return }

    var parentValue interface{}
    if raw,exists:=body["parentId"];exists && raw!=nil {
        parentID,valid:=parsePositiveID(raw)
        if !valid { fail(c,400,"Bình luận được trả lời không hợp lệ");return }
        var parentPost,parentAuthor int
        var root sql.NullInt64
        err:=a.DB.QueryRowContext(c.Request.Context(),
            "SELECT idBaiDang,idTaiKhoan,parent_id FROM binhluan WHERE id=?",parentID).
            Scan(&parentPost,&parentAuthor,&root)
        if errors.Is(err,sql.ErrNoRows) || parentPost!=postID { fail(c,404,"Không tìm thấy bình luận cần trả lời");return }
        if err!=nil { fail(c,500,"Không kiểm tra được bình luận cần trả lời");return }
        blocked,err=a.blockedBetween(c.Request.Context(),userID(c),parentAuthor)
        if err!=nil { fail(c,500,"Không kiểm tra được quyền trả lời");return }
        if blocked { fail(c,403,"Không thể trả lời tài khoản đã chặn");return }
        if root.Valid { parentID=int(root.Int64) }
        parentValue=parentID
    }

    // Recheck moderation settings and block state inside the INSERT itself.
    query:=`INSERT INTO binhluan(idBaiDang,idTaiKhoan,noiDung,parent_id)
        SELECT b.id,?,?,? FROM BaiDang b
        WHERE b.id=? AND b.commentsEnabled=1
        AND NOT EXISTS(SELECT 1 FROM user_blocks bl WHERE
          (bl.blocker_id=? AND bl.blocked_id=b.idTaiKhoan)
          OR (bl.blocked_id=? AND bl.blocker_id=b.idTaiKhoan))`
    args:=[]interface{}{userID(c),content,parentValue,postID,userID(c),userID(c)}
    if parentValue!=nil {
        query+=` AND EXISTS(SELECT 1 FROM binhluan p WHERE p.id=? AND p.idBaiDang=b.id AND p.parent_id IS NULL
          AND NOT EXISTS(SELECT 1 FROM user_blocks bl WHERE
            (bl.blocker_id=? AND bl.blocked_id=p.idTaiKhoan)
            OR (bl.blocked_id=? AND bl.blocker_id=p.idTaiKhoan)))`
        args=append(args,parentValue,userID(c),userID(c))
    }
    res,err:=a.DB.ExecContext(c.Request.Context(),query,args...)
    if err!=nil {
        var myErr *mysql.MySQLError
        if errors.As(err,&myErr) && myErr.Number==1452 { fail(c,404,"Bài viết hoặc bình luận vừa bị xóa");return }
        fail(c,500,"Không lưu được bình luận");return
    }
    n,_:=res.RowsAffected()
    if n==0 { fail(c,403,"Không thể đăng bình luận hoặc trả lời vào lúc này");return }
    id,_:=res.LastInsertId()
    c.JSON(201,gin.H{"success":true,"message":"Bình luận thành công","id":id})
}

func (a *App) commentTarget(ctx context.Context,id int)(postID,authorID int,err error) {
    err=a.DB.QueryRowContext(ctx,
        "SELECT idBaiDang,idTaiKhoan FROM binhluan WHERE id=?",id).Scan(&postID,&authorID)
    return
}

func (a *App) updateComment(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    var body struct{ Content string `json:"noiDung"` }
    if err:=c.ShouldBindJSON(&body);err!=nil { fail(c,400,"JSON không hợp lệ");return }
    content:=strings.TrimSpace(body.Content)
    if !validCommentContent(content) { fail(c,400,"Bình luận phải có từ 1 đến 10.000 ký tự");return }
    postID,author,err:=a.commentTarget(c.Request.Context(),id)
    if errors.Is(err,sql.ErrNoRows) { fail(c,404,"Không tìm thấy bình luận");return }
    if err!=nil { fail(c,500,"Không kiểm tra được bình luận");return }
    if author!=userID(c) { fail(c,403,"Chỉ tác giả được sửa bình luận");return }
    if !a.requireView(c,postID) { return }
    res,err:=a.DB.ExecContext(c.Request.Context(),
        "UPDATE binhluan SET noiDung=?,edited_at=NOW(6) WHERE id=? AND idTaiKhoan=?",
        content,id,userID(c))
    if err!=nil { fail(c,500,"Không sửa được bình luận");return }
    n,_:=res.RowsAffected();if n==0 { fail(c,404,"Bình luận vừa bị xóa");return }
    c.JSON(200,gin.H{"success":true,"noiDung":content,"message":"Đã sửa bình luận"})
}

func (a *App) likeComment(c *gin.Context) { a.changeCommentLike(c,true) }
func (a *App) unlikeComment(c *gin.Context) { a.changeCommentLike(c,false) }
func (a *App) changeCommentLike(c *gin.Context,enabled bool) {
    id,ok:=intParam(c,"id");if !ok{return}
    postID,author,err:=a.commentTarget(c.Request.Context(),id)
    if errors.Is(err,sql.ErrNoRows) { fail(c,404,"Không tìm thấy bình luận");return }
    if err!=nil { fail(c,500,"Không kiểm tra được bình luận");return }
    if !a.requireView(c,postID) { return }
    blocked,err:=a.blockedBetween(c.Request.Context(),userID(c),author)
    if err!=nil { fail(c,500,"Không kiểm tra được quyền tương tác");return }
    if blocked { fail(c,403,"Không thể thích bình luận của tài khoản đã chặn");return }
    if enabled {
        _,err=a.DB.ExecContext(c.Request.Context(),
            "INSERT IGNORE INTO comment_likes(comment_id,user_id) VALUES(?,?)",id,userID(c))
    } else {
        _,err=a.DB.ExecContext(c.Request.Context(),
            "DELETE FROM comment_likes WHERE comment_id=? AND user_id=?",id,userID(c))
    }
    if err!=nil { fail(c,500,"Không cập nhật được lượt thích");return }
    var count int
    if err:=a.DB.QueryRowContext(c.Request.Context(),
        "SELECT COUNT(*) FROM comment_likes WHERE comment_id=?",id).Scan(&count);err!=nil {
        fail(c,500,"Không đọc được lượt thích");return
    }
    c.JSON(200,gin.H{"success":true,"likedByMe":enabled,"likeCount":count})
}

func (a *App) deleteComment(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    var owner,postOwner int
    err:=a.DB.QueryRowContext(c.Request.Context(),
        "SELECT b.idTaiKhoan,p.idTaiKhoan FROM binhluan b JOIN BaiDang p ON p.id=b.idBaiDang WHERE b.id=?",id).
        Scan(&owner,&postOwner)
    if errors.Is(err,sql.ErrNoRows) { fail(c,404,"Bình luận không tồn tại");return }
    if err!=nil { fail(c,500,"Lỗi truy vấn");return }
    if owner!=userID(c)&&postOwner!=userID(c)&&!isAdmin(c) { fail(c,403,"Không có quyền xóa");return }
    _,err=a.DB.ExecContext(c.Request.Context(),"DELETE FROM binhluan WHERE id=?",id)
    if err!=nil { fail(c,500,"Không xóa được");return }
    c.JSON(200,gin.H{"success":true,"message":"Đã xóa bình luận"})
}

func (a *App) setCommentsEnabled(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    if !a.requireActiveOwner(c,id) { return }
    var body struct { Enabled *bool `json:"enabled"` }
    if err:=c.ShouldBindJSON(&body);err!=nil||body.Enabled==nil {
        fail(c,400,"Thiếu trạng thái bật/tắt bình luận");return
    }
    result,err:=a.DB.ExecContext(c.Request.Context(),
        "UPDATE BaiDang SET commentsEnabled=? WHERE id=? AND idTaiKhoan=?",*body.Enabled,id,userID(c))
    if err!=nil { fail(c,500,"Không cập nhật được bình luận");return }
    count,_:=result.RowsAffected()
    if count==0 {
        var owner int
        err=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan FROM BaiDang WHERE id=?",id).Scan(&owner)
        if errors.Is(err,sql.ErrNoRows) { fail(c,404,"Không tìm thấy bài viết");return }
        if err!=nil { fail(c,500,"Lỗi kiểm tra bài viết");return }
        if owner!=userID(c) { fail(c,403,"Chỉ tác giả được quản lý bình luận");return }
    }
    c.JSON(200,gin.H{"success":true,"commentsEnabled":*body.Enabled})
}
