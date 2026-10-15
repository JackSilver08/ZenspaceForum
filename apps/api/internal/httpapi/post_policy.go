package httpapi

import (
 "context"
 "database/sql"
 "errors"
 "path/filepath"
 "strings"
 "strconv"
 "github.com/gin-gonic/gin"
 "github.com/golang-jwt/jwt/v5"
)

// Optional bearer auth for public reads: never trust claimed IDs without signature
// AND database membership checks. Invalid tokens have guest privileges.
func (a *App) viewer(c *gin.Context) int {
 if id:=userID(c);id>0{return id}
 parts:=strings.SplitN(c.GetHeader("Authorization")," ",2)
 if len(parts)!=2 || !strings.EqualFold(parts[0],"Bearer"){return 0}
 t,err:=jwt.Parse(parts[1],func(token *jwt.Token)(interface{},error){
  if token.Method!=jwt.SigningMethodHS256 {return nil,jwt.ErrTokenSignatureInvalid}
  return a.Secret,nil
 })
 if err!=nil||!t.Valid{return 0}
 claims,ok:=t.Claims.(jwt.MapClaims);if !ok{return 0}
 f,ok:=claims["id"].(float64);if !ok||f<=0||f>2147483647{return 0}
 id:=int(f);var found int
 if a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM TaiKhoan WHERE id=?",id).Scan(&found)!=nil{return 0}
 return id
}

// Same SQL policy for lists, profiles and single-item reads.
// Identity is a validated integer, never untrusted SQL text.
func accessiblePostSQL(alias string,viewer int)string{
 v:=strconv.Itoa(viewer)
 if viewer==0 {return alias+".lifecycle_state='active' AND "+alias+".visibility='public'"}
 return alias+".lifecycle_state='active' AND ("+alias+".idTaiKhoan="+v+
  " OR (("+alias+".visibility='public' OR ("+alias+".visibility='followers' AND EXISTS"+
  "(SELECT 1 FROM follows f WHERE f.follower_id="+v+" AND f.following_id="+alias+".idTaiKhoan)))"+
  " AND NOT EXISTS(SELECT 1 FROM user_blocks bl WHERE (bl.blocker_id="+v+" AND bl.blocked_id="+alias+".idTaiKhoan)"+
  " OR (bl.blocked_id="+v+" AND bl.blocker_id="+alias+".idTaiKhoan))))"
}

func (a *App) canViewPost(ctx context.Context, id,viewer int) (bool,error) {
 query:="SELECT EXISTS(SELECT 1 FROM BaiDang b WHERE b.id=? AND "+accessiblePostSQL("b",viewer)+")"
 var ok bool
 err:=a.DB.QueryRowContext(ctx,query,id).Scan(&ok)
 return ok,err
}
func (a *App) requireView(c *gin.Context,id int)bool{
 ok,err:=a.canViewPost(c.Request.Context(),id,a.viewer(c))
 if err!=nil{fail(c,500,"Không thể kiểm tra quyền xem");return false}
 if !ok{fail(c,404,"Không tìm thấy bài viết");return false}
 return true
}
func (a *App) requireActiveOwner(c *gin.Context,id int)bool{
 var owner int;var state string
 err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan,lifecycle_state FROM BaiDang WHERE id=?",id).Scan(&owner,&state)
 if errors.Is(err,sql.ErrNoRows){fail(c,404,"Không tìm thấy bài viết");return false}
 if err!=nil{fail(c,500,"Không kiểm tra được bài viết");return false}
 if owner!=userID(c){fail(c,403,"Chỉ tác giả được thực hiện thao tác");return false}
 if state!="active"{fail(c,409,"Bài viết không còn hoạt động");return false}
 return true
}

// The historical /uploads/posts/ URL is no longer a static public directory.
// All files belonging to a post are protected with the same policy as the post.
func (a *App) serveUpload(c *gin.Context){
 raw:=strings.TrimPrefix(c.Param("filepath"),"/")
 if raw==""||strings.Contains(raw,"\\")||strings.Contains(raw,"..")||
  filepath.Clean(raw)!=raw {fail(c,404,"Tệp không tồn tại");return}
 if strings.HasPrefix(raw,"posts/"){
  var id int
  err:=a.DB.QueryRowContext(c.Request.Context(),
   "SELECT id FROM BaiDang WHERE mediaUrl=? LIMIT 1","/uploads/"+raw).Scan(&id)
  if err!=nil{fail(c,404,"Tệp không tồn tại");return}
  if !a.requireView(c,id){return}
 }else if strings.Contains(raw,"/"){fail(c,404,"Tệp không tồn tại");return}
 file:=filepath.Join(a.UploadDir,filepath.FromSlash(raw))
 c.Header("X-Content-Type-Options","nosniff")
 c.Header("Cache-Control","private, no-store")
 c.File(file) // net/http supports video Range requests.
}

// Reports and audit snapshots must never leak through a raw upload path.
