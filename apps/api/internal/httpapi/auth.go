package httpapi

import (
    "database/sql"
    "net/http"

    "github.com/gin-gonic/gin"
    "golang.org/x/crypto/bcrypt"
)

func (a *App) register(c *gin.Context) {
    var body map[string]interface{}
    if err := c.ShouldBindJSON(&body); err != nil { fail(c, 400, "Dữ liệu không hợp lệ"); return }
    username := textVal(body, "username", "tenDangNhap")
    email := textVal(body, "email")
    password := rawTextVal(body, "password", "matKhau")
    confirm := rawTextVal(body, "confirmPassword")
    if username == "" || email == "" || len(password) < 8 || password != confirm {
        fail(c, 400, "Thông tin đăng ký không hợp lệ (mật khẩu tối thiểu 8 ký tự)"); return
    }
    hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil { fail(c, 500, "Không thể đăng ký"); return }
    res, err := a.DB.ExecContext(c.Request.Context(), "INSERT INTO TaiKhoan(tenDangNhap,email,matKhau,avatar,phanQuyen) VALUES(?,?,?,?,?)", username, email, string(hash), "/IMG/ZenUser.png", "user")
    if err != nil { fail(c, http.StatusConflict, "Tên đăng nhập hoặc email đã tồn tại"); return }
    id64, _ := res.LastInsertId()
    token, err := a.issueToken(int(id64), username, "user")
    if err != nil { fail(c, 500, "Không thể tạo phiên đăng nhập"); return }
    c.JSON(201, gin.H{"success":true,"token":token,"user":gin.H{"id":id64,"tenDangNhap":username,"email":email,"avatar":"/IMG/ZenUser.png","phanQuyen":"user"}})
}
func (a *App) login(c *gin.Context) {
    var body map[string]interface{}
    if err := c.ShouldBindJSON(&body); err != nil { fail(c, 400, "Dữ liệu không hợp lệ"); return }
    username := textVal(body, "TenDangNhap", "username", "tenDangNhap", "email")
    password := rawTextVal(body, "MatKhau", "password", "matKhau")
    var id int
    var stored, name, role, avatar string
    err := a.DB.QueryRowContext(c.Request.Context(), "SELECT id,tenDangNhap,matKhau,COALESCE(avatar,''),COALESCE(phanQuyen,'user') FROM TaiKhoan WHERE tenDangNhap=? OR email=?", username, username).Scan(&id,&name,&stored,&avatar,&role)
    if err != nil {
        if err != sql.ErrNoRows { fail(c, 500, "Database error"); return }
        fail(c, 401, "Sai tài khoản hoặc mật khẩu"); return
    }
    if err := bcrypt.CompareHashAndPassword([]byte(stored), []byte(password)); err != nil {
        // One-time migration of existing local demo accounts; never overwrite hashes.
        if len(stored) >= 4 && (stored[:4] == "$2a$" || stored[:4] == "$2b$") {
            fail(c, 401, "Sai tài khoản hoặc mật khẩu"); return
        }
        if stored != password { fail(c, 401, "Sai tài khoản hoặc mật khẩu"); return }
        hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
        if err != nil { fail(c, 500, "Không thể xử lý mật khẩu"); return }
        if _, err := a.DB.ExecContext(c.Request.Context(), "UPDATE TaiKhoan SET matKhau=? WHERE id=? AND matKhau=?", string(hash), id, stored); err != nil {
            fail(c, 500, "Không thể nâng cấp bảo mật tài khoản"); return
        }
    }
    token, err := a.issueToken(id,name,role)
    if err != nil { fail(c, 500, "Không thể tạo phiên"); return }
    if avatar == "" { avatar = "/IMG/ZenUser.png" }
    c.JSON(200, gin.H{"success":true,"token":token,"user":gin.H{"id":id,"tenDangNhap":name,"avatar":avatar,"phanQuyen":role}})
}
