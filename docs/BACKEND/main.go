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



var DB *sql.DB  // ✅ Chỉ giữ ở đây
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
    var err error

    dsn := "root:Tuan@1234@tcp(db:3306)/ZenSpaceDB?parseTime=true"
    log.Println("📡 DSN:", dsn)

    DB, err = sql.Open("mysql", dsn)
    if err != nil {
        log.Fatal("❌ Không thể mở kết nối MySQL:", err)
    }

    if err = DB.Ping(); err != nil {
        log.Fatal("❌ Không thể ping tới MySQL:", err)
    }

    log.Println("✅ Kết nối MySQL thành công!")

    // Thiết lập cấu hình kết nối
    DB.SetConnMaxLifetime(5 * time.Minute)
    DB.SetMaxIdleConns(10)
    DB.SetMaxOpenConns(100)

    // Khởi tạo router chính và middleware CORS
    router := mux.NewRouter()
    router.Use(enableCORS)

    // ============================
    // 📁 Public routes
    // ============================

    router.HandleFunc("/", handler)
    router.HandleFunc("/hello", Hello).Methods("GET", "OPTIONS")
    router.HandleFunc("/DangNhap", DangNhap).Methods("POST", "OPTIONS")
    router.HandleFunc("/DangKy", DangKy).Methods("POST", "OPTIONS")

    // 🖼 Phục vụ ảnh avatar
    router.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))))

    // ============================
    // 📦 API routes (prefix /api)
    // ============================

    api := router.PathPrefix("/api").Subrouter()

    // Người dùng
    api.HandleFunc("/nguoidung/{id}", LayThongTinNguoiDung).Methods("GET", "OPTIONS")
    api.HandleFunc("/nguoidung/{id}/avatar", DoiAvatarHandler).Methods("POST", "OPTIONS")
    api.HandleFunc("/nguoidung/trangcanhan/{id}", TrangCaNhanHandler)
    api.HandleFunc("/xoataikhoan/{id}", XoaTaiKhoanHandler).Methods("DELETE", "OPTIONS")
    api.HandleFunc("/timkiemnguoidung", TimKiemNguoiDung).Methods("GET", "OPTIONS")

    // Bài đăng
    api.HandleFunc("/baiviet", LayBaiDang).Methods("GET", "OPTIONS")
    api.HandleFunc("/baiviet", DangBai).Methods("POST", "OPTIONS")
    api.HandleFunc("/baiviet/{id}", LayChiTietBaiDang).Methods("GET", "OPTIONS")
    api.HandleFunc("/baiviet/{id}", SuaBaiDang).Methods("PUT", "OPTIONS")
    api.HandleFunc("/baiviet/{id}", XoaBaiDang).Methods("DELETE", "OPTIONS")

    // Bình luận
    api.HandleFunc("/binhluan", ThemBinhLuan).Methods("POST", "OPTIONS")
    api.HandleFunc("/binhluan/{id}", LayBinhLuanTheoBaiDang).Methods("GET", "OPTIONS")
    api.HandleFunc("/binhluan/xoa/{id}", XoaBinhLuan).Methods("DELETE", "OPTIONS")

    // Cảm xúc
    api.HandleFunc("/camxuc/{idBaiDang}", ThemCamXuc).Methods("POST", "OPTIONS")
    api.HandleFunc("/camxuc/thongke/{idBaiDang}", ThongKeCamXuc).Methods("GET", "OPTIONS")

    // Chat
    api.HandleFunc("/chat/gui", GuiTinNhanHandler).Methods("POST", "OPTIONS")
    api.HandleFunc("/chat/lichsu/{id1}/{id2}", LayLichSuTinNhanHandler).Methods("GET", "OPTIONS")

    // ============================
    // 🌐 Tệp tĩnh HTML/JS/CSS
    // ============================
    router.PathPrefix("/").Handler(http.FileServer(http.Dir("./docs/"))) // ⚠️ đặt sau cùng

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
