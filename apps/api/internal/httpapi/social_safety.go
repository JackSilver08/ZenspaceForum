package httpapi

import (
    "context"
    "database/sql"
    "errors"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    mysql "github.com/go-sql-driver/mysql"
)

// blockedBetween is deliberately symmetric for interaction safety:
// neither party can reach out while either has blocked the other.
func (a *App) blockedBetween(ctx context.Context, left,right int)(bool,error){
    if left==right{return false,nil}
    var n int
    err:=a.DB.QueryRowContext(ctx,
        "SELECT COUNT(*) FROM user_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)",
        left,right,right,left).Scan(&n)
    return n>0,err
}
func (a *App) blockStatus(c *gin.Context){
    other,ok:=intParam(c,"id");if !ok{return}
    if other==userID(c){fail(c,400,"Không thể tự chặn tài khoản");return}
    var exists int
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM TaiKhoan WHERE id=?",other).Scan(&exists)
    if errors.Is(err,sql.ErrNoRows){fail(c,404,"Tài khoản không tồn tại");return}
    if err!=nil{fail(c,500,"Không kiểm tra được tài khoản");return}
    var blocked,blockedBy int
    err=a.DB.QueryRowContext(c.Request.Context(),
        "SELECT (SELECT COUNT(*) FROM user_blocks WHERE blocker_id=? AND blocked_id=?), "+
        "(SELECT COUNT(*) FROM user_blocks WHERE blocker_id=? AND blocked_id=?)",
        userID(c),other,other,userID(c)).Scan(&blocked,&blockedBy)
    if err!=nil{fail(c,500,"Không đọc được trạng thái chặn");return}
    c.JSON(200,gin.H{"success":true,"blocked":blocked>0,"blockedBy":blockedBy>0})
}
func (a *App) blockUser(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    self:=userID(c)
    if id==self{fail(c,400,"Không thể tự chặn chính mình");return}
    tx,err:=a.DB.BeginTx(c.Request.Context(),nil)
    if err!=nil{fail(c,500,"Không bắt đầu được thao tác chặn");return}
    defer tx.Rollback()
    var exists int
    err=tx.QueryRowContext(c.Request.Context(),"SELECT id FROM TaiKhoan WHERE id=?",id).Scan(&exists)
    if errors.Is(err,sql.ErrNoRows){fail(c,404,"Tài khoản không tồn tại");return}
    if err!=nil{fail(c,500,"Không kiểm tra được tài khoản");return}
    if _,err=tx.ExecContext(c.Request.Context(),
        "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES(?,?) ON DUPLICATE KEY UPDATE created_at=created_at",
        self,id);err!=nil{fail(c,500,"Không chặn được tài khoản");return}
    // Blocking detaches follows in both directions; unblock does not restore follows.
    if _,err=tx.ExecContext(c.Request.Context(),
        "DELETE FROM follows WHERE (follower_id=? AND following_id=?) OR (follower_id=? AND following_id=?)",
        self,id,id,self);err!=nil{fail(c,500,"Không cập nhật được theo dõi");return}
    if err=tx.Commit();err!=nil{fail(c,500,"Không lưu được trạng thái chặn");return}
    c.JSON(200,gin.H{"success":true,"blocked":true})
}
func (a *App) unblockUser(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    if id==userID(c){fail(c,400,"Không thể tự bỏ chặn");return}
    _,err:=a.DB.ExecContext(c.Request.Context(),"DELETE FROM user_blocks WHERE blocker_id=? AND blocked_id=?",userID(c),id)
    if err!=nil{fail(c,500,"Không bỏ chặn được");return}
    c.JSON(200,gin.H{"success":true,"blocked":false})
}
func (a *App) listBlockedUsers(c *gin.Context){
    rows,err:=a.DB.QueryContext(c.Request.Context(),
        "SELECT u.id,u.tenDangNhap,COALESCE(u.avatar,'') FROM user_blocks b JOIN TaiKhoan u ON u.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC LIMIT 100",userID(c))
    if err!=nil{fail(c,500,"Không tải được danh sách đã chặn");return}
    defer rows.Close()
    result:=make([]gin.H,0)
    for rows.Next(){var id int;var name,avatar string
        if err:=rows.Scan(&id,&name,&avatar);err!=nil{fail(c,500,"Lỗi dữ liệu chặn");return}
        result=append(result,gin.H{"id":id,"tenDangNhap":name,"avatar":avatar})
    }
    if err:=rows.Err();err!=nil{fail(c,500,"Lỗi dữ liệu chặn");return}
    c.JSON(200,gin.H{"success":true,"data":result})
}

var reportReasons=map[string]bool{
    "spam":true,"harassment":true,"hate":true,"violence":true,"sexual":true,"misinformation":true,"other":true,
}
func validReportReason(reason string) bool {return reportReasons[reason]}

