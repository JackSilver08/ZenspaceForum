package httpapi

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "time"
    "github.com/gin-gonic/gin"
)
var reactionTypes=[]string{"like","dislike","love","haha","wow","sad","angry"}
func (a *App) reactionStats(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    key:=fmt.Sprintf("reactions:%d",id)
    if a.Redis!=nil {
        rctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
        defer cancel()
        if cached,err:=a.Redis.Get(rctx,key).Result();err==nil{
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
    if a.Redis!=nil {
        if b, err := json.Marshal(stats); err == nil {
            rctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
            defer cancel()
            _ = a.Redis.Set(rctx, key, b, 60*time.Second).Err()
        }
    }
    c.JSON(200,stats)
}
func (a *App) react(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    var body map[string]interface{}
    if err:=c.ShouldBindJSON(&body);err!=nil{fail(c,400,"JSON không hợp lệ");return}
    kind:=textVal(body,"loaiCamXuc")
    valid:=false;for _,k:=range reactionTypes{if k==kind{valid=true;break}}
    if !valid{fail(c,400,"Loại cảm xúc không hợp lệ");return}
    var postExists int
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM BaiDang WHERE id=?",id).Scan(&postExists)
    if err==sql.ErrNoRows{fail(c,404,"Không tìm thấy bài viết");return}
    if err!=nil{fail(c,500,"Lỗi kiểm tra bài viết");return}
    _,err=a.DB.ExecContext(c.Request.Context(),
        "INSERT INTO Cam_Xuc(idBaiDang,idTaiKhoan,loaiCamXuc) VALUES(?,?,?) ON DUPLICATE KEY UPDATE loaiCamXuc=VALUES(loaiCamXuc)",
        id,userID(c),kind)
    if err!=nil{fail(c,500,"Không thể thả cảm xúc");return}
    if a.Redis!=nil{
        rctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
        defer cancel()
        _ = a.Redis.Del(rctx,fmt.Sprintf("reactions:%d",id)).Err()
    }
    c.JSON(200,gin.H{"success":true,"action":"updated","emotion":kind,"updatedAt":time.Now().UTC()})
}
func (a *App) unreact(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    _,err:=a.DB.ExecContext(c.Request.Context(),"DELETE FROM Cam_Xuc WHERE idBaiDang=? AND idTaiKhoan=?",id,userID(c))
    if err!=nil{fail(c,500,"Không thể hủy cảm xúc");return}
    if a.Redis!=nil{
        rctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
        defer cancel()
        _ = a.Redis.Del(rctx,fmt.Sprintf("reactions:%d",id)).Err()
    }
    c.JSON(200,gin.H{"success":true,"action":"deleted"})
}

