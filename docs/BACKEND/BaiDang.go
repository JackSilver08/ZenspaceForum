package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	redisv9 "github.com/redis/go-redis/v9"
)

var ctx = context.Background()

var redisClient = redisv9.NewClient(&redisv9.Options{
	Addr:     envOrDefault("REDIS_ADDR", "localhost:6379"),
	Password: "",
	DB:       0,
})

type BaiDang struct {
	TieuDe     string `json:"tieuDe"`
	NoiDung    string `json:"noiDung"`
	IDTaiKhoan int    `json:"idTaiKhoan"`
}

// func renderMarkdown(input string) string {
// 	output := markdown.ToHTML([]byte(input), nil, html.NewRenderer(html.RendererOptions{
// 		Flags: html.CommonFlags | html.HrefTargetBlank,
// 	}))

// 	policy := bluemonday.UGCPolicy()
// 	safe := policy.SanitizeBytes(output)

// 	return string(safe)
// }

// ========== Đăng bài ==========
func DangBai(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		responseError(w, http.StatusMethodNotAllowed, "Chỉ hỗ trợ POST")
		return
	}

	token, err := validateToken(r)
	if err != nil {
		responseError(w, http.StatusUnauthorized, "Unauthorized: "+err.Error())
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		responseError(w, http.StatusUnauthorized, "Unauthorized: Invalid claims")
		return
	}

	idFloat, ok := claims["id"].(float64)
	if !ok {
		responseError(w, http.StatusUnauthorized, "Unauthorized: Không tìm thấy ID người dùng")
		return
	}
	idTaiKhoan := int(idFloat)

	var tieuDe, noiDung, mediaUrl string
	mediaUrl = ""

	// Thử parse multipart (nếu là form có file)
	if err := r.ParseMultipartForm(10 << 20); err == nil {
		// 👉 Nếu parse multipart thành công → đọc từ form
		tieuDe = r.FormValue("tieuDe")
		noiDung = r.FormValue("noiDung")

		file, handler, err := r.FormFile("file")
		if err == nil {
			defer file.Close()
			fileExt := filepath.Ext(handler.Filename)
			fileName := fmt.Sprintf("post_%d_%d%s", idTaiKhoan, time.Now().UnixNano(), fileExt)
			savePath := filepath.Join("uploads", "posts", fileName)

			out, err := os.Create(savePath)
			if err != nil {
				responseError(w, http.StatusInternalServerError, "Không lưu được file")
				return
			}
			defer out.Close()
			io.Copy(out, file)
			mediaUrl = "/uploads/posts/" + fileName
		}

	} else {
		// 👉 Nếu KHÔNG phải multipart → thử đọc JSON
		var payload struct {
			TieuDe  string `json:"TieuDe"`
			NoiDung string `json:"NoiDung"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			responseError(w, http.StatusBadRequest, "Không đọc được form: "+err.Error())
			return
		}
		tieuDe = payload.TieuDe
		noiDung = payload.NoiDung
	}

	// Chèn vào CSDL
	stmt := `INSERT INTO BaiDang (tieuDe, noiDung, idTaiKhoan, ngayTao, mediaUrl) VALUES (?, ?, ?, ?, ?)`
	if _, err := DB.ExecContext(ctx, stmt, tieuDe, noiDung, idTaiKhoan, time.Now(), mediaUrl); err != nil {
		log.Println("❌ Lỗi ghi DB:", err)
		responseError(w, http.StatusInternalServerError, "Không thể lưu bài viết vào DB")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success":  true,
		"message":  "Đăng bài thành công",
		"mediaUrl": mediaUrl,
	})
}

// ========== Lấy tất cả bài đăng ==========
func LayBaiDang(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{
			"success": false,
			"message": "Chỉ hỗ trợ GET",
		})
		return
	}

	rows, err := DB.QueryContext(ctx, `
    SELECT b.id, b.tieuDe, b.noiDung, b.idTaiKhoan, t.tenDangNhap, b.ngayTao, b.mediaUrl
    FROM BaiDang b
    JOIN TaiKhoan t ON b.idTaiKhoan = t.id
    ORDER BY b.ngayTao DESC`)
	if err != nil {
		log.Println("❌ Lỗi truy vấn CSDL:", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"message": "Không thể lấy bài viết từ CSDL",
		})
		return
	}
	defer rows.Close()

	var danhSach []map[string]interface{}
	for rows.Next() {
		var id, idTaiKhoan int
		var tieuDe, noiDung, tenDangNhap string
		var mediaUrl sql.NullString
		var ngayTao time.Time

		if err := rows.Scan(&id, &tieuDe, &noiDung, &idTaiKhoan, &tenDangNhap, &ngayTao, &mediaUrl); err != nil {
			log.Println("⚠️ Lỗi đọc hàng:", err)
			continue
		}

		danhSach = append(danhSach, map[string]interface{}{
			"id":          id,
			"tieuDe":      tieuDe,
			"noiDung":     noiDung,
			"idTaiKhoan":  idTaiKhoan,
			"tenDangNhap": tenDangNhap,
			"ngayDang":    ngayTao.Format("02/01/2006 15:04"),
			"mediaUrl":    "", // mặc định là rỗng
		})

		// Nếu có mediaUrl hợp lệ thì gán lại:
		if mediaUrl.Valid {
			danhSach[len(danhSach)-1]["mediaUrl"] = mediaUrl.String
		}

	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    danhSach,
	})

}

// ========== Lấy chi tiết bài đăng ==========
func LayChiTietBaiDang(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	w.Header().Set("Content-Type", "application/json")
	ctx := context.Background() // thêm dòng này

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		responseError(w, http.StatusMethodNotAllowed, "Chỉ hỗ trợ phương thức GET")
		return
	}

	idStr := mux.Vars(r)["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		responseError(w, http.StatusBadRequest, "ID không hợp lệ")
		return
	}

	var tieuDe, noiDung string
	var mediaUrl sql.NullString
	var idTaiKhoan int
	var ngayTao time.Time // SỬA: Đổi tên biến

	// SỬA: Đổi ngayDang thành ngayTao trong query
	err = DB.QueryRowContext(ctx,
		`SELECT tieuDe, noiDung, idTaiKhoan, ngayTao, mediaUrl FROM BaiDang WHERE id = ?`, id).
		Scan(&tieuDe, &noiDung, &idTaiKhoan, &ngayTao, &mediaUrl)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			responseError(w, http.StatusNotFound, "Không tìm thấy bài viết")
		} else {
			log.Println("❌ Lỗi truy vấn CSDL:", err)
			responseError(w, http.StatusInternalServerError, "Lỗi máy chủ khi lấy bài viết")
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"id":         id,
			"tieuDe":     tieuDe,
			"noiDung":    noiDung, // ⚠ Không nên render markdown lúc sửa
			"idTaiKhoan": idTaiKhoan,
			"ngayDang":   ngayTao.Format("02/01/2006 15:04"),
			"mediaUrl": func() string {
				if mediaUrl.Valid {
					return mediaUrl.String
				}
				return ""
			}(),
		},
	})

}

func XoaBaiDang(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodDelete {
		responseError(w, http.StatusMethodNotAllowed, "Chỉ hỗ trợ DELETE")
		return
	}

	token, err := validateToken(r)
	if err != nil {
		responseError(w, http.StatusUnauthorized, "Unauthorized: "+err.Error())
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		responseError(w, http.StatusUnauthorized, "Unauthorized: Invalid token claims")
		return
	}

	idFloat, okID := claims["id"].(float64)
	username, _ := claims["tenDangNhap"].(string)

	quyenRaw, exists := claims["phanQuyen"]
	if !okID || !exists || quyenRaw == nil {
		responseError(w, http.StatusUnauthorized, "Unauthorized: Thiếu thông tin trong token")
		return
	}
	quyen, ok := quyenRaw.(string)
	if !ok {
		responseError(w, http.StatusUnauthorized, "Unauthorized: Quyền không hợp lệ")
		return
	}

	idNguoiDung := int(idFloat)
	fmt.Printf("🧾 Token người dùng: ID=%d | Tên=%s | Quyền=%s\n", idNguoiDung, username, quyen)

	idStr := mux.Vars(r)["id"]
	idBaiDang, err := strconv.Atoi(idStr)
	if err != nil {
		responseError(w, http.StatusBadRequest, "ID bài đăng không hợp lệ")
		return
	}

	var idChuBai int
	err = DB.QueryRowContext(ctx, "SELECT idTaiKhoan FROM BaiDang WHERE id = ?", idBaiDang).Scan(&idChuBai)
	if err == sql.ErrNoRows {
		responseError(w, http.StatusNotFound, "Bài viết không tồn tại")
		return
	} else if err != nil {
		log.Println("❌ Lỗi truy vấn bài viết:", err)
		responseError(w, http.StatusInternalServerError, "Lỗi truy vấn bài viết")
		return
	}

	if idNguoiDung != idChuBai && quyen != "admin" {
		responseError(w, http.StatusForbidden, "Bạn không có quyền xóa bài viết này")
		return
	}

	tx, err := DB.BeginTx(ctx, nil)
	if err != nil {
		responseError(w, http.StatusInternalServerError, "Không thể khởi tạo giao dịch")
		return
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "DELETE FROM binhluan WHERE idBaiDang = ?", idBaiDang); err != nil {
		responseError(w, http.StatusInternalServerError, "Lỗi khi xóa bình luận")
		return
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM Cam_Xuc WHERE idBaiDang = ?", idBaiDang); err != nil {
		responseError(w, http.StatusInternalServerError, "Lỗi khi xóa cảm xúc")
		return
	}

	res, err := tx.ExecContext(ctx, "DELETE FROM BaiDang WHERE id = ?", idBaiDang)
	if err != nil {
		responseError(w, http.StatusInternalServerError, "Lỗi khi xóa bài viết")
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		responseError(w, http.StatusNotFound, "Không tìm thấy bài viết để xóa")
		return
	}

	if err := tx.Commit(); err != nil {
		responseError(w, http.StatusInternalServerError, "Lỗi khi xác nhận xóa bài")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Đã xóa bài viết và dữ liệu liên quan",
		"id":      idBaiDang,
	})
}

func ThemCamXuc(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		responseError(w, http.StatusMethodNotAllowed, "Chỉ hỗ trợ phương thức POST")
		return
	}

	token, err := validateToken(r)
	if err != nil {
		responseError(w, http.StatusUnauthorized, "Unauthorized: "+err.Error())
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		responseError(w, http.StatusUnauthorized, "Unauthorized: Invalid claims")
		return
	}

	idFloat, ok := claims["id"].(float64)
	if !ok {
		responseError(w, http.StatusUnauthorized, "Unauthorized: Invalid user ID in token")
		return
	}
	idTaiKhoan := int(idFloat)

	var request struct {
		LoaiCamXuc string `json:"loaiCamXuc"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		responseError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	idStr := mux.Vars(r)["idBaiDang"]
	idBaiDang, err := strconv.Atoi(idStr)
	if err != nil {
		responseError(w, http.StatusBadRequest, "ID bài viết không hợp lệ")
		return
	}

	validEmotions := map[string]bool{
		"like": true, "dislike": true, "love": true,
		"haha": true, "wow": true, "sad": true, "angry": true,
	}
	if !validEmotions[request.LoaiCamXuc] {
		responseError(w, http.StatusBadRequest, "Loại cảm xúc không hợp lệ")
		return
	}

	tx, err := DB.BeginTx(ctx, nil) // SỬA: Thêm context cho consistency
	if err != nil {
		log.Println("❌ Lỗi khởi tạo transaction:", err)
		responseError(w, http.StatusInternalServerError, "Lỗi máy chủ khi bắt đầu transaction")
		return
	}
	defer tx.Rollback()

	var exists bool
	err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM BaiDang WHERE id = ?)", idBaiDang).Scan(&exists)
	if err != nil || !exists {
		responseError(w, http.StatusNotFound, "Bài viết không tồn tại")
		return
	}

	_, err = tx.ExecContext(ctx, `
    INSERT INTO Cam_Xuc (idBaiDang, idTaiKhoan, loaiCamXuc)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE loaiCamXuc = VALUES(loaiCamXuc)
`, idBaiDang, idTaiKhoan, request.LoaiCamXuc)

	if err != nil {
		log.Println("❌ Lỗi DB khi thêm cảm xúc:", err)
		responseError(w, http.StatusInternalServerError, "Không thể cập nhật cảm xúc")
		return
	}

	if err := tx.Commit(); err != nil {
		log.Println("❌ Lỗi commit transaction:", err)
		responseError(w, http.StatusInternalServerError, "Không thể xác nhận cập nhật")
		return
	}

	cacheKey := fmt.Sprintf("reactions:%d", idBaiDang)
	redisClient.Del(ctx, cacheKey)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"action":  "updated",
		"emotion": request.LoaiCamXuc,
	})
}