func (a *App) reportPost(c *gin.Context){
    id,ok:=intParam(c,"id");if !ok{return}
    if !a.requireView(c,id){return}
    var body struct {
        Reason string `json:"reason"`
        Details string `json:"details"`
    }
    if err:=c.ShouldBindJSON(&body);err!=nil{fail(c,400,"JSON không hợp lệ");return}
    body.Reason=strings.TrimSpace(body.Reason)
    body.Details=strings.TrimSpace(body.Details)
    if !validReportReason(body.Reason) || len([]rune(body.Details))>500 {
        fail(c,400,"Lý do hoặc mô tả báo cáo không hợp lệ");return
    }
    var author int
    var content string
    err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT idTaiKhoan,noiDung FROM BaiDang WHERE id=?",id).Scan(&author,&content)
    if errors.Is(err,sql.ErrNoRows){fail(c,404,"Không tìm thấy bài viết");return}
    if err!=nil{fail(c,500,"Không tải được bài viết");return}
    if author==userID(c){fail(c,400,"Không thể báo cáo bài viết của mình");return}
    // Store immutable evidence, visible to admins only. No automatic deletion.
    _,err=a.DB.ExecContext(c.Request.Context(),
        "INSERT INTO post_reports(post_id,reporter_id,reported_author_id,reason,details,content_snapshot) VALUES(?,?,?,?,?,?)",
        id,userID(c),author,body.Reason,body.Details,content)
    if err!=nil{
        var e *mysql.MySQLError
        if errors.As(err,&e) && e.Number==1062 {fail(c,409,"Bạn đã báo cáo bài viết này");return}
        if errors.As(err,&e) && e.Number==1452 {fail(c,404,"Bài viết vừa bị xóa");return}
        fail(c,500,"Không gửi được báo cáo");return
    }
    c.JSON(201,gin.H{"success":true,"message":"Đã gửi báo cáo đến quản trị viên"})
}
func (a *App) listReports(c *gin.Context){
    if !isAdmin(c){fail(c,403,"Chỉ quản trị viên được xem báo cáo");return}
    status:=strings.TrimSpace(c.DefaultQuery("status","pending"))
    if status!="pending"&&status!="dismissed"&&status!="actioned"&&status!="all" {
        fail(c,400,"Trạng thái báo cáo không hợp lệ");return
    }
    query:="SELECT r.id,r.post_id,r.reporter_id,r.reported_author_id,r.reason,r.details,r.content_snapshot,r.status,r.created_at,COALESCE(reporter.tenDangNhap,'(đã xóa)'),COALESCE(author.tenDangNhap,'(đã xóa)') "+
        "FROM post_reports r LEFT JOIN TaiKhoan reporter ON reporter.id=r.reporter_id "+
        "LEFT JOIN TaiKhoan author ON author.id=r.reported_author_id"
    args:=[]interface{}{}
    if status!="all" {query+=" WHERE r.status=?";args=append(args,status)}
    query+=" ORDER BY r.created_at DESC,r.id DESC LIMIT 100"
    rows,err:=a.DB.QueryContext(c.Request.Context(),query,args...)
    if err!=nil{fail(c,500,"Không tải được báo cáo");return}
    defer rows.Close()
    items:=make([]gin.H,0)
    for rows.Next(){
        var id int64;var postID sql.NullInt64;var reporterID,authorID int
        var reason,details,snapshot,state,reporterName,authorName string;var created time.Time
        if err:=rows.Scan(&id,&postID,&reporterID,&authorID,&reason,&details,&snapshot,&state,&created,&reporterName,&authorName);err!=nil{
            fail(c,500,"Lỗi dữ liệu báo cáo");return
        }
        var postValue interface{}
        if postID.Valid {postValue=postID.Int64}
        items=append(items,gin.H{"id":id,"postId":postValue,"reporterId":reporterID,
            "authorId":authorID,"reason":reason,"details":details,"snapshot":snapshot,
            "status":state,"createdAt":created.Format(time.RFC3339),
            "reporterName":reporterName,"authorName":authorName})
    }
    if rows.Err()!=nil{fail(c,500,"Lỗi đọc báo cáo");return}
    c.JSON(200,gin.H{"success":true,"data":items})
}
func (a *App) reviewReport(c *gin.Context){
    if !isAdmin(c){fail(c,403,"Chỉ quản trị viên được xử lý báo cáo");return}
    id,ok:=intParam(c,"id");if !ok{return}
    var body struct{Status string `json:"status"`}
    if err:=c.ShouldBindJSON(&body);err!=nil{fail(c,400,"JSON không hợp lệ");return}
    if body.Status!="dismissed"&&body.Status!="actioned"{fail(c,400,"Trạng thái xử lý không hợp lệ");return}
    res,err:=a.DB.ExecContext(c.Request.Context(),
        "UPDATE post_reports SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=? AND status='pending'",
        body.Status,userID(c),id)
    if err!=nil{fail(c,500,"Không xử lý được báo cáo");return}
    affected,_:=res.RowsAffected()
    if affected==0 {
        var exists int
        err=a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM post_reports WHERE id=?",id).Scan(&exists)
        if errors.Is(err,sql.ErrNoRows){fail(c,404,"Báo cáo không tồn tại");return}
        fail(c,409,"Báo cáo đã được xử lý hoặc không hợp lệ");return
    }
    // "actioned" records moderation outcome; deletion remains a separate, explicit admin action.
    c.JSON(200,gin.H{"success":true,"status":body.Status})
}
