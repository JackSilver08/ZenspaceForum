package httpapi

import (
    "database/sql"
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
func corsMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Access-Control-Allow-Origin", "*")
        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
        c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, Accept, Cache-Control, X-Requested-With")
        c.Header("Access-Control-Expose-Headers", "Content-Length")
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }
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
    r := gin.New()
    r.Use(gin.Logger(), gin.Recovery(), corsMiddleware())
    r.SetTrustedProxies(nil)
    r.GET("/hello", func(c *gin.Context){ c.String(200, "Server đang hoạt động tại ZenSpace!") })
    r.GET("/healthz", func(c *gin.Context) {
        if err := a.DB.PingContext(c.Request.Context()); err != nil { fail(c, 503, "Database unavailable"); return }
        c.JSON(200, gin.H{"status":"ok"})
    })
    r.Static("/uploads", a.UploadDir)

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

    secured := api.Group("/")
    secured.Use(a.auth)
    secured.POST("/baiviet", a.createPost)
    secured.PUT("/baiviet/:id", a.updatePost)
    secured.DELETE("/baiviet/:id", a.deletePost)
    secured.POST("/binhluan", a.addComment)
    secured.DELETE("/binhluan/:id", a.deleteComment)
    secured.DELETE("/binhluan/xoa/:id", a.deleteComment)
    secured.POST("/camxuc/:id", a.react)
    secured.DELETE("/camxuc/:id", a.unreact)
    secured.POST("/nguoidung/:id/avatar", a.avatar)
    secured.DELETE("/xoataikhoan/:id", a.deleteAccount)
    secured.DELETE("/nguoidung/:id", a.deleteAccount)
    secured.POST("/chat/gui", a.sendMessage)
    secured.GET("/chat/lichsu/:id1/:id2", a.chatHistory)
    secured.GET("/v1/feed", a.feed)
    secured.POST("/v1/users/:id/follow", a.follow)
    secured.DELETE("/v1/users/:id/follow", a.unfollow)
    secured.GET("/v1/users/:id/follow-status", a.followStatus)
    return r
}
