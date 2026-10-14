package httpapi

import (
    "database/sql"
    "strconv"
    "strings"
    "time"
    "github.com/gin-gonic/gin"
)
func (a *App) listComments(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
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
    var postID int
    switch v:=body["idBaiDang"].(type){
    case float64: postID = int(v)
    case int: postID = v
    case string: postID, _ = strconv.Atoi(v)
    }
    if postID < 1 {
        if v, ok := body["postId"].(float64); ok { postID = int(v) }
    }
    if postID < 1 {fail(c,400,"Thiếu ID bài viết");return}
    var exists int
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM BaiDang WHERE id=?",postID).Scan(&exists)
    if err==sql.ErrNoRows{fail(c,404,"Bài viết không tồn tại");return}
    if err!=nil{fail(c,500,"Lỗi truy vấn");return}
    _,err=a.DB.ExecContext(c.Request.Context(),"INSERT INTO binhluan(idBaiDang,idTaiKhoan,noiDung) VALUES(?,?,?)",postID,userID(c),content)
    if err!=nil{fail(c,500,"Không lưu được bình luận");return}
    c.JSON(201,gin.H{"success":true,"message":"Bình luận thành công"})
}
func (a *App) deleteComment(c *gin.Context) {
    id,ok:=intParam(c,"id");if !ok{return}
    var owner int
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan FROM binhluan WHERE id=?",id).Scan(&owner)
    if err==sql.ErrNoRows{fail(c,404,"Bình luận không tồn tại");return}
    if err!=nil{fail(c,500,"Lỗi truy vấn");return}
    if owner!=userID(c)&&!isAdmin(c){fail(c,403,"Không có quyền xóa");return}
    _,err=a.DB.ExecContext(c.Request.Context(),"DELETE FROM binhluan WHERE id=?",id)
    if err!=nil{fail(c,500,"Không xóa được");return}
    c.JSON(200,gin.H{"success":true,"message":"Đã xóa bình luận"})
}
