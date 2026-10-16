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
    receiver,ok:=parsePositiveID(body["nguoiNhanID"])
    content:=strings.TrimSpace(textVal(body,"noiDung"))
    if !ok||receiver==userID(c)||content==""||len(content)>5000 {fail(c,400,"Dữ liệu tin nhắn không hợp lệ");return}
    var exists int
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM TaiKhoan WHERE id=?",receiver).Scan(&exists)
    if err==sql.ErrNoRows{fail(c,404,"Người nhận không tồn tại");return}
    if err!=nil{fail(c,500,"Lỗi kiểm tra người nhận");return}
    blocked,err:=a.blockedBetween(c.Request.Context(),userID(c),receiver)
    if err!=nil{fail(c,500,"Lỗi kiểm tra quyền nhắn tin");return}
    if blocked{fail(c,403,"Không thể nhắn tin khi tài khoản đã bị chặn");return}
    result,err:=a.DB.ExecContext(c.Request.Context(),
        "INSERT INTO tin_nhan(nguoi_gui_id,nguoi_nhan_id,noi_dung) "+
        "SELECT ?,?,? FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM user_blocks WHERE "+
        "(blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?))",
        userID(c),receiver,content,userID(c),receiver,receiver,userID(c))
    if err!=nil{fail(c,500,"Không gửi được tin nhắn");return}
    n,_:=result.RowsAffected()
    if n==0{fail(c,403,"Không thể nhắn tin khi tài khoản đã bị chặn");return}
    lastID,_:=result.LastInsertId()
    a.broadcastChat(userID(c),receiver,lastID)
    c.JSON(201,gin.H{"success":true,"message":"Đã gửi","id":lastID})
}
func (a *App) chatHistory(c *gin.Context){
 id1,err1:=strconv.Atoi(c.Param("id1"))
 id2,err2:=strconv.Atoi(c.Param("id2"))
 if err1!=nil||err2!=nil||id1<1||id2<1{fail(c,400,"ID không hợp lệ");return}
 if userID(c)!=id1&&userID(c)!=id2{fail(c,403,"Không được xem cuộc trò chuyện này");return}
 rows,err:=a.DB.QueryContext(c.Request.Context(),
  "SELECT m.id,m.nguoi_gui_id,m.nguoi_nhan_id,m.noi_dung,m.thoi_gian,s.tenDangNhap,COALESCE(s.avatar,''),r.tenDangNhap,COALESCE(r.avatar,'') "+
  "FROM (SELECT * FROM tin_nhan WHERE (nguoi_gui_id=? AND nguoi_nhan_id=?) OR (nguoi_gui_id=? AND nguoi_nhan_id=?) ORDER BY thoi_gian DESC,id DESC LIMIT 200) m "+
  "JOIN TaiKhoan s ON s.id=m.nguoi_gui_id JOIN TaiKhoan r ON r.id=m.nguoi_nhan_id ORDER BY m.thoi_gian ASC,m.id ASC",
  id1,id2,id2,id1)
 if err!=nil{fail(c,500,"Không tải được tin nhắn");return}
 items:=make([]gin.H,0)
 ids:=make([]interface{},0,200)
 byID:=make(map[int]gin.H)
 for rows.Next(){
  var id,from,to int
  var content,senderName,senderAvatar,recipientName,recipientAvatar string
  var created time.Time
  if err:=rows.Scan(&id,&from,&to,&content,&created,&senderName,&senderAvatar,&recipientName,&recipientAvatar);err!=nil{
   rows.Close();fail(c,500,"Lỗi dữ liệu");return
  }
  message:=gin.H{"id":id,"nguoiGuiID":from,"nguoiNhanID":to,"noiDung":content,
   "thoiGian":created.Format(time.RFC3339),"nguoiGuiTen":senderName,
   "nguoiGuiAvatar":senderAvatar,"nguoiNhanTen":recipientName,"nguoiNhanAvatar":recipientAvatar,
   "attachments":[]gin.H{}}
  items=append(items,message)
  byID[id]=message
  ids=append(ids,id)
 }
 err=rows.Err()
 rows.Close()
 if err!=nil{fail(c,500,"Lỗi dữ liệu");return}
 if len(ids)>0 {
  marks:=strings.TrimRight(strings.Repeat("?,",len(ids)),",")
  attachmentRows,err:=a.DB.QueryContext(c.Request.Context(),
   "SELECT message_id,id,original_name,media_type,kind,original_bytes,stored_bytes "+
   "FROM chat_attachments WHERE message_id IN ("+marks+") ORDER BY message_id,id",ids...)
  if err!=nil{fail(c,500,"Không tải được tệp đính kèm");return}
  for attachmentRows.Next(){
   var messageID int
   var id int64
   var name,mimeType,kind string
   var originalBytes,storedBytes int64
   if err:=attachmentRows.Scan(&messageID,&id,&name,&mimeType,&kind,&originalBytes,&storedBytes);err!=nil{
    attachmentRows.Close();fail(c,500,"Lỗi dữ liệu tệp");return
   }
   item,exists:=byID[messageID]
   if !exists{continue}
   file:=chatAttachmentJSON(id,chatMediaInfo{OriginalName:name,MIME:mimeType,
    Kind:kind,OriginalBytes:originalBytes,StoredBytes:storedBytes})
   all:=item["attachments"].([]gin.H)
   all=append(all,file)
   item["attachments"]=all
   if len(all)==1 {item["attachment"]=file} // Legacy clients continue to work.
  }
  err=attachmentRows.Err()
  attachmentRows.Close()
  if err!=nil{fail(c,500,"Lỗi dữ liệu tệp");return}
 }
 c.JSON(200,gin.H{"success":true,"tinNhan":items})
}

