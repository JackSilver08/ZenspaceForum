package httpapi

import (
 "database/sql"
 "errors"
 "os"
 "path/filepath"
 "strings"
 "time"
 "github.com/gin-gonic/gin"
)

func validVisibility(v string)bool{return v=="public"||v=="followers"||v=="private"}

func (a *App) changeVisibility(c *gin.Context){
 id,ok:=intParam(c,"id");if !ok{return}
 if !a.requireActiveOwner(c,id){return}
 var body struct{Visibility string `json:"visibility"`}
 if err:=c.ShouldBindJSON(&body);err!=nil||!validVisibility(body.Visibility){fail(c,400,"Quyền xem không hợp lệ");return}
 _,err:=a.DB.ExecContext(c.Request.Context(),"UPDATE BaiDang SET visibility=? WHERE id=? AND idTaiKhoan=? AND lifecycle_state='active'",
  body.Visibility,id,userID(c))
 if err!=nil{fail(c,500,"Không cập nhật được quyền xem");return}
 c.JSON(200,gin.H{"success":true,"visibility":body.Visibility})
}
func (a *App) archivePost(c *gin.Context){
 id,ok:=intParam(c,"id");if !ok{return}
 if !a.requireActiveOwner(c,id){return}
 _,err:=a.DB.ExecContext(c.Request.Context(),
  "UPDATE BaiDang SET lifecycle_state='archived',archived_at=NOW(6),pinnedAt=NULL WHERE id=? AND idTaiKhoan=? AND lifecycle_state='active'",id,userID(c))
 if err!=nil{fail(c,500,"Không thể lưu trữ bài viết");return}
 c.JSON(200,gin.H{"success":true,"state":"archived"})
}
func (a *App) unarchivePost(c *gin.Context){
 id,ok:=intParam(c,"id");if !ok{return}
 var owner int;var state string
 err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan,lifecycle_state FROM BaiDang WHERE id=?",id).Scan(&owner,&state)
 if errors.Is(err,sql.ErrNoRows){fail(c,404,"Bài viết không tồn tại");return}
 if err!=nil{fail(c,500,"Lỗi kiểm tra bài viết");return}
 if owner!=userID(c){fail(c,403,"Chỉ tác giả được khôi phục");return}
 if state!="archived"{fail(c,409,"Bài viết không trong lưu trữ");return}
 _,err=a.DB.ExecContext(c.Request.Context(),
  "UPDATE BaiDang SET lifecycle_state='active',archived_at=NULL WHERE id=? AND idTaiKhoan=? AND lifecycle_state='archived'",id,owner)
 if err!=nil{fail(c,500,"Không thể khôi phục khỏi lưu trữ");return}
 c.JSON(200,gin.H{"success":true,"state":"active"})
}

