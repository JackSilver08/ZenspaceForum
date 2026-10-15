package httpapi

import (
    "context"
    "database/sql"
    "errors"
    "strconv"
    "strings"

    "github.com/gin-gonic/gin"
    mysql "github.com/go-sql-driver/mysql"
)

func (a *App) requirePost(c *gin.Context, id int) bool {
    if !a.requireView(c,id){return false}
    var exists int
    err := a.DB.QueryRowContext(c.Request.Context(), "SELECT id FROM BaiDang WHERE id=?", id).Scan(&exists)
    if errors.Is(err, sql.ErrNoRows) { fail(c,404,"Bài viết không tồn tại"); return false }
    if err != nil { fail(c,500,"Không kiểm tra được bài viết"); return false }
    return true
}

func postControlError(c *gin.Context, err error) {
    var mysqlErr *mysql.MySQLError
    if errors.As(err, &mysqlErr) && mysqlErr.Number == 1452 {
        fail(c, 404, "Bài viết hoặc tài khoản không tồn tại")
        return
    }
    fail(c,500,"Không cập nhật được tùy chọn bài viết")
}

func (a *App) togglePostControl(c *gin.Context, table string, enabled bool) {
    id,ok:=intParam(c,"id");if !ok{return}
    if !a.requirePost(c,id) {return}
    var err error
    if enabled {
        _,err=a.DB.ExecContext(c.Request.Context(),
            "INSERT INTO "+table+" (user_id,post_id) VALUES(?,?) ON DUPLICATE KEY UPDATE created_at=created_at",
            userID(c),id)
    } else {
        _,err=a.DB.ExecContext(c.Request.Context(),
            "DELETE FROM "+table+" WHERE user_id=? AND post_id=?",userID(c),id)
    }
    if err!=nil {postControlError(c,err);return}
    c.JSON(200,gin.H{"success":true,"postId":id,"enabled":enabled})
}
func (a *App) setBookmark(c *gin.Context) {a.togglePostControl(c,"post_bookmarks",true)}
func (a *App) removeBookmark(c *gin.Context) {a.togglePostControl(c,"post_bookmarks",false)}
func (a *App) hidePost(c *gin.Context) {a.togglePostControl(c,"post_hides",true)}
func (a *App) unhidePost(c *gin.Context) {a.togglePostControl(c,"post_hides",false)}

// Batched user-specific state: avoid an extra HTTP request for every post card.
func (a *App) myPostState(c *gin.Context) {
    raw:=strings.TrimSpace(c.Query("ids"))
    if raw=="" {fail(c,400,"Thiếu danh sách bài viết");return}
    parts:=strings.Split(raw,",")
    if len(parts)>100 {fail(c,400,"Tối đa 100 bài viết");return}
    args:=make([]interface{},0,len(parts)+1)
    args=append(args,userID(c))
    placeholders:=make([]string,0,len(parts))
    for _,piece:=range parts {
        id,err:=strconv.Atoi(strings.TrimSpace(piece))
        if err!=nil||id<1 {fail(c,400,"ID bài viết không hợp lệ");return}
        placeholders=append(placeholders,"?")
        args=append(args,id)
    }
    bookmark,err:=a.postControlSet(c.Request.Context(),"post_bookmarks",args,placeholders)
    if err!=nil {fail(c,500,"Không tải được bài đã lưu");return}
    hidden,err:=a.postControlSet(c.Request.Context(),"post_hides",args,placeholders)
    if err!=nil {fail(c,500,"Không tải được bài đã ẩn");return}
    c.JSON(200,gin.H{"success":true,"data":gin.H{"bookmarked":bookmark,"hidden":hidden}})
}
func (a *App) postControlSet(ctx context.Context,table string,args []interface{}, placeholders []string)([]int,error){
    query:="SELECT post_id FROM "+table+" WHERE user_id=? AND post_id IN ("+strings.Join(placeholders,",")+")"
    rows,err:=a.DB.QueryContext(ctx,query,args...)
    if err!=nil{return nil,err}
    defer rows.Close()
    ids:=make([]int,0)
    for rows.Next(){var n int;if err:=rows.Scan(&n);err!=nil{return nil,err};ids=append(ids,n)}
    return ids,rows.Err()
}

func (a *App) myBookmarks(c *gin.Context) {
    limit:=30
    if raw:=c.Query("limit");raw!="" {
        n,err:=strconv.Atoi(raw);if err!=nil||n<1 {fail(c,400,"limit không hợp lệ");return}
        if n<limit {limit=n}
    }
    rows,err:=a.DB.QueryContext(c.Request.Context(),
        "SELECT b.id,b.idTaiKhoan,t.tenDangNhap,b.noiDung,COALESCE(b.mediaUrl,''),b.ngayTao,COALESCE(t.avatar,''),b.pinnedAt,b.commentsEnabled,b.visibility,b.lifecycle_state,b.revision,b.updated_at "+
        "FROM post_bookmarks bm JOIN BaiDang b ON b.id=bm.post_id JOIN TaiKhoan t ON t.id=b.idTaiKhoan "+
        "WHERE bm.user_id=? AND "+accessiblePostSQL("b",userID(c))+" AND NOT EXISTS (SELECT 1 FROM user_blocks bl WHERE "+
        "(bl.blocker_id=? AND bl.blocked_id=b.idTaiKhoan) OR "+
        "(bl.blocked_id=? AND bl.blocker_id=b.idTaiKhoan)) "+
        "ORDER BY bm.created_at DESC,b.id DESC LIMIT ?",userID(c),userID(c),userID(c),limit)
    if err!=nil{fail(c,500,"Không tải được bài đã lưu");return}
    defer rows.Close()
    items:=make([]post,0)
    for rows.Next(){var p post
        if err:=rows.Scan(&p.ID,&p.OwnerID,&p.Author,&p.Content,&p.Media,&p.Created,&p.Avatar,&p.PinnedAt,&p.CommentsEnabled,&p.Visibility,&p.State,&p.Revision,&p.UpdatedAt);err!=nil{fail(c,500,"Lỗi dữ liệu bài đã lưu");return}
        items=append(items,p)
    }
    if rows.Err()!=nil {fail(c,500,"Lỗi dữ liệu bài đã lưu");return}
    writePosts(c,a.DB,items)
}

