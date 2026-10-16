package httpapi

import (
 "compress/gzip"
 "context"
 "crypto/rand"
 "database/sql"
 "encoding/hex"
 "errors"
 "fmt"
 "io"
 "mime"
 "net/http"
 "os"
 "os/exec"
 "path/filepath"
 "strconv"
 "strings"
 "time"
 "unicode/utf8"

 "github.com/gin-gonic/gin"
)

const chatUploadLimit int64 = 80 << 20
const chatImageMax int64 = 25 << 20
const chatDocumentMax int64 = 20 << 20
const chatUserStorageQuota int64 = 500 << 20

// Shared process-wide cap avoids unbounded FFmpeg jobs exhausting CPU/RAM.
var chatTranscodeSlots = make(chan struct{},2)

type chatMediaInfo struct {
 OriginalName string
 StoredName string
 MIME string
 Kind string
 Encoding string
 OriginalBytes int64
 StoredBytes int64
}
func chatAttachmentJSON(id int64, info chatMediaInfo) gin.H {
 return gin.H{"id":id,"name":info.OriginalName,"kind":info.Kind,"mime":info.MIME,
  "size":info.StoredBytes,"originalSize":info.OriginalBytes,
  "url":fmt.Sprintf("/api/chat/attachments/%d",id)}
}

func chatFileName(raw string) string {
 raw=filepath.Base(strings.ReplaceAll(raw,"\\","/"))
 raw=strings.Map(func(r rune)rune{
  if r<32 || r==127 || r=='/' || r=='\\' {return -1}
  return r
 },raw)
 if raw=="." || raw=="" {return "attachment"}
 if utf8.RuneCountInString(raw)>120 {raw=string([]rune(raw)[:120])}
 return raw
}
func chatKind(extension string)(kind,mimeType string,ok bool){
 switch extension {
 case ".jpg",".jpeg",".png",".webp",".gif",".bmp",".avif",".heic",".heif":
  return "image","image/webp",true
 case ".mp4",".mov",".webm",".m4v":
  m:=map[string]string{".mp4":"video/mp4",".mov":"video/quicktime",".webm":"video/webm",".m4v":"video/mp4"}
  return "video",m[extension],true
 case ".mp3",".wav",".ogg",".m4a",".flac":
  m:=map[string]string{".mp3":"audio/mpeg",".wav":"audio/wav",".ogg":"audio/ogg",".m4a":"audio/mp4",".flac":"audio/flac"}
  return "audio",m[extension],true
 case ".pdf":return "file","application/pdf",true
 case ".txt",".md",".csv",".json",".log":return "file","text/plain; charset=utf-8",true
 case ".doc",".docx",".xls",".xlsx",".ppt",".pptx",".zip",".7z",".rar",".rtf":
  return "file","application/octet-stream",true
 default:return "","",false
 }
}
func chatTempName() (string,error){
 key:=make([]byte,16)
 if _,err:=rand.Read(key);err!=nil {return "",err}
 return hex.EncodeToString(key),nil
}
func chatCommand(ctx context.Context,name string,args ...string)error{
 command:=exec.CommandContext(ctx,name,args...)
 if output,err:=command.CombinedOutput();err!=nil {
  return fmt.Errorf("%s: %v (%s)",name,err,strings.TrimSpace(string(output[:min(len(output),300)])))
 }
 return nil
}
func chatProbe(ctx context.Context,path string,kind string)error{
 // Decode only selected media streams; apply time and pixel budgets before transcoding.
 stream:="v:0"
 if kind=="audio" {stream="a:0"}
 cmd:=exec.CommandContext(ctx,"ffprobe","-v","error","-select_streams",stream,
  "-show_entries","stream=codec_name,width,height","-of","csv=p=0",path)
 b,err:=cmd.Output()
 if err!=nil || len(strings.TrimSpace(string(b)))==0 {return errors.New("cannot decode media stream")}
 if kind=="video"||kind=="image"{
  // Additional bounded image/video dimensions reject decompression bombs.
  parts:=strings.Split(strings.TrimSpace(string(b)),",")
  if len(parts)<3{return errors.New("invalid media dimensions")}
  width,e1:=strconv.Atoi(strings.TrimSpace(parts[len(parts)-2]))
  height,e2:=strconv.Atoi(strings.TrimSpace(parts[len(parts)-1]))
  if e1!=nil||e2!=nil||width<1||height<1||int64(width)*int64(height)>40000000 {
   return errors.New("media resolution is too large")
  }
 }
 if kind=="video"||kind=="audio" {
  output,err:=exec.CommandContext(ctx,"ffprobe","-v","error","-show_entries",
   "format=duration","-of","default=noprint_wrappers=1:nokey=1",path).Output()
  if err!=nil{return errors.New("cannot inspect media duration")}
  duration,err:=strconv.ParseFloat(strings.TrimSpace(string(output)),64)
  if err!=nil || duration<=0 || duration>300 {return errors.New("media exceeds the five-minute limit")}
 }
 return nil
}

