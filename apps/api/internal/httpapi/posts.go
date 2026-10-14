package httpapi

import (
    "database/sql"
    "fmt"
    "io"
    "net/http"
    "os"
    "path/filepath"
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
)

type post struct {
    ID, OwnerID int
    Title, Content, Media, Author string
    Created time.Time
}
func (p post) JSON() gin.H {
    return gin.H{"id":p.ID,"idTaiKhoan":p.OwnerID,"tenDangNhap":p.Author,"tieuDe":p.Title,"noiDung":p.Content,"mediaUrl":p.Media,"ngayDang":p.Created.Format(time.RFC3339)}
}
func (a *App) listPosts(c *gin.Context) {
    limit, _ := strconv.Atoi(c.DefaultQuery("limit","30"))
    if limit < 1 { limit = 30 }; if limit > 100 { limit = 100 }
    rows,err := a.DB.QueryContext(c.Request.Context(),
        "SELECT b.id,b.idTaiKhoan,t.tenDangNhap,b.tieuDe,b.noiDung,COALESCE(b.mediaUrl,''),b.ngayTao FROM BaiDang b JOIN TaiKhoan t ON b.idTaiKhoan=t.id ORDER BY b.ngayTao DESC,b.id DESC LIMIT ?", limit)
    if err != nil { fail(c,500,"Không thể tải bài viết");return }
    defer rows.Close()
    data := make([]gin.H,0)
    for rows.Next() {
        var p post
        if err := rows.Scan(&p.ID,&p.OwnerID,&p.Author,&p.Title,&p.Content,&p.Media,&p.Created); err != nil { fail(c,500,"Lỗi dữ liệu bài viết"); return }
        data=append(data,p.JSON())
    }
    if rows.Err()!=nil { fail(c,500,"Lỗi đọc bài viết");return }
    c.JSON(200,gin.H{"success":true,"data":data})
}
func (a *App) getPost(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    var p post
    err:=a.DB.QueryRowContext(c.Request.Context(),
        "SELECT b.id,b.idTaiKhoan,t.tenDangNhap,b.tieuDe,b.noiDung,COALESCE(b.mediaUrl,''),b.ngayTao FROM BaiDang b JOIN TaiKhoan t ON t.id=b.idTaiKhoan WHERE b.id=?",id).
        Scan(&p.ID,&p.OwnerID,&p.Author,&p.Title,&p.Content,&p.Media,&p.Created)
    if err==sql.ErrNoRows{fail(c,404,"Không tìm thấy bài viết");return}
    if err!=nil{fail(c,500,"Lỗi truy vấn");return}
    c.JSON(200,gin.H{"success":true,"data":p.JSON()})
}
func (a *App) createPost(c *gin.Context) {
    var title,content,media string
    if strings.HasPrefix(c.ContentType(),"multipart/") {
        title=c.PostForm("tieuDe");content=c.PostForm("noiDung")
        if f,err:=c.FormFile("file");err==nil {
            if f.Size>20<<20 { fail(c,413,"File tối đa 20MB"); return }
            ext:=strings.ToLower(filepath.Ext(f.Filename))
            allowed:=map[string]bool{".jpg":true,".jpeg":true,".png":true,".webp":true,".gif":true,".mp4":true}
            if !allowed[ext]{fail(c,400,"Định dạng file không được hỗ trợ");return}
            src,err:=f.Open();if err!=nil{fail(c,400,"Không đọc được file");return}
            signature:=make([]byte,512); n,err:=src.Read(signature);src.Close()
            if err!=nil && err!=io.EOF {fail(c,400,"Không đọc được file");return}
            detected:=http.DetectContentType(signature[:n])
            if ext==".mp4" {
                if !strings.HasPrefix(detected,"video/mp4") && (n<8 || string(signature[4:8])!="ftyp"){fail(c,400,"File video không hợp lệ");return}
            } else if !strings.HasPrefix(detected,"image/"){fail(c,400,"File ảnh không hợp lệ");return}
            name:=fmt.Sprintf("post_%d_%d%s",userID(c),time.Now().UnixNano(),ext)
            path:=filepath.Join(a.UploadDir,"posts",name)
            if err:=c.SaveUploadedFile(f,path);err!=nil{fail(c,500,"Không lưu được file");return}
            media="/uploads/posts/"+name
        }
    } else {
        var body map[string]interface{}
        if err:=c.ShouldBindJSON(&body);err!=nil{fail(c,400,"JSON không hợp lệ");return}
        title=textVal(body,"tieuDe","TieuDe");content=textVal(body,"noiDung","NoiDung")
    }
    title=strings.TrimSpace(title);content=strings.TrimSpace(content)
    if title==""||content==""||len(title)>255 {fail(c,400,"Tiêu đề và nội dung không hợp lệ");return}
    res,err:=a.DB.ExecContext(c.Request.Context(),
        "INSERT INTO BaiDang(tieuDe,noiDung,idTaiKhoan,ngayTao,mediaUrl) VALUES(?,?,?,NOW(),?)",
        title,content,userID(c),media)
    if err!=nil{fail(c,500,"Không thể đăng bài");return}
    id,_:=res.LastInsertId()
    c.JSON(201,gin.H{"success":true,"message":"Đăng bài thành công","id":id,"mediaUrl":media})
}
func (a *App) postOwner(c *gin.Context,id int) bool {
    var owner int
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan FROM BaiDang WHERE id=?",id).Scan(&owner)
    if err==sql.ErrNoRows{fail(c,404,"Không tìm thấy bài viết");return false}
    if err!=nil{fail(c,500,"Không kiểm tra được quyền");return false}
    if owner!=userID(c)&&!isAdmin(c){fail(c,403,"Không có quyền chỉnh sửa bài viết");return false}
    return true
}
func (a *App) updatePost(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    if !a.postOwner(c,id){return}
    var body map[string]interface{}
    if err:=c.ShouldBindJSON(&body);err!=nil{fail(c,400,"JSON không hợp lệ");return}
    title:=textVal(body,"tieuDe","TieuDe")
    content:=textVal(body,"noiDung","NoiDung")
    if title==""||content==""||len(title)>255{fail(c,400,"Nội dung không hợp lệ");return}
    _,err:=a.DB.ExecContext(c.Request.Context(),"UPDATE BaiDang SET tieuDe=?,noiDung=? WHERE id=?",title,content,id)
    if err!=nil{fail(c,500,"Không sửa được bài viết");return}
    c.JSON(200,gin.H{"success":true,"message":"Đã cập nhật"})
}
func (a *App) deletePost(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    if !a.postOwner(c,id){return}
    var oldMedia string
    _=a.DB.QueryRowContext(c.Request.Context(),"SELECT COALESCE(mediaUrl,'') FROM BaiDang WHERE id=?",id).Scan(&oldMedia)
    _,err:=a.DB.ExecContext(c.Request.Context(),"DELETE FROM BaiDang WHERE id=?",id)
    if err!=nil{fail(c,500,"Không xóa được bài viết");return}
    if strings.HasPrefix(oldMedia,"/uploads/posts/") {
        _=os.Remove(filepath.Join(a.UploadDir,"posts",filepath.Base(oldMedia)))
    }
    c.JSON(200,gin.H{"success":true,"message":"Đã xóa bài viết"})
}