func ThongKeCamXuc(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		responseError(w, http.StatusMethodNotAllowed, "Chỉ hỗ trợ phương thức GET")
		return
	}

	idStr := mux.Vars(r)["idBaiDang"]
	idBaiDang, err := strconv.Atoi(idStr)
	if err != nil {
		responseError(w, http.StatusBadRequest, "ID bài viết không hợp lệ")
		return
	}

	cacheKey := fmt.Sprintf("reactions:%d", idBaiDang)
	if cached, err := redisClient.Get(ctx, cacheKey).Result(); err == nil {
		w.Write([]byte(cached))
		return
	}

	// SỬA: Thêm context vào query
	rows, err := DB.QueryContext(ctx, `
    SELECT loaiCamXuc, COUNT(*) as count 
    FROM Cam_Xuc 
    WHERE idBaiDang = ?
    GROUP BY loaiCamXuc
`, idBaiDang)

	if err != nil {
		log.Println("❌ Lỗi truy vấn cảm xúc:", err)
		responseError(w, http.StatusInternalServerError, "Không thể lấy thống kê cảm xúc")
		return
	}
	defer rows.Close()

	result := map[string]int{
		"like": 0, "dislike": 0, "love": 0,
		"haha": 0, "wow": 0, "sad": 0, "angry": 0,
	}

	for rows.Next() {
		var loai string
		var count int
		if err := rows.Scan(&loai, &count); err != nil {
			log.Println("⚠️ Lỗi đọc dữ liệu dòng:", err)
			continue
		}
		result[loai] = count
	}

	jsonData, _ := json.Marshal(result)
	redisClient.Set(ctx, cacheKey, string(jsonData), 30*time.Minute)

	writeJSON(w, http.StatusOK, result)
}