// Every attachment is stored beneath uploads/chat, which is intentionally
// inaccessible through the public /uploads/* route. Media is only served
// through authenticated /api/chat/attachments/:id.
func chatOptimize(ctx context.Context,original string,ext string,dir string,token string,bytes int64)(path string,info chatMediaInfo,err error){
 kind,mimeType,ok:=chatKind(ext)
 if !ok{return "",info,errors.New("unsupported file format")}
 limit:=chatDocumentMax
 if kind=="image"{limit=chatImageMax}
 if kind=="video"{limit=chatUploadLimit}
 if kind=="audio"{limit=chatDocumentMax}
 if bytes<=0||bytes>limit{return "",info,errors.New("file exceeds size limit")}
 info=chatMediaInfo{Kind:kind,MIME:mimeType,OriginalBytes:bytes,StoredBytes:bytes}
 if kind=="image"||kind=="video"||kind=="audio" {
  probeCtx,stop:=context.WithTimeout(ctx,12*time.Second)
  err=chatProbe(probeCtx,original,kind)
  stop()
  if err!=nil{return "",info,err}
 }
 candidate:=original
 suffix:=ext
 // Still frames -> WebP. GIF uses animated WebP (no frame flattening).
 if kind=="image"{
  dest:=filepath.Join(dir,"processed-"+token+".webp")
  args:=[]string{"-nostdin","-hide_banner","-loglevel","error","-threads","2",
   "-i",original,"-vf","scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease",
   "-map_metadata","-1"}
  if ext==".gif"{
   args=append(args,"-c:v","libwebp_anim","-quality","76","-loop","0")
  }else{
   args=append(args,"-frames:v","1","-c:v","libwebp","-quality","78","-compression_level","5")
  }
  args=append(args,"-y",dest)
  transcodeCtx,stop:=context.WithTimeout(ctx,70*time.Second)
  err=chatCommand(transcodeCtx,"ffmpeg",args...)
  stop()
  if err!=nil{return "",info,fmt.Errorf("cannot convert image to WebP: %w",err)}
  candidate=dest;suffix=".webp";info.MIME="image/webp"
 }
 if kind=="video"{
  dest:=filepath.Join(dir,"processed-"+token+".mp4")
  args:=[]string{"-nostdin","-hide_banner","-loglevel","error","-threads","2",
   "-i",original,"-vf","scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
   "-c:v","libx264","-preset","veryfast","-crf","30","-threads","2",
   "-c:a","aac","-b:a","96k","-movflags","+faststart","-map_metadata","-1","-y",dest}
  transcodeCtx,stop:=context.WithTimeout(ctx,95*time.Second)
  err=chatCommand(transcodeCtx,"ffmpeg",args...)
  stop()
  if err==nil {
   if stat,e:=os.Stat(dest);e==nil&&stat.Size()>0&&stat.Size()<bytes {
    candidate=dest;suffix=".mp4";info.MIME="video/mp4"
   }
  }
  // Keep a valid original if transcoding failed or would increase its size.
 }
 if kind=="audio"{
  dest:=filepath.Join(dir,"processed-"+token+".ogg")
  transcodeCtx,stop:=context.WithTimeout(ctx,55*time.Second)
  err=chatCommand(transcodeCtx,"ffmpeg","-nostdin","-hide_banner","-loglevel","error",
   "-threads","2","-i",original,"-vn","-c:a","libopus","-b:a","72k","-map_metadata","-1","-y",dest)
  stop()
  if err==nil {
   if stat,e:=os.Stat(dest);e==nil&&stat.Size()>0&&stat.Size()<bytes {
    candidate=dest;suffix=".ogg";info.MIME="audio/ogg"
   }
  }
 }
 if kind=="file" && (ext==".txt"||ext==".md"||ext==".csv"||ext==".json"||ext==".log"){
  dest:=filepath.Join(dir,"processed-"+token+".gz")
  in,e:=os.Open(original)
  if e!=nil{return "",info,e}
  out,e:=os.OpenFile(dest,os.O_CREATE|os.O_EXCL|os.O_WRONLY,0600)
  if e!=nil {in.Close();return "",info,e}
  gz,e:=gzip.NewWriterLevel(out,gzip.BestCompression)
  if e!=nil {in.Close();out.Close();return "",info,e}
  _,copyErr:=io.Copy(gz,in)
  closeErr:=gz.Close()
  outErr:=out.Close()
  in.Close()
  if copyErr==nil&&closeErr==nil&&outErr==nil {
   if stat,e:=os.Stat(dest);e==nil&&stat.Size()>0&&stat.Size()<bytes {
    candidate=dest;suffix=".gz";info.Encoding="gzip"
   }
  }
 }
 info.StoredName="chat-"+token+suffix
 final:=filepath.Join(dir,info.StoredName)
 if err=os.Rename(candidate,final);err!=nil{return "",info,err}
 stat,err:=os.Stat(final)
 if err!=nil{return "",info,err}
 info.StoredBytes=stat.Size()
 return final,info,nil
}

