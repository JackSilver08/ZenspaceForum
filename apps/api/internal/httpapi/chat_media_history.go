package httpapi

import (
 "strconv"
 "strings"
 "time"

 "github.com/gin-gonic/gin"
)

// Chat gallery history is paginated independently from the last 200 text
// messages. Only an authenticated participant can request this private list.
func (a *App) chatMediaHistory(c *gin.Context) {
 peer,err:=strconv.Atoi(c.Param("peerId"))
 if err!=nil||peer<=0||peer==userID(c) {fail(c,400,"Hội thoại không hợp lệ");return}
 before:=int64(9223372036854775807)
 if raw:=strings.TrimSpace(c.Query("before"));raw!="" {
  n,e:=strconv.ParseInt(raw,10,64)
  if e!=nil||n<=0{fail(c,400,"Trang media không hợp lệ");return}
  before=n
 }
 const pageSize=48
 rows,err:=a.DB.QueryContext(c.Request.Context(),`
  SELECT a.id,a.original_name,a.media_type,a.kind,a.original_bytes,a.stored_bytes,m.thoi_gian
  FROM chat_attachments a JOIN tin_nhan m ON m.id=a.message_id
  WHERE ((m.nguoi_gui_id=? AND m.nguoi_nhan_id=?)
      OR (m.nguoi_gui_id=? AND m.nguoi_nhan_id=?))
    AND a.kind IN ('image','video') AND a.id<?
  ORDER BY a.id DESC LIMIT ?`,
  userID(c),peer,peer,userID(c),before,pageSize+1)
 if err!=nil{fail(c,500,"Không thể lấy lịch sử media");return}
 defer rows.Close()
 out:=make([]gin.H,0,pageSize)
 var cursor int64
 hasMore:=false
 for rows.Next(){
  var id int64
  var info chatMediaInfo
  var created time.Time
  if err:=rows.Scan(&id,&info.OriginalName,&info.MIME,&info.Kind,&info.OriginalBytes,&info.StoredBytes,&created);err!=nil {
   fail(c,500,"Không thể đọc lịch sử media");return
  }
  if len(out)==pageSize{hasMore=true;break}
  item:=chatAttachmentJSON(id,info)
  item["createdAt"]=created.Format(time.RFC3339)
  out=append(out,item)
  cursor=id
 }
 if err:=rows.Err();err!=nil{fail(c,500,"Không thể đọc lịch sử media");return}
 if !hasMore{cursor=0}
 c.JSON(200,gin.H{"success":true,"data":out,"hasMore":hasMore,"nextCursor":cursor})
}