func SuaBaiDang(w http.ResponseWriter, r *http.Request) {

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization") // SỬA: Thêm Authorization
	w.Header().Set("Access-Control-Allow-Methods", "PUT, OPTIONS")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPut {
		responseError(w, http.StatusMethodNotAllowed, "Chỉ hỗ trợ PUT")
		return
	}

	idStr := mux.Vars(r)["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		responseError(w, http.StatusBadRequest, "ID không hợp lệ")
		return
	}

	var data struct {
		TieuDe  string `json:"tieuDe"`
		NoiDung string `json:"noiDung"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		responseError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	// SỬA: Thêm context
	_, err = DB.Exec(`UPDATE BaiDang SET tieuDe = ?, noiDung = ? WHERE id = ?`, data.TieuDe, data.NoiDung, id)
	if err != nil {
		log.Println("❌ Lỗi cập nhật bài viết:", err)
		responseError(w, http.StatusInternalServerError, "Không thể cập nhật bài viết")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Cập nhật bài viết thành công!",
	})
}

func XoaBinhLuan(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization") // SỬA: Thêm Authorization
	w.Header().Set("Access-Control-Allow-Methods", "DELETE, OPTIONS")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodDelete {
		responseError(w, http.StatusMethodNotAllowed, "Chỉ hỗ trợ DELETE")
		return
	}

	idStr := mux.Vars(r)["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		responseError(w, http.StatusBadRequest, "ID không hợp lệ")
		return
	}
	ctx := r.Context()

	// SỬA: Thêm context
	res, err := DB.ExecContext(ctx, `DELETE FROM binhluan WHERE id = ?`, id)
	if err != nil {
		log.Println("❌ Lỗi khi xóa bình luận:", err)
		responseError(w, http.StatusInternalServerError, "Không thể xóa bình luận")
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		responseError(w, http.StatusNotFound, "Bình luận không tồn tại")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Đã xóa bình luận thành công!",
		"id":      id,
	})
}