func (a *App) sendChatAttachment(c *gin.Context){
 c.Request.Body=http.MaxBytesReader(c.Writer,c.Request.Body,chatUploadLimit+(2<<20))
 if err:=c.Request.ParseMultipartForm(4<<20);err!=nil {
  fail(c,http.StatusRequestEntityTooLarge,"Tệp vượt quá giới hạn cho phép");return
 }
 if c.Request.MultipartForm!=nil {defer c.Request.MultipartForm.RemoveAll()}
 receiver,err:=strconv.Atoi(c.PostForm("receiverId"))
 if err!=nil||receiver<1||receiver==userID(c){fail(c,400,"Người nhận không hợp lệ");return}
 caption:=strings.TrimSpace(c.PostForm("caption"))
 if utf8.RuneCountInString(caption)>5000 {fail(c,400,"Nội dung tin nhắn quá dài");return}
 file,err:=c.FormFile("file")
 if err!=nil{fail(c,400,"Vui lòng chọn tệp đính kèm");return}
 filename:=chatFileName(file.Filename)
 originalFilename:=chatFileName(c.PostForm("originalName"))
 if originalFilename=="attachment" {originalFilename=filename}
 ext:=strings.ToLower(filepath.Ext(filename))
 kind,_,ok:=chatKind(ext)
 if !ok{fail(c,400,"Loại tệp không được hỗ trợ");return}
 limit:=chatDocumentMax
 if kind=="image"{limit=chatImageMax}
 if kind=="video"{limit=chatUploadLimit}
 if file.Size<=0 || file.Size>limit {fail(c,413,"Tệp vượt quá giới hạn dung lượng");return}
 var exists int
 if err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM TaiKhoan WHERE id=?",receiver).Scan(&exists);err!=nil {
  if errors.Is(err,sql.ErrNoRows){fail(c,404,"Người nhận không tồn tại");return}
  fail(c,500,"Không kiểm tra được người nhận");return
 }
 blocked,err:=a.blockedBetween(c.Request.Context(),userID(c),receiver)
 if err!=nil{fail(c,500,"Không kiểm tra được quyền gửi tệp");return}
 if blocked {fail(c,403,"Không thể gửi tệp cho tài khoản đã chặn");return}
 var used int64
 if err:=a.DB.QueryRowContext(c.Request.Context(),
  "SELECT COALESCE(SUM(a.stored_bytes),0) FROM chat_attachments a JOIN tin_nhan m ON m.id=a.message_id WHERE m.nguoi_gui_id=?",
  userID(c)).Scan(&used);err!=nil {fail(c,500,"Không kiểm tra được dung lượng lưu trữ");return}
 if used+file.Size>chatUserStorageQuota {
  fail(c,413,"Bạn đã sử dụng hết hạn mức 500 MB tệp chat. Vui lòng liên hệ quản trị viên.");return
 }
 dir:=filepath.Join(a.UploadDir,"chat")
 if err:=os.MkdirAll(dir,0700);err!=nil{fail(c,500,"Không thể chuẩn bị kho lưu trữ");return}
 token,err:=chatTempName()
 if err!=nil{fail(c,500,"Không thể tạo tên tệp");return}
 incoming:=filepath.Join(dir,"incoming-"+token)
 src,err:=file.Open()
 if err!=nil{fail(c,400,"Không thể đọc tệp");return}
 temp,err:=os.OpenFile(incoming,os.O_WRONLY|os.O_CREATE|os.O_EXCL,0600)
 if err!=nil{src.Close();fail(c,500,"Không thể lưu tệp tạm");return}
 size,copyErr:=io.Copy(temp,io.LimitReader(src,limit+1))
 closeErr:=temp.Close()
 src.Close()
 defer os.Remove(incoming)
 defer os.Remove(filepath.Join(dir,"processed-"+token+".webp"))
 defer os.Remove(filepath.Join(dir,"processed-"+token+".mp4"))
 defer os.Remove(filepath.Join(dir,"processed-"+token+".ogg"))
 defer os.Remove(filepath.Join(dir,"processed-"+token+".gz"))
 if copyErr!=nil||closeErr!=nil||size!=file.Size||size>limit {
  fail(c,400,"Dữ liệu tệp không hợp lệ");return
 }
 select {
 case chatTranscodeSlots<-struct{}{}:
  defer func(){<-chatTranscodeSlots}()
 default:
  fail(c,429,"Máy chủ đang xử lý nhiều tệp. Vui lòng thử lại sau.");return
 }
 processed,meta,err:=chatOptimize(c.Request.Context(),incoming,ext,dir,token,size)
 if err!=nil{fail(c,400,"Không thể xử lý tệp: "+err.Error());return}
 keepFile:=false
 defer func(){if !keepFile { _=os.Remove(processed) }}()
 meta.OriginalName=originalFilename
 tx,err:=a.DB.BeginTx(c.Request.Context(),nil)
 if err!=nil{fail(c,500,"Không thể lưu tin nhắn");return}
 defer tx.Rollback()
 // Recheck blocking atomically at message insertion just like plain chat.
 result,err:=tx.ExecContext(c.Request.Context(),
  "INSERT INTO tin_nhan(nguoi_gui_id,nguoi_nhan_id,noi_dung) "+
   "SELECT ?,?,? FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM user_blocks WHERE "+
   "(blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?))",
  userID(c),receiver,caption,userID(c),receiver,receiver,userID(c))
 if err!=nil{fail(c,500,"Không thể lưu tin nhắn");return}
 affected,_:=result.RowsAffected()
 if affected==0 {fail(c,403,"Không thể gửi tệp khi tài khoản đã bị chặn");return}
 messageID,_:=result.LastInsertId()
 result,err=tx.ExecContext(c.Request.Context(),`INSERT INTO chat_attachments(
  message_id,original_name,stored_name,media_type,kind,original_bytes,stored_bytes,encoding)
  VALUES(?,?,?,?,?,?,?,?)`,messageID,meta.OriginalName,meta.StoredName,meta.MIME,
  meta.Kind,meta.OriginalBytes,meta.StoredBytes,meta.Encoding)
 if err!=nil{fail(c,500,"Không thể lưu tệp đính kèm");return}
 attachmentID,_:=result.LastInsertId()
 if err:=tx.Commit();err!=nil{fail(c,500,"Không thể hoàn tất gửi tệp");return}
 keepFile=true
 a.broadcastChat(userID(c),receiver,messageID)
 c.JSON(201,gin.H{"success":true,"id":messageID,"attachment":chatAttachmentJSON(attachmentID,meta)})
}

