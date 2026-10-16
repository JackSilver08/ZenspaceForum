package httpapi

import (
 "database/sql"
 "errors"
 "net/http"
 "os"
 "path/filepath"
 "regexp"

 "github.com/gin-gonic/gin"
)

var storedChatVideoName = regexp.MustCompile(`^chat-([0-9a-f]{32})\.[a-z0-9]+$`)

// Posters are intentionally private; the same participant check protects
// both the full attachment and the lightweight thumbnail.
func (a *App) getChatAttachmentPreview(c *gin.Context) {
 id,ok:=intParam(c,"id")
 if !ok{return}
 var stored,kind string
 err:=a.DB.QueryRowContext(c.Request.Context(),`SELECT a.stored_name,a.kind
  FROM chat_attachments a JOIN tin_nhan m ON m.id=a.message_id
  WHERE a.id=? AND (m.nguoi_gui_id=? OR m.nguoi_nhan_id=?)`,
  id,userID(c),userID(c)).Scan(&stored,&kind)
 if errors.Is(err,sql.ErrNoRows){fail(c,404,"Ảnh xem trước không tồn tại");return}
 if err!=nil{fail(c,500,"Không thể tải ảnh xem trước");return}
 if kind!="video"{fail(c,404,"Ảnh xem trước không tồn tại");return}
 match:=storedChatVideoName.FindStringSubmatch(stored)
 if match==nil{fail(c,404,"Ảnh xem trước không tồn tại");return}
 file,err:=os.Open(filepath.Join(a.UploadDir,"chat","preview-"+match[1]+".webp"))
 if err!=nil{fail(c,404,"Ảnh xem trước chưa sẵn sàng");return}
 defer file.Close()
 stat,err:=file.Stat()
 if err!=nil{fail(c,500,"Không đọc được ảnh xem trước");return}
 c.Header("Content-Type","image/webp")
 c.Header("Cache-Control","private, no-store")
 c.Header("X-Content-Type-Options","nosniff")
 http.ServeContent(c.Writer,c.Request,"preview.webp",stat.ModTime(),file)
}
