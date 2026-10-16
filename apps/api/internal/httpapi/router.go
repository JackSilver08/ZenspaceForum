package httpapi

import (
    "database/sql"
    "encoding/json"
    "math"
    "os"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
    "github.com/redis/go-redis/v9"
)

type App struct {
    DB *sql.DB
    Redis *redis.Client
    Secret []byte
    UploadDir string
    hub *chatHub
}

func fail(c *gin.Context, status int, message string) {
    c.JSON(status, gin.H{"success": false, "message": message})
}
func intParam(c *gin.Context, name string) (int, bool) {
    n, err := strconv.Atoi(c.Param(name))
    if err != nil || n < 1 { fail(c, http.StatusBadRequest, "ID không hợp lệ"); return 0, false }
    return n, true
}
func textVal(m map[string]interface{}, names ...string) string {
    for _, name := range names { if v, ok := m[name].(string); ok { return strings.TrimSpace(v) } }
    return ""
}
func rawTextVal(m map[string]interface{}, names ...string) string {
    for _, name := range names { if v, ok := m[name].(string); ok { return v } }
    return ""
}
func parsePositiveID(value interface{}) (int, bool) {
    switch v := value.(type) {
    case float64:
        if math.IsNaN(v) || math.IsInf(v,0) || v<1 || v>9007199254740991 || math.Trunc(v)!=v {return 0,false}
        return int(v),true
    case int:
        return v,v>0
    case int64:
        if v<1 || v>9007199254740991 {return 0,false}
        return int(v),true
    case json.Number:
        n,err:=strconv.Atoi(v.String());return n,err==nil && n>0
    case string:
        n,err:=strconv.Atoi(strings.TrimSpace(v));return n,err==nil && n>0
    default:
        return 0,false
    }
}
func corsMiddleware(allowed []string) gin.HandlerFunc {
    origins:=map[string]bool{}
    for _,value:=range allowed {
        if origin:=strings.TrimSpace(value);origin!="" {origins[origin]=true}
    }
    return func(c *gin.Context) {
        origin:=c.GetHeader("Origin")
        if origin=="" {c.Next();return}
        c.Header("Vary","Origin")
        if !origins[origin] {
            if c.Request.Method==http.MethodOptions {c.AbortWithStatus(http.StatusForbidden);return}
            c.Next();return
        }
        c.Header("Access-Control-Allow-Origin",origin)
        c.Header("Access-Control-Allow-Methods","GET, POST, PUT, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers","Authorization, Content-Type, Accept")
        c.Header("Access-Control-Max-Age","600")
        if c.Request.Method==http.MethodOptions {c.AbortWithStatus(http.StatusNoContent);return}
        c.Next()
    }
}
func (a *App) issueToken(id int, username, role string) (string, error) {
    claims := jwt.MapClaims{"id": id, "tenDangNhap": username, "phanQuyen": role, "exp": time.Now().Add(24*time.Hour).Unix()}
    return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(a.Secret)
}
func (a *App) auth(c *gin.Context) {
    parts := strings.SplitN(c.GetHeader("Authorization"), " ", 2)
    if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") { fail(c, 401, "Missing bearer token"); c.Abort(); return }
    token, err := jwt.Parse(parts[1], func(t *jwt.Token) (interface{},error) {
        if t.Method != jwt.SigningMethodHS256 { return nil, jwt.ErrTokenSignatureInvalid }
        return a.Secret, nil
    })
    if err != nil || !token.Valid { fail(c, 401, "Invalid or expired token"); c.Abort(); return }
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok { fail(c, 401, "Invalid claims"); c.Abort(); return }
    f, ok := claims["id"].(float64)
    if !ok || f <= 0 { fail(c, 401, "Invalid user"); c.Abort(); return }
    var role string
    err = a.DB.QueryRowContext(c.Request.Context(), "SELECT phanQuyen FROM TaiKhoan WHERE id = ?", int(f)).Scan(&role)
    if err != nil { fail(c, 401, "User no longer exists"); c.Abort(); return }
    c.Set("userID", int(f))
    c.Set("role", role)
    c.Next()
}
func userID(c *gin.Context) int { n, _ := c.Get("userID"); id, _ := n.(int); return id }
func isAdmin(c *gin.Context) bool { role, _ := c.Get("role"); return role == "admin" }