func (a *App) chatInbox(c *gin.Context) {
    id:=userID(c)
    // One row per peer, ordered by the latest message ID.
    rows,err:=a.DB.QueryContext(c.Request.Context(),
        "SELECT m.id,m.nguoi_gui_id,m.nguoi_nhan_id,CASE WHEN m.noi_dung='' AND a.id IS NOT NULL THEN CONCAT('[',COALESCE(a.kind,'file'),'] ',COALESCE(a.original_name,''),IF(COALESCE(ag.files,0)>1, CONCAT(' +',ag.files-1),' ')) ELSE m.noi_dung END,m.thoi_gian,u.id,u.tenDangNhap,COALESCE(u.avatar,'') "+
        "FROM tin_nhan m JOIN ("+
        " SELECT CASE WHEN nguoi_gui_id=? THEN nguoi_nhan_id ELSE nguoi_gui_id END peer_id, MAX(id) last_id"+
        " FROM tin_nhan WHERE nguoi_gui_id=? OR nguoi_nhan_id=? GROUP BY peer_id"+
        ") recent ON recent.last_id=m.id JOIN TaiKhoan u ON u.id=recent.peer_id "+
        "LEFT JOIN (SELECT message_id,MIN(id) first_id,COUNT(*) files FROM chat_attachments GROUP BY message_id) ag ON ag.message_id=m.id "+
        "LEFT JOIN chat_attachments a ON a.id=ag.first_id"+
        " ORDER BY m.id DESC LIMIT 50", id,id,id)
    if err!=nil{fail(c,500,"Không tải được hộp thư");return}
    defer rows.Close()
    inbox:=make([]gin.H,0)
    for rows.Next(){
        var lastID,from,to,peerID int
        var textValue,username,avatar string
        var created time.Time
        if err:=rows.Scan(&lastID,&from,&to,&textValue,&created,&peerID,&username,&avatar);err!=nil{fail(c,500,"Lỗi dữ liệu hộp thư");return}
        inbox=append(inbox,gin.H{"id":lastID,"nguoiGuiID":from,"nguoiNhanID":to,"noiDung":textValue,"thoiGian":created.Format(time.RFC3339),"user":gin.H{"id":peerID,"tenDangNhap":username,"avatar":avatar}})
    }
    if rows.Err()!=nil{fail(c,500,"Lỗi dữ liệu hộp thư");return}
    c.JSON(200,gin.H{"success":true,"data":inbox})
}
