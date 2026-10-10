package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
)

var DB *sql.DB // ✅ Chỉ giữ ở đây
func responseError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"message": message,
	})
}

func validateToken(r *http.Request) (*jwt.Token, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, errors.New("authorization header missing")
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return nil, errors.New("authorization header format must be Bearer {token}")
	}

	tokenString := parts[1]

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtKey, nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return token, nil
}

func init() {

}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization") // ✅ thêm Authorization

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func Hello(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Nếu là preflight request (OPTIONS)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Nội dung trả về
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprint(w, "Server đang hoạt động tại ZenSpace!")
}

func handler(w http.ResponseWriter, r *http.Request) {
	// Cho phép gọi từ bất kỳ nơi đâu (chỉ dùng khi phát triển)
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Cho phép các phương thức bạn cần
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")

	// Cho phép header bạn cần (nếu có)
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	// Nếu đây là preflight OPTIONS request thì trả về ngay
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	fmt.Fprintf(w, "Server đang chạy tại cổng 8080, %s", r.URL.Path[1:])
}

func main() {
	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET is required and must contain at least 32 characters. Start the app with START.bat to generate a local secret.")
	}
	jwtKey = []byte(jwtSecret)

	var err error

	// Kết nối MySQL bằng cấu hình môi trường (không ghi mật khẩu ra log).
	log.Println("📡 Đang kết nối tới MySQL...")
	DB, err = sql.Open("mysql", databaseDSN(true))
	if err != nil {
		log.Fatal("❌ Không thể mở kết nối MySQL:", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal("❌ Không thể ping tới MySQL:", err)
	}

	log.Println("✅ Kết nối MySQL thành công!")

	DB.SetConnMaxLifetime(5 * time.Minute)
	DB.SetMaxIdleConns(10)
	DB.SetMaxOpenConns(100)

	// Khởi tạo router
	router := mux.NewRouter()
	router.Use(enableCORS)

	// ============================
	// 📦 API routes (prefix /api)
	// ============================
	router.HandleFunc("/api/DangNhap", DangNhap).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/DangKy", DangKy).Methods("POST", "OPTIONS")

	router.HandleFunc("/api/nguoidung/{id}", LayThongTinNguoiDung).Methods("GET", "OPTIONS")
	router.HandleFunc("/api/nguoidung/{id}/avatar", DoiAvatarHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/nguoidung/trangcanhan/{id}", TrangCaNhanHandler)
	router.HandleFunc("/api/xoataikhoan/{id}", XoaTaiKhoanHandler).Methods("DELETE", "OPTIONS")
	router.HandleFunc("/api/timkiemnguoidung", TimKiemNguoiDung).Methods("GET", "OPTIONS")

	router.HandleFunc("/api/baiviet", LayBaiDang).Methods("GET", "OPTIONS")
	router.HandleFunc("/api/baiviet", DangBai).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/baiviet/{id}", LayChiTietBaiDang).Methods("GET", "OPTIONS")
	router.HandleFunc("/api/baiviet/{id}", SuaBaiDang).Methods("PUT", "OPTIONS")
	router.HandleFunc("/api/baiviet/{id}", XoaBaiDang).Methods("DELETE", "OPTIONS")

	router.HandleFunc("/api/binhluan", ThemBinhLuan).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/binhluan/{id}", LayBinhLuanTheoBaiDang).Methods("GET", "OPTIONS")
	router.HandleFunc("/api/binhluan/xoa/{id}", XoaBinhLuan).Methods("DELETE", "OPTIONS")

	router.HandleFunc("/api/camxuc/{idBaiDang}", ThemCamXuc).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/camxuc/thongke/{idBaiDang}", ThongKeCamXuc).Methods("GET", "OPTIONS")

	router.HandleFunc("/api/chat/gui", GuiTinNhanHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/chat/lichsu/{id1}/{id2}", LayLichSuTinNhanHandler).Methods("GET", "OPTIONS")

	// ============================
	// 📁 Public Routes
	// ============================
	router.HandleFunc("/", handler)
	router.HandleFunc("/hello", Hello).Methods("GET", "OPTIONS")

	// 🖼 Phục vụ ảnh avatar
	router.PathPrefix("/uploads/").Handler(
		http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))),
	)

	// ============================
	// 🌐 Tệp tĩnh HTML/JS/CSS fallback
	// ============================
	router.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"success":false,"message":"Không tìm thấy API"}`))
	})

	// ============================
	// 🏁 Khởi chạy server
	// ============================
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server đang chạy tại cổng %s...\n", port)
	if err := http.ListenAndServe(":"+port, router); err != nil {
		log.Fatal("❌ Không thể khởi động server:", err)
	}
}