// Existing DELETE /api/baiviet/:id now means "move to trash", retaining FK
// relations (reactions, comments, bookmarks, reports and all media).
func (a *App) trashPost(c *gin.Context){
 id,ok:=intParam(c,"id");if !ok{return}
 if !a.postOwner(c,id){return}
 r,err:=a.DB.ExecContext(c.Request.Context(),`UPDATE BaiDang SET previous_state=lifecycle_state,
  lifecycle_state='trashed',trashed_at=NOW(6),purge_after=DATE_ADD(NOW(6),INTERVAL 30 DAY),
  pinnedAt=NULL WHERE id=? AND lifecycle_state IN ('active','archived')`,id)
 if err!=nil{fail(c,500,"Không thể đưa bài vào thùng rác");return}
 n,_:=r.RowsAffected();if n==0{fail(c,409,"Bài viết đã trong thùng rác");return}
 c.JSON(200,gin.H{"success":true,"message":"Đã chuyển bài vào thùng rác","state":"trashed"})
}
func (a *App) restorePost(c *gin.Context){
 id,ok:=intParam(c,"id");if !ok{return}
 var owner int;var state string
 err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan,lifecycle_state FROM BaiDang WHERE id=?",id).Scan(&owner,&state)
 if errors.Is(err,sql.ErrNoRows){fail(c,404,"Không tìm thấy bài viết");return}
 if err!=nil{fail(c,500,"Lỗi truy vấn");return}
 if owner!=userID(c){fail(c,403,"Không có quyền khôi phục");return}
 if state!="trashed"{fail(c,409,"Bài không nằm trong thùng rác");return}
 result,err:=a.DB.ExecContext(c.Request.Context(),`UPDATE BaiDang SET lifecycle_state=CASE
  WHEN previous_state='archived' THEN 'archived' ELSE 'active' END,
  trashed_at=NULL,purge_after=NULL
  WHERE id=? AND idTaiKhoan=? AND lifecycle_state='trashed' AND purge_after>NOW(6)`,id,owner)
 if err!=nil{fail(c,500,"Không thể khôi phục");return}
 count,_:=result.RowsAffected()
 if count==0{fail(c,410,"Bài đã hết hạn khôi phục");return}
 c.JSON(200,gin.H{"success":true,"message":"Đã khôi phục bài viết"})
}
func (a *App) permanentlyDeletePost(c *gin.Context){
 id,ok:=intParam(c,"id");if !ok{return}
 var owner int;var state,media string
 err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan,lifecycle_state,COALESCE(mediaUrl,'') FROM BaiDang WHERE id=?",id).Scan(&owner,&state,&media)
 if errors.Is(err,sql.ErrNoRows){fail(c,404,"Bài viết không tồn tại");return}
 if err!=nil{fail(c,500,"Lỗi truy vấn");return}
 if owner!=userID(c){fail(c,403,"Không có quyền xóa vĩnh viễn");return}
 if state!="trashed"{fail(c,409,"Chuyển vào thùng rác trước khi xóa vĩnh viễn");return}
 _,err=a.DB.ExecContext(c.Request.Context(),"DELETE FROM BaiDang WHERE id=? AND idTaiKhoan=? AND lifecycle_state='trashed'",id,owner)
 if err!=nil{fail(c,500,"Không thể xóa vĩnh viễn");return}
 if strings.HasPrefix(media,"/uploads/posts/"){
  _=os.Remove(filepath.Join(a.UploadDir,"posts",filepath.Base(media)))
 }
 c.JSON(200,gin.H{"success":true,"message":"Đã xóa vĩnh viễn"})
}

