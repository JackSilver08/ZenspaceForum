# ZenSpace — bài viết không tiêu đề (Facebook-style)

ZenSpace nay đăng trạng thái chỉ bằng **nội dung** (`noiDung`) và ảnh/video tùy chọn. `tieuDe` được xóa khỏi API, React và bảng `BaiDang`.

## Nâng cấp dữ liệu cũ an toàn

Hệ thống tự chạy migration `20261015_content_only_posts` khi backend kết nối MySQL. Nếu cột `BaiDang.tieuDe` còn tồn tại:

1. Mở rộng `noiDung` thành `MEDIUMTEXT` để chứa cả tiêu đề cũ lẫn nội dung.
2. Chuyển tiêu đề cũ vào đầu nội dung, cách phần thân bằng hai ký tự xuống dòng. Trường hợp tiêu đề trùng thân, chỉ giữ một bản.
3. Ghi dấu migration vào bảng `schema_migrations` **cùng transaction với bước cập nhật**.
4. Xóa cột `tieuDe`. Nếu tiến trình ngừng giữa bước 3 và 4, lần khởi động tiếp theo tiếp tục xóa cột mà **không nối tiêu đề thêm lần nữa**.

Tất cả `id`, `idTaiKhoan`, `ngayTao`, `mediaUrl`, `Cam_Xuc` và `binhluan` được giữ nguyên. File `ZenSpaceDB_latest.sql` cho database mới đã có 12 bài mẫu được chuyển sang dạng nội dung.

**Trước lần chạy nâng cấp thật, hãy sao lưu database:**

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
# Use the actual DB password from .env; PowerShell variable keeps secrets out of a command literal.
# Example: docker compose exec -T db mysqldump -uroot -p ZenSpaceDB > backups\ZenSpaceDB-before-content-only.sql
```

Không chạy `docker compose down -v`, không xóa MySQL volume. Schema thay đổi là một chiều: nếu cần quay lại code cũ, phải khôi phục backup tương thích.

## Hợp đồng API mới

- `POST /api/baiviet` nhận `noiDung` dưới dạng JSON hoặc multipart; `file` tùy chọn.
- `PUT /api/baiviet/:id` chỉ cần `noiDung`. Quyền chỉnh sửa/xóa không đổi.
- `GET /api/baiviet`, `GET /api/v1/feed`, `GET /api/baiviet/:id` và profile trả `noiDung` cùng các thuộc tính tác giả/media/tương tác như trước, **không còn `tieuDe`**.
- Nội dung 1–10.000 ký tự Unicode (sau trim); bài trống bị từ chối với HTTP 400. Tệp vẫn giới hạn 20 MB và các định dạng ảnh/video hiện hỗ trợ.
- Các client/API tích hợp cũ phải được nâng cấp đồng thời, vì schema này loại bỏ cột tiêu đề.

## Kiểm thử ngăn lỗi trở lại

CI gồm kiểm tra source không còn dùng `tieuDe`, Go unit test validation Unicode, thực thi HTTP CRUD/multipart, browser test tạo status không có tiêu đề và kiểm thử mô phỏng schema legacy trên MySQL disposable. Migration cũng được thử khởi động lại để xác nhận idempotence.
