package httpapi

import (
    "database/sql"
    "fmt"
    "net/http"
    "path/filepath"
    "strings"
    "time"
    "github.com/gin-gonic/gin"
)
func (a *App) getUser(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    var name,email,avatar,role string
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT tenDangNhap,email,COALESCE(avatar,''),COALESCE(phanQuyen,'user') FROM TaiKhoan WHERE id=?",id).Scan(&name,&email,&avatar,&role)
    if err==sql.ErrNoRows{fail(c,404,"Không có tài khoản");return}
    if err!=nil{fail(c,500,"Lỗi truy vấn");return}
    // Never disclose email for another user's public profile.
    user:=gin.H{"id":id,"tenDangNhap":name,"avatar":avatar,"phanQuyen":role}
    if c.GetHeader("Authorization")!="" {
        // Public endpoint still does not trust unverified user IDs; email remains private.
    }
    _=email
    c.JSON(200,gin.H{"success":true,"data":user})
}
func (a *App) profile(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    var name,avatar string
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT tenDangNhap,COALESCE(avatar,'') FROM TaiKhoan WHERE id=?",id).Scan(&name,&avatar)
    if err==sql.ErrNoRows{fail(c,404,"Không tìm thấy người dùng");return}
    if err!=nil{fail(c,500,"Lỗi truy vấn");return}
    var followers, following int
    if err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT COUNT(*) FROM follows WHERE following_id=?",id).Scan(&followers);err!=nil {fail(c,500,"Không tải được người theo dõi");return}
    if err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT COUNT(*) FROM follows WHERE follower_id=?",id).Scan(&following);err!=nil {fail(c,500,"Không tải được dữ liệu đang theo dõi");return}
    rows,err:=a.DB.QueryContext(c.Request.Context(),"SELECT id,noiDung,COALESCE(mediaUrl,''),ngayTao,pinnedAt FROM BaiDang WHERE idTaiKhoan=? ORDER BY (pinnedAt IS NOT NULL) DESC,ngayTao DESC,id DESC LIMIT 100",id)
    if err!=nil{fail(c,500,"Lỗi tải trang cá nhân");return}
    defer rows.Close()
    posts:=make([]gin.H,0)
    for rows.Next(){
        var pid int;var content,media string;var created time.Time;var pinned sql.NullTime
        if err:=rows.Scan(&pid,&content,&media,&created,&pinned);err!=nil{fail(c,500,"Lỗi bài viết");return}
        posts=append(posts,gin.H{"id":pid,"idTaiKhoan":id,"noiDung":content,"mediaUrl":media,"ngayDang":created.Format(time.RFC3339),"isPinned":pinned.Valid})
    }
    if rows.Err()!=nil{fail(c,500,"Lỗi bài viết");return}
    c.JSON(200,gin.H{"success":true,"data":gin.H{"user":gin.H{"id":id,"tenDangNhap":name,"avatar":avatar,"followers":followers,"following":following},"baiViets":posts}})
}
func (a *App) searchUsers(c *gin.Context){
    keyword:=strings.TrimSpace(c.Query("key"))
    var rows *sql.Rows
    var err error
    if len(keyword)<2 {
        rows,err=a.DB.QueryContext(c.Request.Context(),"SELECT id,tenDangNhap,COALESCE(avatar,'') FROM TaiKhoan ORDER BY id DESC LIMIT 15")
    } else {
        rows,err=a.DB.QueryContext(c.Request.Context(),"SELECT id,tenDangNhap,COALESCE(avatar,'') FROM TaiKhoan WHERE tenDangNhap LIKE ? ORDER BY tenDangNhap LIMIT 20","%"+keyword+"%")
    }
    if err!=nil{fail(c,500,"Lỗi tìm kiếm");return}
    defer rows.Close()
    users:=make([]gin.H,0)
    for rows.Next(){var id int;var name,avatar string
        if err:=rows.Scan(&id,&name,&avatar);err!=nil{fail(c,500,"Lỗi dữ liệu");return}
        users=append(users,gin.H{"id":id,"tenDangNhap":name,"avatar":avatar})
    }
    if rows.Err()!=nil{fail(c,500,"Lỗi dữ liệu");return}
    c.JSON(200,gin.H{"success":true,"data":users})
}
func (a *App) avatar(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    if id!=userID(c)&&!isAdmin(c){fail(c,403,"Không có quyền đổi avatar");return}
    f,err:=c.FormFile("avatar")
    if err!=nil{fail(c,400,"Thiếu file ảnh");return}
    if f.Size>5<<20{fail(c,413,"Avatar tối đa 5MB");return}
    ext:=strings.ToLower(filepath.Ext(f.Filename))
    if ext!=".jpg"&&ext!=".jpeg"&&ext!=".png"&&ext!=".webp"{fail(c,400,"Định dạng avatar không hợp lệ");return}
    fp,err:=f.Open();if err!=nil{fail(c,400,"Không đọc được ảnh");return}
    buf:=make([]byte,512);n,err:=fp.Read(buf);fp.Close()
    if err!=nil && n==0 {fail(c,400,"Không đọc được ảnh");return}
    if !strings.HasPrefix(http.DetectContentType(buf[:n]),"image/"){fail(c,400,"File không phải ảnh");return}
    filename:=fmt.Sprintf("avatar_%d_%d%s",id,time.Now().UnixNano(),ext)
    if err:=c.SaveUploadedFile(f,filepath.Join(a.UploadDir,filename));err!=nil{fail(c,500,"Không lưu được avatar");return}
    url:="/uploads/"+filename
    _,err=a.DB.ExecContext(c.Request.Context(),"UPDATE TaiKhoan SET avatar=? WHERE id=?",url,id)
    if err!=nil{fail(c,500,"Không lưu được avatar");return}
    c.JSON(200,gin.H{"success":true,"path":url})
}
func (a *App) deleteAccount(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    if id!=userID(c)&&!isAdmin(c){fail(c,403,"Không có quyền xóa tài khoản");return}
    _,err:=a.DB.ExecContext(c.Request.Context(),"DELETE FROM TaiKhoan WHERE id=?",id)
    if err!=nil{fail(c,500,"Không xóa được tài khoản");return}
    c.JSON(200,gin.H{"success":true,"message":"Đã xóa tài khoản"})
}
