package httpapi

import (
    "fmt"
    "time"
    "github.com/gin-gonic/gin"
)
var reactionTypes=[]string{"like","dislike","love","haha","wow","sad","angry"}
func (a *App) reactionStats(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    key:=fmt.Sprintf("reactions:%d",id)
    if a.Redis!=nil {
        if cached,err:=a.Redis.Get(c.Request.Context(),key).Result();err==nil{
            c.Data(200,"application/json; charset=utf-8",[]byte(cached));return
        }
    }
    rows,err:=a.DB.QueryContext(c.Request.Context(),"SELECT loaiCamXuc,COUNT(*) FROM Cam_Xuc WHERE idBaiDang=? GROUP BY loaiCamXuc",id)
    if err!=nil{fail(c,500,"Không thể tải cảm xúc");return}
    defer rows.Close()
    stats:=gin.H{}
    for _,kind:=range reactionTypes{stats[kind]=0}
    for rows.Next(){var kind string;var count int;if err:=rows.Scan(&kind,&count);err!=nil{fail(c,500,"Lỗi đọc cảm xúc");return};stats[kind]=count}
    if rows.Err()!=nil{fail(c,500,"Lỗi đọc cảm xúc");return}
    c.JSON(200,stats)
    // Avoid serializing through Gin's response writer again; Redis is optional.
}
func (a *App) react(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    var body map[string]interface{}
    if err:=c.ShouldBindJSON(&body);err!=nil{fail(c,400,"JSON không hợp lệ");return}
    kind:=textVal(body,"loaiCamXuc")
    valid:=false;for _,k:=range reactionTypes{if k==kind{valid=true;break}}
    if !valid{fail(c,400,"Loại cảm xúc không hợp lệ");return}
    _,err:=a.DB.ExecContext(c.Request.Context(),
        "INSERT INTO Cam_Xuc(idBaiDang,idTaiKhoan,loaiCamXuc) VALUES(?,?,?) ON DUPLICATE KEY UPDATE loaiCamXuc=VALUES(loaiCamXuc)",
        id,userID(c),kind)
    if err!=nil{fail(c,500,"Không thể thả cảm xúc");return}
    if a.Redis!=nil{_ = a.Redis.Del(c.Request.Context(),fmt.Sprintf("reactions:%d",id)).Err()}
    c.JSON(200,gin.H{"success":true,"action":"updated","emotion":kind,"updatedAt":time.Now().UTC()})
}