// Archived/trashed posts can only be listed by the original author.
func (a *App) listManagedPosts(c *gin.Context){
 state:=c.Param("state")
 if state!="archived"&&state!="trashed"{fail(c,400,"Trạng thái không hợp lệ");return}
 rows,err:=a.DB.QueryContext(c.Request.Context(),`SELECT b.id,b.idTaiKhoan,t.tenDangNhap,b.noiDung,
  COALESCE(b.mediaUrl,''),b.ngayTao,COALESCE(t.avatar,''),b.pinnedAt,b.commentsEnabled,
  b.visibility,b.lifecycle_state,b.revision,b.updated_at,b.purge_after
  FROM BaiDang b JOIN TaiKhoan t ON t.id=b.idTaiKhoan WHERE b.idTaiKhoan=? AND b.lifecycle_state=?
  ORDER BY b.ngayTao DESC,b.id DESC LIMIT 100`,userID(c),state)
 if err!=nil{fail(c,500,"Không tải được bài đã quản lý");return}
 defer rows.Close()
 items:=make([]gin.H,0)
 for rows.Next(){
  var p post;var expires sql.NullTime
  if err:=rows.Scan(&p.ID,&p.OwnerID,&p.Author,&p.Content,&p.Media,&p.Created,&p.Avatar,
   &p.PinnedAt,&p.CommentsEnabled,&p.Visibility,&p.State,&p.Revision,&p.UpdatedAt,&expires);err!=nil{
   fail(c,500,"Lỗi dữ liệu bài viết");return}
  item:=p.JSON()
  if expires.Valid {item["purgeAfter"]=expires.Time.Format(time.RFC3339)}
  items=append(items,item)
 }
 if err:=rows.Err();err!=nil{fail(c,500,"Lỗi dữ liệu bài viết");return}
 c.JSON(200,gin.H{"success":true,"data":items})
}
func (a *App) postHistory(c *gin.Context){
 id,ok:=intParam(c,"id");if !ok{return}
 var owner,state,rev int
 err:=a.DB.QueryRowContext(c.Request.Context(),
  "SELECT idTaiKhoan,revision,0 FROM BaiDang WHERE id=?",id).Scan(&owner,&rev,&state)
 if errors.Is(err,sql.ErrNoRows){fail(c,404,"Không tìm thấy bài viết");return}
 if err!=nil{fail(c,500,"Không tải được bài viết");return}
 if owner!=userID(c){fail(c,403,"Chỉ tác giả được xem lịch sử");return}
 rows,err:=a.DB.QueryContext(c.Request.Context(),
  "SELECT revision,content_before,edited_at FROM post_edit_history WHERE post_id=? ORDER BY revision DESC LIMIT 100",id)
 if err!=nil{fail(c,500,"Không tải được lịch sử");return}
 defer rows.Close()
 results:=make([]gin.H,0)
 for rows.Next(){var r int;var content string;var edited time.Time
  if err:=rows.Scan(&r,&content,&edited);err!=nil{fail(c,500,"Lỗi lịch sử");return}
  results=append(results,gin.H{"revision":r,"content":content,"editedAt":edited.Format(time.RFC3339)})
 }
 if err:=rows.Err();err!=nil{fail(c,500,"Lỗi lịch sử");return}
 c.JSON(200,gin.H{"success":true,"data":results,"currentRevision":rev})
}
func (a *App) restoreRevision(c *gin.Context){
 id,ok:=intParam(c,"id");if !ok{return}
 revision,ok:=intParam(c,"revision");if !ok{return}
 tx,err:=a.DB.BeginTx(c.Request.Context(),nil);if err!=nil{fail(c,500,"Không thể bắt đầu khôi phục");return}
 defer tx.Rollback()
 var owner,currentRev int;var current,state,old string
 err=tx.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan,noiDung,revision,lifecycle_state FROM BaiDang WHERE id=? FOR UPDATE",id).
  Scan(&owner,&current,&currentRev,&state)
 if errors.Is(err,sql.ErrNoRows){fail(c,404,"Không tìm thấy bài viết");return}
 if err!=nil{fail(c,500,"Lỗi bài viết");return}
 if owner!=userID(c){fail(c,403,"Chỉ tác giả được khôi phục nội dung");return}
 if state!="active"{fail(c,409,"Bài viết không hoạt động");return}
 err=tx.QueryRowContext(c.Request.Context(),"SELECT content_before FROM post_edit_history WHERE post_id=? AND revision=?",id,revision).Scan(&old)
 if errors.Is(err,sql.ErrNoRows){fail(c,404,"Không tìm thấy phiên bản");return}
 if err!=nil{fail(c,500,"Không tải được phiên bản");return}
 if _,err=tx.ExecContext(c.Request.Context(),"INSERT INTO post_edit_history(post_id,revision,content_before,edited_by) VALUES(?,?,?,?)",id,currentRev,current,userID(c));err!=nil{fail(c,500,"Không lưu được phiên bản trước");return}
 if _,err=tx.ExecContext(c.Request.Context(),"UPDATE BaiDang SET noiDung=?,revision=revision+1,updated_at=NOW(6) WHERE id=?",old,id);err!=nil{fail(c,500,"Không khôi phục được nội dung");return}
 if err=tx.Commit();err!=nil{fail(c,500,"Không lưu được khôi phục");return}
 c.JSON(200,gin.H{"success":true,"revision":currentRev+1})
}

// Database cleanup runs periodically. Missing files remain inaccessible because
// /uploads/posts always verifies a backing active, visible DB post.
func (a *App) PurgeExpiredPosts(){
 rows,err:=a.DB.Query("SELECT id,COALESCE(mediaUrl,'') FROM BaiDang WHERE lifecycle_state='trashed' AND purge_after<=NOW(6) LIMIT 200")
 if err!=nil{return};defer rows.Close()
 type item struct {id int;media string}
 list:=make([]item,0)
 for rows.Next(){var p item;if rows.Scan(&p.id,&p.media)==nil{list=append(list,p)}}
 if rows.Err()!=nil{return}
 for _,p:=range list{
  res,err:=a.DB.Exec("DELETE FROM BaiDang WHERE id=? AND lifecycle_state='trashed' AND purge_after<=NOW(6)",p.id)
  if err!=nil{continue}
  n,_:=res.RowsAffected();if n==1&&strings.HasPrefix(p.media,"/uploads/posts/"){
   _=os.Remove(filepath.Join(a.UploadDir,"posts",filepath.Base(p.media)))
  }
 }
}