// Exactly one pinned post per author. Only the author (not a moderator)
// may modify their profile highlight.
func (a *App) pinPost(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    if !a.requireActiveOwner(c,id){return}
    tx,err:=a.DB.BeginTx(c.Request.Context(),nil)
    if err!=nil{fail(c,500,"Không thể bắt đầu ghim bài");return}
    defer tx.Rollback()
    var owner int
    if err:=tx.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan FROM BaiDang WHERE id=?",id).Scan(&owner);err!=nil {
        if errors.Is(err,sql.ErrNoRows){fail(c,404,"Không tìm thấy bài viết")}else{fail(c,500,"Không kiểm tra được bài viết")}
        return
    }
    if owner!=userID(c){fail(c,403,"Chỉ tác giả được ghim bài viết");return}
    // Lock the account row to serialize concurrent pin requests for this author.
    var lockID int
    if err:=tx.QueryRowContext(c.Request.Context(),"SELECT id FROM TaiKhoan WHERE id=? FOR UPDATE",owner).Scan(&lockID);err!=nil{
        fail(c,500,"Không khóa được hồ sơ");return
    }
    if _,err:=tx.ExecContext(c.Request.Context(),"UPDATE BaiDang SET pinnedAt=NULL WHERE idTaiKhoan=? AND pinnedAt IS NOT NULL",owner);err!=nil{
        fail(c,500,"Không thể bỏ ghim cũ");return
    }
    if _,err:=tx.ExecContext(c.Request.Context(),"UPDATE BaiDang SET pinnedAt=NOW() WHERE id=? AND idTaiKhoan=?",id,owner);err!=nil{
        fail(c,500,"Không ghim được bài viết");return
    }
    if err:=tx.Commit();err!=nil{fail(c,500,"Không lưu được bài ghim");return}
    c.JSON(200,gin.H{"success":true,"postId":id,"pinned":true})
}
func (a *App) unpinPost(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    if !a.requireActiveOwner(c,id){return}
    if !a.requirePost(c,id) {return}
    result,err:=a.DB.ExecContext(c.Request.Context(),
        "UPDATE BaiDang SET pinnedAt=NULL WHERE id=? AND idTaiKhoan=?",id,userID(c))
    if err!=nil{fail(c,500,"Không thể bỏ ghim");return}
    n,_:=result.RowsAffected()
    if n==0 {
        var owner int
        if err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan FROM BaiDang WHERE id=?",id).Scan(&owner);err==nil && owner!=userID(c){
            fail(c,403,"Chỉ tác giả được bỏ ghim");return
        }
    }
    c.JSON(200,gin.H{"success":true,"postId":id,"pinned":false})
}

func (a *App) personalizedPublicFeed(c *gin.Context) {
    limit,err:=strconv.Atoi(c.DefaultQuery("limit","30"))
    if err!=nil||limit<1{limit=30}
    if limit>100{limit=100}
    rows,err:=a.DB.QueryContext(c.Request.Context(),
        "SELECT b.id,b.idTaiKhoan,t.tenDangNhap,b.noiDung,COALESCE(b.mediaUrl,''),b.ngayTao,COALESCE(t.avatar,''),b.pinnedAt,b.commentsEnabled,b.visibility,b.lifecycle_state,b.revision,b.updated_at "+
        "FROM BaiDang b JOIN TaiKhoan t ON t.id=b.idTaiKhoan "+
        "WHERE "+accessiblePostSQL("b",userID(c))+" AND NOT EXISTS (SELECT 1 FROM post_hides h WHERE h.post_id=b.id AND h.user_id=?) "+
        "AND NOT EXISTS (SELECT 1 FROM user_blocks bl WHERE (bl.blocker_id=? AND bl.blocked_id=b.idTaiKhoan) OR (bl.blocked_id=? AND bl.blocker_id=b.idTaiKhoan)) "+
        "ORDER BY b.ngayTao DESC,b.id DESC LIMIT ?",userID(c),userID(c),userID(c),limit)
    if err!=nil{fail(c,500,"Không tải được bảng tin");return}
    defer rows.Close()
    posts:=make([]post,0)
    for rows.Next(){
        var p post
        if err:=rows.Scan(&p.ID,&p.OwnerID,&p.Author,&p.Content,&p.Media,&p.Created,&p.Avatar,&p.PinnedAt,&p.CommentsEnabled,&p.Visibility,&p.State,&p.Revision,&p.UpdatedAt);err!=nil{fail(c,500,"Lỗi dữ liệu bảng tin");return}
        posts=append(posts,p)
    }
    if rows.Err()!=nil{fail(c,500,"Lỗi đọc bảng tin");return}
    writePosts(c,a.DB,posts)
}

