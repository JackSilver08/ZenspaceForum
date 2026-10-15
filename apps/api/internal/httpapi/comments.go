package httpapi

import (
    "database/sql"
    "errors"
    mysql "github.com/go-sql-driver/mysql"
    "strings"
    "time"
    "github.com/gin-gonic/gin"
)
func (a *App) listComments(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    if !a.requireView(c,id){return}
    rows,err:=a.DB.QueryContext(c.Request.Context(),
        "SELECT b.id,b.idBaiDang,b.idTaiKhoan,b.noiDung,b.ngayBinhLuan,t.tenDangNhap,COALESCE(t.avatar,'') FROM binhluan b JOIN TaiKhoan t ON t.id=b.idTaiKhoan WHERE b.idBaiDang=? ORDER BY b.ngayBinhLuan ASC,b.id ASC",id)
    if err!=nil{fail(c,500,"Lỗi tải bình luận");return}
    defer rows.Close()
    result:=make([]gin.H,0)
    for rows.Next(){
        var id,postID,owner int;var content,name,avatar string;var created time.Time
        if err:=rows.Scan(&id,&postID,&owner,&content,&created,&name,&avatar);err!=nil{fail(c,500,"Lỗi đọc bình luận");return}
        result=append(result,gin.H{"id":id,"idBaiDang":postID,"idTaiKhoan":owner,"noiDung":content,"tenDangNhap":name,"avatar":avatar,"ngayBinhLuan":created.Format(time.RFC3339)})
    }
    if rows.Err()!=nil{fail(c,500,"Lỗi đọc bình luận");return}
    c.JSON(200,result) // Legacy endpoint contract: an array.
}
func (a *App) addComment(c *gin.Context) {
    var body map[string]interface{}
    if err:=c.ShouldBindJSON(&body);err!=nil{fail(c,400,"JSON không hợp lệ");return}
    content:=strings.TrimSpace(textVal(body,"noiDung"))
    if content==""||len(content)>10000{fail(c,400,"Bình luận không hợp lệ");return}
    postID, ok := parsePositiveID(body["idBaiDang"])
    if !ok { postID, ok = parsePositiveID(body["postId"]) }
    if !ok {fail(c,400,"ID bài viết phải là số nguyên dương");return}
    if !a.requireView(c,postID){return}
    var author int
    var enabled bool
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan,commentsEnabled FROM BaiDang WHERE id=?",postID).Scan(&author,&enabled)
    if err==sql.ErrNoRows{fail(c,404,"Bài viết không tồn tại");return}
    if err!=nil{fail(c,500,"Lỗi truy vấn");return}
    if !enabled{fail(c,403,"Bài viết đã tắt bình luận");return}
    blocked,err:=a.blockedBetween(c.Request.Context(),userID(c),author)
    if err!=nil{fail(c,500,"Lỗi kiểm tra quyền tương tác");return}
    if blocked{fail(c,403,"Không thể bình luận do trạng thái chặn");return}
    // The INSERT condition prevents posting if the author closes comments
    // between the initial validation and the database write.
    res,err:=a.DB.ExecContext(c.Request.Context(),
        `INSERT INTO binhluan(idBaiDang,idTaiKhoan,noiDung)
          SELECT b.id,?,? FROM BaiDang b
          WHERE b.id=? AND b.commentsEnabled=1
          AND NOT EXISTS(SELECT 1 FROM user_blocks bl WHERE
            (bl.blocker_id=? AND bl.blocked_id=b.idTaiKhoan)
            OR (bl.blocked_id=? AND bl.blocker_id=b.idTaiKhoan))`,
        userID(c),content,postID,userID(c),userID(c))
    if err==nil {
        n,_:=res.RowsAffected()
        if n==0{fail(c,403,"Bình luận đã bị khóa hoặc tài khoản đã chặn");return}
    }
    if err!=nil{
        var myErr *mysql.MySQLError
        if errors.As(err,&myErr)&&myErr.Number==1452 {fail(c,404,"Bài viết vừa bị xóa");return}
        fail(c,500,"Không lưu được bình luận");return
    }
    c.JSON(201,gin.H{"success":true,"message":"Bình luận thành công"})
}
func (a *App) deleteComment(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    var owner,postOwner int
    err:=a.DB.QueryRowContext(c.Request.Context(),
        "SELECT c.idTaiKhoan,p.idTaiKhoan FROM binhluan c JOIN BaiDang p ON p.id=c.idBaiDang WHERE c.id=?",id).
        Scan(&owner,&postOwner)
    if err==sql.ErrNoRows{fail(c,404,"Bình luận không tồn tại");return}
    if err!=nil{fail(c,500,"Lỗi truy vấn");return}
    if owner!=userID(c)&&postOwner!=userID(c)&&!isAdmin(c){fail(c,403,"Không có quyền xóa");return}
    _,err=a.DB.ExecContext(c.Request.Context(),"DELETE FROM binhluan WHERE id=?",id)
    if err!=nil{fail(c,500,"Không xóa được");return}
    c.JSON(200,gin.H{"success":true,"message":"Đã xóa bình luận"})
}

func (a *App) setCommentsEnabled(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    if !a.requireActiveOwner(c,id){return}
    var body struct { Enabled *bool `json:"enabled"` }
    if err:=c.ShouldBindJSON(&body);err!=nil||body.Enabled==nil {
        fail(c,400,"Thiếu trạng thái bật/tắt bình luận");return
    }
    // Only the original author, not moderators, controls this preference.
    result,err:=a.DB.ExecContext(c.Request.Context(),
        "UPDATE BaiDang SET commentsEnabled=? WHERE id=? AND idTaiKhoan=?",*body.Enabled,id,userID(c))
    if err!=nil{fail(c,500,"Không cập nhật được bình luận");return}
    count,_:=result.RowsAffected()
    if count==0 {
        var owner int
        err=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan FROM BaiDang WHERE id=?",id).Scan(&owner)
        if err==sql.ErrNoRows{fail(c,404,"Không tìm thấy bài viết");return}
        if err!=nil{fail(c,500,"Lỗi kiểm tra bài viết");return}
        if owner!=userID(c){fail(c,403,"Chỉ tác giả được quản lý bình luận");return}
        // Already at the requested state is idempotent success.
    }
    c.JSON(200,gin.H{"success":true,"commentsEnabled":*body.Enabled})
}
