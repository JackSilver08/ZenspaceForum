package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
)

const (
	defaultAvatar = "IMG/ZenUser.png"
)

// Cấu trúc dữ liệu cho đăng ký
type YeuCauDangKy struct {
	TenDangNhap string `json:"username"`
	Email       string `json:"email"`
	MatKhau     string `json:"password"`
	XacNhanMK   string `json:"confirmPassword"`
}

func DangKy(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Chỉ chấp nhận POST", http.StatusMethodNotAllowed)
		return
	}

	var req YeuCauDangKy
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Lỗi khi đọc dữ liệu", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.TenDangNhap == "" || req.Email == "" || req.MatKhau == "" {
		json.NewEncoder(w).Encode(PhanHoi{
			ThanhCong: false,
			ThongBao:  "Vui lòng điền đầy đủ thông tin",
		})
		return
	}

	if req.MatKhau != req.XacNhanMK {
		json.NewEncoder(w).Encode(PhanHoi{
			ThanhCong: false,
			ThongBao:  "Mật khẩu xác nhận không khớp",
		})
		return
	}

	db, err := sql.Open("mysql", databaseDSN(true))
	if err != nil {
		http.Error(w, "Không thể kết nối database", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// Kiểm tra tài khoản tồn tại
	var exists int
	err = db.QueryRow(`
        SELECT COUNT(*) FROM TaiKhoan 
        WHERE tenDangNhap = ? OR email = ?
    `, req.TenDangNhap, req.Email).Scan(&exists)

	if err != nil {
		json.NewEncoder(w).Encode(PhanHoi{
			ThanhCong: false,
			ThongBao:  "Lỗi kiểm tra tài khoản: " + err.Error(),
		})
		return
	}

	if exists > 0 {
		json.NewEncoder(w).Encode(PhanHoi{
			ThanhCong: false,
			ThongBao:  "Tên đăng nhập hoặc email đã tồn tại",
		})
		return
	}

	// Thêm tài khoản mới với avatar mặc định
	res, err := db.Exec(`
        INSERT INTO TaiKhoan 
        (tenDangNhap, email, matKhau, avatar) 
        VALUES (?, ?, ?, ?)`,
		req.TenDangNhap,
		req.Email,
		req.MatKhau,
		defaultAvatar, // Avatar mặc định
	)

	if err != nil {
		json.NewEncoder(w).Encode(PhanHoi{
			ThanhCong: false,
			ThongBao:  "Lỗi khi tạo tài khoản: " + err.Error(),
		})
		return
	}

	id, _ := res.LastInsertId()

	// Tạo token ngay sau khi đăng ký thành công
	tokenString, err := generateJWTToken(int(id), req.TenDangNhap, "user")
	if err != nil {
		json.NewEncoder(w).Encode(PhanHoi{
			ThanhCong: false,
			ThongBao:  "Lỗi tạo token: " + err.Error(),
		})
		return
	}

	// Trả về thông tin user và token
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Đăng ký thành công",
		"token":   tokenString,
		"user": map[string]interface{}{
			"id":          id,
			"tenDangNhap": req.TenDangNhap,
			"email":       req.Email,
			"avatar":      defaultAvatar,
			"phanQuyen":   "user",
		},
	})
}

// Hàm tạo JWT token
func generateJWTToken(id int, username string, role string) (string, error) {
	claims := jwt.MapClaims{
		"id":          id,
		"tenDangNhap": username,
		"phanQuyen":   role,
		"exp":         time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}

func LayThongTinNguoiDung(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Chỉ chấp nhận GET", http.StatusMethodNotAllowed)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	db, err := sql.Open("mysql", databaseDSN(true))
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Database connection error",
		})
		return
	}
	defer db.Close()

	// Sử dụng sql.NullString cho trường avatar có thể NULL
	var user struct {
		ID          int
		TenDangNhap string
		Email       string
		PhanQuyen   string
		NgayTao     sql.NullTime
		Avatar      sql.NullString
	}

	err = db.QueryRow(`
    SELECT 
        id, 
        tenDangNhap, 
        email, 
        phanQuyen, 
        ngayTao, 
        avatar 
    FROM TaiKhoan 
    WHERE id = ?`, id).Scan(
		&user.ID,
		&user.TenDangNhap,
		&user.Email,
		&user.PhanQuyen,
		&user.NgayTao,
		&user.Avatar,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "User not found",
			})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "Database query error: " + err.Error(),
			})
		}
		return
	}

	// Xử lý các trường NULL
	avatar := "IMG/ZenUser.png"
	if user.Avatar.Valid {
		avatar = user.Avatar.String
	}

	ngayTao := ""
	if user.NgayTao.Valid {
		ngayTao = user.NgayTao.Time.Format(time.RFC3339)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"user": map[string]interface{}{
				"id":          user.ID,
				"tenDangNhap": user.TenDangNhap,
				"email":       user.Email,
				"phanQuyen":   user.PhanQuyen,
				"ngayTao":     ngayTao,
				"avatar":      avatar,
			},
		},
	})
}

// ĐĂNG NHẬP
var jwtKey = []byte("your-secret-key")

// Cấu trúc để nhận dữ liệu JSON từ client
type YeuCauDangNhap struct {
	TenDangNhap string `json:"TenDangNhap"`
	MatKhau     string `json:"MatKhau"`
}

type PhanHoi struct {
	ThanhCong bool        `json:"success"`
	ThongBao  string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
}

func DangNhap(w http.ResponseWriter, r *http.Request) {
	// Headers cho CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Chỉ chấp nhận POST", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TenDangNhap string `json:"TenDangNhap"`
		MatKhau     string `json:"MatKhau"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	db, err := sql.Open("mysql", databaseDSN(false))
	if err != nil {
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	var user struct {
		ID        int
		MatKhau   string
		Avatar    sql.NullString
		PhanQuyen string
	}

	err = db.QueryRow(`
        SELECT 
            id, 
            matKhau,
            avatar,
            phanQuyen
        FROM TaiKhoan 
        WHERE tenDangNhap = ?`, req.TenDangNhap).Scan(
		&user.ID,
		&user.MatKhau,
		&user.Avatar,
		&user.PhanQuyen,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "Invalid username or password",
			})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "Database error: " + err.Error(),
			})
		}
		return
	}

	if user.MatKhau != req.MatKhau {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Invalid username or password",
		})
		return
	}

	// Xử lý avatar
	avatar := "IMG/ZenUser.png"
	if user.Avatar.Valid && user.Avatar.String != "" {
		avatar = user.Avatar.String
	}

	// Tạo token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":          user.ID,
		"tenDangNhap": req.TenDangNhap,
		"phanQuyen":   user.PhanQuyen,
		"exp":         time.Now().Add(24 * time.Hour).Unix(),
	})

	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   tokenString,
		"user": map[string]interface{}{
			"id":          user.ID,
			"tenDangNhap": req.TenDangNhap,
			"avatar":      avatar,
			"phanQuyen":   user.PhanQuyen,
		},
	})
}