func (a *App) getChatAttachment(c *gin.Context){
 id,ok:=intParam(c,"id");if !ok{return}
 var info chatMediaInfo
 err:=a.DB.QueryRowContext(c.Request.Context(),`SELECT a.original_name,a.stored_name,a.media_type,a.kind,
  a.original_bytes,a.stored_bytes,a.encoding
  FROM chat_attachments a JOIN tin_nhan m ON m.id=a.message_id
  WHERE a.id=? AND (m.nguoi_gui_id=? OR m.nguoi_nhan_id=?)`,
  id,userID(c),userID(c)).Scan(&info.OriginalName,&info.StoredName,
  &info.MIME,&info.Kind,&info.OriginalBytes,&info.StoredBytes,&info.Encoding)
 if errors.Is(err,sql.ErrNoRows){fail(c,404,"Tệp không tồn tại");return}
 if err!=nil{fail(c,500,"Không thể tải tệp");return}
 if strings.ContainsAny(info.StoredName,"/\\")||strings.Contains(info.StoredName,".."){
  fail(c,404,"Tệp không tồn tại");return
 }
 file,err:=os.Open(filepath.Join(a.UploadDir,"chat",info.StoredName))
 if err!=nil{fail(c,404,"Tệp không còn trên máy chủ");return}
 defer file.Close()
 c.Header("X-Content-Type-Options","nosniff")
 c.Header("Cache-Control","private, no-store")
 disposition:="attachment"
 if info.Kind=="image"||info.Kind=="video"||info.Kind=="audio"{disposition="inline"}
 c.Header("Content-Disposition",mime.FormatMediaType(disposition,map[string]string{"filename":info.OriginalName}))
 c.Header("Content-Type",info.MIME)
 if info.Encoding=="gzip" {
  gz,err:=gzip.NewReader(file)
  if err!=nil{fail(c,500,"Tệp lưu trữ không hợp lệ");return}
  defer gz.Close()
  c.Status(200)
  _,_=io.Copy(c.Writer,gz)
  return
 }
 // ServeContent supports byte ranges for video seeking.
 stat,err:=file.Stat()
 if err!=nil{fail(c,500,"Không đọc được tệp");return}
 http.ServeContent(c.Writer,c.Request,info.OriginalName,stat.ModTime(),file)
}
