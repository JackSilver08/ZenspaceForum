package httpapi

import (
    "context"
    "errors"
    mysql "github.com/go-sql-driver/mysql"
    "database/sql"
    "encoding/json"
    "fmt"
    "strconv"
    "strings"
    "time"
    "github.com/gin-gonic/gin"
)
var reactionTypes=[]string{"like","dislike","love","haha","wow","sad","angry"}
func (a *App) reactionStats(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    key:=fmt.Sprintf("reactions:%d",id)
    if a.Redis!=nil {
        rctx, cancel := context.WithTimeout(c.Request.Context(), 100*time.Millisecond)
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
            rctx, cancel := context.WithTimeout(c.Request.Context(), 100*time.Millisecond)
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
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan FROM BaiDang WHERE id=?",id).Scan(&postExists)
    if err==sql.ErrNoRows{fail(c,404,"Không tìm thấy bài viết");return}
    if err!=nil{fail(c,500,"Lỗi kiểm tra bài viết");return}
    blocked,err:=a.blockedBetween(c.Request.Context(),userID(c),postExists)
    if err!=nil{fail(c,500,"Không kiểm tra được quyền cảm xúc");return}
    if blocked{fail(c,403,"Không thể tương tác do trạng thái chặn");return}
    var existing string
    currentErr:=a.DB.QueryRowContext(c.Request.Context(),
        "SELECT loaiCamXuc FROM Cam_Xuc WHERE idBaiDang=? AND idTaiKhoan=?",id,userID(c)).Scan(&existing)
    if currentErr!=nil && currentErr!=sql.ErrNoRows {fail(c,500,"Không đọc được cảm xúc");return}
    action:="updated"
    if currentErr==nil && existing==kind {
        _,err=a.DB.ExecContext(c.Request.Context(),
            "DELETE FROM Cam_Xuc WHERE idBaiDang=? AND idTaiKhoan=?",id,userID(c))
        action="deleted"
    } else {
        _,err=a.DB.ExecContext(c.Request.Context(),
            "INSERT INTO Cam_Xuc(idBaiDang,idTaiKhoan,loaiCamXuc) VALUES(?,?,?) ON DUPLICATE KEY UPDATE loaiCamXuc=VALUES(loaiCamXuc)",
            id,userID(c),kind)
    }
    if err!=nil {
        var myErr *mysql.MySQLError
        if errors.As(err,&myErr) && myErr.Number==1452 {fail(c,404,"Bài viết không còn tồn tại");return}
        fail(c,500,"Không thể cập nhật cảm xúc");return
    }
    if a.Redis!=nil{
        rctx, cancel := context.WithTimeout(c.Request.Context(), 100*time.Millisecond)
        defer cancel()
        _ = a.Redis.Del(rctx,fmt.Sprintf("reactions:%d",id)).Err()
    }
    c.JSON(200,gin.H{"success":true,"action":action,"emotion":kind,"updatedAt":time.Now().UTC()})
}
// myReactions returns only the authenticated user's reactions for one feed page.
// Keep this private and batched to avoid N extra HTTP requests (one per post).
func (a *App) myReactions(c *gin.Context) {
    raw := strings.TrimSpace(c.Query("ids"))
    if raw == "" { fail(c, 400, "Thiếu danh sách bài viết"); return }
    parts := strings.Split(raw, ",")
    if len(parts) > 100 { fail(c, 400, "Tối đa 100 bài viết mỗi lần"); return }

    args := make([]interface{}, 0, len(parts)+1)
    args = append(args, userID(c))
    placeholders := make([]string, 0, len(parts))
    for _, part := range parts {
        id, err := strconv.Atoi(strings.TrimSpace(part))
        if err != nil || id < 1 {
            fail(c, 400, "ID bài viết không hợp lệ")
            return
        }
        args = append(args, id)
        placeholders = append(placeholders, "?")
    }
    query := "SELECT idBaiDang,loaiCamXuc FROM Cam_Xuc WHERE idTaiKhoan=? AND idBaiDang IN (" + strings.Join(placeholders, ",") + ")"
    rows, err := a.DB.QueryContext(c.Request.Context(), query, args...)
    if err != nil { fail(c, 500, "Không tải được cảm xúc đã chọn"); return }
    defer rows.Close()
    selected := map[string]string{}
    for rows.Next() {
        var id int
        var kind string
        if err := rows.Scan(&id, &kind); err != nil { fail(c, 500, "Lỗi dữ liệu cảm xúc"); return }
        selected[strconv.Itoa(id)] = kind
    }
    if rows.Err() != nil { fail(c, 500, "Lỗi dữ liệu cảm xúc"); return }
    c.JSON(200, gin.H{"success":true, "data":selected})
}

func (a *App) unreact(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    _,err:=a.DB.ExecContext(c.Request.Context(),"DELETE FROM Cam_Xuc WHERE idBaiDang=? AND idTaiKhoan=?",id,userID(c))
    if err!=nil{fail(c,500,"Không thể hủy cảm xúc");return}
    if a.Redis!=nil{
        rctx, cancel := context.WithTimeout(c.Request.Context(), 100*time.Millisecond)
        defer cancel()
        _ = a.Redis.Del(rctx,fmt.Sprintf("reactions:%d",id)).Err()
    }
    c.JSON(200,gin.H{"success":true,"action":"deleted"})
}

