package httpapi

import (
    "database/sql"
    "strconv"
    "strings"
    "time"
    "github.com/gin-gonic/gin"
)
func (a *App) sendMessage(c *gin.Context){
    var body map[string]interface{}
    if err:=c.ShouldBindJSON(&body);err!=nil{fail(c,400,"JSON không hợp lệ");return}
    receiver,ok:=body["nguoiNhanID"].(float64)
    content:=strings.TrimSpace(textVal(body,"noiDung"))
    if !ok||receiver<1||int(receiver)==userID(c)||content==""||len(content)>5000 {fail(c,400,"Dữ liệu tin nhắn không hợp lệ");return}
    var exists int
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM TaiKhoan WHERE id=?",int(receiver)).Scan(&exists)
    if err==sql.ErrNoRows{fail(c,404,"Người nhận không tồn tại");return}
    if err!=nil{fail(c,500,"Lỗi kiểm tra người nhận");return}
    _,err=a.DB.ExecContext(c.Request.Context(),"INSERT INTO tin_nhan(nguoi_gui_id,nguoi_nhan_id,noi_dung) VALUES(?,?,?)",userID(c),int(receiver),content)
    if err!=nil{fail(c,500,"Không gửi được tin nhắn");return}
    c.JSON(201,gin.H{"success":true,"message":"Đã gửi"})
}
func (a *App) chatHistory(c *gin.Context){
    id1,err1:=strconv.Atoi(c.Param("id1"))
    id2,err2:=strconv.Atoi(c.Param("id2"))
    if err1!=nil||err2!=nil||id1<1||id2<1{fail(c,400,"ID không hợp lệ");return}
    if userID(c)!=id1 && userID(c)!=id2{fail(c,403,"Không được xem cuộc trò chuyện này");return}
    rows,err:=a.DB.QueryContext(c.Request.Context(),
        "SELECT id,nguoi_gui_id,nguoi_nhan_id,noi_dung,thoi_gian FROM tin_nhan WHERE (nguoi_gui_id=? AND nguoi_nhan_id=?) OR (nguoi_gui_id=? AND nguoi_nhan_id=?) ORDER BY thoi_gian ASC,id ASC LIMIT 200",
        id1,id2,id2,id1)
    if err!=nil{fail(c,500,"Không tải được tin nhắn");return}
    defer rows.Close()
    items:=make([]gin.H,0)
    for rows.Next(){
        var id,from,to int;var content string;var created time.Time
        if err:=rows.Scan(&id,&from,&to,&content,&created);err!=nil{fail(c,500,"Lỗi dữ liệu");return}
        items=append(items,gin.H{"id":id,"nguoiGuiID":from,"nguoiNhanID":to,"noiDung":content,"thoiGian":created.Format(time.RFC3339)})
    }
    if rows.Err()!=nil{fail(c,500,"Lỗi dữ liệu");return}
    c.JSON(200,gin.H{"success":true,"tinNhan":items})
}
