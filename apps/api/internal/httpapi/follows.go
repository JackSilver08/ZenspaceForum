package httpapi

import (
    "database/sql"
    "strconv"
    "github.com/gin-gonic/gin"
)
func (a *App) feed(c *gin.Context){
    limit,err:=strconv.Atoi(c.DefaultQuery("limit","30"));if err!=nil||limit<1{limit=30};if limit>100{limit=100}
    // The author's own posts plus followed accounts; add index-based cursor pagination later.
    rows,err:=a.DB.QueryContext(c.Request.Context(),
        "SELECT b.id,b.idTaiKhoan,t.tenDangNhap,b.tieuDe,b.noiDung,COALESCE(b.mediaUrl,''),b.ngayTao,COALESCE(t.avatar,'') FROM BaiDang b JOIN TaiKhoan t ON t.id=b.idTaiKhoan WHERE b.idTaiKhoan=? OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=? AND f.following_id=b.idTaiKhoan) ORDER BY b.ngayTao DESC,b.id DESC LIMIT ?",
        userID(c),userID(c),limit)
    if err!=nil{fail(c,500,"Không tải được bảng tin");return}
    defer rows.Close()
    posts:=make([]post,0)
    for rows.Next(){
        var p post
        if err:=rows.Scan(&p.ID,&p.OwnerID,&p.Author,&p.Title,&p.Content,&p.Media,&p.Created,&p.Avatar);err!=nil{fail(c,500,"Lỗi bảng tin");return}
        posts=append(posts,p)
    }
    if rows.Err()!=nil{fail(c,500,"Lỗi bảng tin");return}
    writePosts(c,a.DB,posts)
}
func (a *App) follow(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    if id==userID(c){fail(c,400,"Không thể theo dõi chính mình");return}
    var exists int
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM TaiKhoan WHERE id=?",id).Scan(&exists)
    if err==sql.ErrNoRows{fail(c,404,"Không tìm thấy người dùng");return}
    if err!=nil{fail(c,500,"Lỗi truy vấn");return}
    _,err=a.DB.ExecContext(c.Request.Context(),"INSERT IGNORE INTO follows(follower_id,following_id) VALUES(?,?)",userID(c),id)
    if err!=nil{fail(c,500,"Không theo dõi được");return}
    c.JSON(200,gin.H{"success":true,"following":true})
}
func (a *App) unfollow(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    _,err:=a.DB.ExecContext(c.Request.Context(),"DELETE FROM follows WHERE follower_id=? AND following_id=?",userID(c),id)
    if err!=nil{fail(c,500,"Không bỏ theo dõi được");return}
    c.JSON(200,gin.H{"success":true,"following":false})
}
func (a *App) followStatus(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    var count int
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT COUNT(*) FROM follows WHERE follower_id=? AND following_id=?",userID(c),id).Scan(&count)
    if err!=nil{fail(c,500,"Lỗi truy vấn");return}
    var followers int
    _=a.DB.QueryRowContext(c.Request.Context(),"SELECT COUNT(*) FROM follows WHERE following_id=?",id).Scan(&followers)
    c.JSON(200,gin.H{"success":true,"following":count>0,"followers":followers})
}