func (a *App) Router() *gin.Engine {
    a.hub = newChatHub()
    r := gin.New()
    allowedOrigins:=[]string{"http://localhost:5173","http://127.0.0.1:5173"}
    if configured:=strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"));configured!="" {allowedOrigins=strings.Split(configured,",")}
    r.Use(gin.Logger(), gin.Recovery(), corsMiddleware(allowedOrigins))
    r.SetTrustedProxies(nil)
    r.GET("/hello", func(c *gin.Context){ c.String(200, "Server đang hoạt động tại ZenSpace!") })
    r.GET("/healthz", func(c *gin.Context) {
        if err := a.DB.PingContext(c.Request.Context()); err != nil { fail(c, 503, "Database unavailable"); return }
        c.JSON(200, gin.H{"status":"ok"})
    })
    r.GET("/uploads/*filepath", a.serveUpload)

    api := r.Group("/api")
    api.POST("/DangKy", a.register)
    api.POST("/DangNhap", a.login)
    api.GET("/baiviet", a.listPosts)
    api.GET("/baiviet/:id", a.getPost)
    api.GET("/binhluan/:id", a.listComments)
    api.GET("/camxuc/thongke/:id", a.reactionStats)
    api.GET("/nguoidung/:id", a.getUser)
    api.GET("/nguoidung/trangcanhan/:id", a.profile)
    api.GET("/timkiemnguoidung", a.searchUsers)
    api.GET("/chat/ws", a.chatWebSocket)

    secured := api.Group("/")
    secured.Use(a.auth)
    secured.PATCH("/v1/posts/:id/visibility",a.changeVisibility)
    secured.PUT("/v1/posts/:id/archive",a.archivePost)
    secured.DELETE("/v1/posts/:id/archive",a.unarchivePost)
    secured.GET("/v1/me/posts/:state",a.listManagedPosts)
    secured.POST("/v1/posts/:id/restore",a.restorePost)
    secured.DELETE("/v1/posts/:id/permanent",a.permanentlyDeletePost)
    secured.GET("/v1/posts/:id/history",a.postHistory)
    secured.POST("/v1/posts/:id/revisions/:revision/restore",a.restoreRevision)
    secured.POST("/baiviet", a.createPost)
    secured.PUT("/baiviet/:id", a.updatePost)
    secured.DELETE("/baiviet/:id", a.trashPost)
    secured.POST("/binhluan", a.addComment)
    secured.PUT("/binhluan/:id", a.updateComment)
    secured.PUT("/binhluan/:id/like", a.likeComment)
    secured.DELETE("/binhluan/:id/like", a.unlikeComment)
    secured.DELETE("/binhluan/:id", a.deleteComment)
    secured.DELETE("/binhluan/xoa/:id", a.deleteComment)
    secured.GET("/camxuc/cua-toi", a.myReactions)
    secured.POST("/camxuc/:id", a.react)
    secured.DELETE("/camxuc/:id", a.unreact)
    secured.POST("/nguoidung/:id/avatar", a.avatar)
    secured.DELETE("/xoataikhoan/:id", a.deleteAccount)
    secured.DELETE("/nguoidung/:id", a.deleteAccount)
    secured.POST("/chat/gui", a.sendMessage)
    secured.GET("/chat/lichsu/:id1/:id2", a.chatHistory)
    secured.GET("/chat/inbox", a.chatInbox)
    secured.GET("/v1/feed/public", a.personalizedPublicFeed)
    secured.GET("/v1/feed", a.feed)
    secured.GET("/v1/posts/my-state", a.myPostState)
    secured.GET("/v1/bookmarks", a.myBookmarks)
    secured.PUT("/v1/posts/:id/bookmark", a.setBookmark)
    secured.DELETE("/v1/posts/:id/bookmark", a.removeBookmark)
    secured.PUT("/v1/posts/:id/hide", a.hidePost)
    secured.DELETE("/v1/posts/:id/hide", a.unhidePost)
    secured.PUT("/v1/posts/:id/pin", a.pinPost)
    secured.DELETE("/v1/posts/:id/pin", a.unpinPost)
    secured.GET("/v1/users/blocks", a.listBlockedUsers)
    secured.GET("/v1/users/:id/block-status", a.blockStatus)
    secured.PUT("/v1/users/:id/block", a.blockUser)
    secured.DELETE("/v1/users/:id/block", a.unblockUser)
    secured.POST("/v1/posts/:id/report", a.reportPost)
    secured.PUT("/v1/posts/:id/comments", a.setCommentsEnabled)
    secured.GET("/v1/moderation/reports", a.listReports)
    secured.PUT("/v1/moderation/reports/:id", a.reviewReport)
    secured.POST("/v1/users/:id/follow", a.follow)
    secured.DELETE("/v1/users/:id/follow", a.unfollow)
    secured.GET("/v1/users/:id/follow-status", a.followStatus)
    return r
}
