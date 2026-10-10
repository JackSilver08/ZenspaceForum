# ZenSpace: chạy bằng Docker trên Windows

## Yêu cầu một lần

1. Cài Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Mở Docker Desktop và chờ trạng thái Docker Engine sẵn sàng.
3. Giải nén toàn bộ thư mục ZenSpace, giữ nguyên file `ZenSpaceDB_latest.sql`.

## Khởi động

Chạy `START.bat` ở thư mục gốc ZenSpace. Script sẽ tự tạo `.env` nếu chưa có, build backend Go, khởi chạy MySQL + Redis + backend + web server, chờ API sẵn sàng, mở trình duyệt và theo dõi log trực tiếp.

- Website: http://localhost:8088
- API kiểm tra: http://localhost:8080/hello
- MySQL để kết nối bằng công cụ ngoài (nếu cần): `127.0.0.1:3307`, user `root`, mật khẩu trong `.env`

Không cần cài Go, MySQL, Redis hoặc Nginx riêng trên Windows. Docker sẽ chạy các dịch vụ trong container.

## Dừng và khởi động lại

- Chạy `STOP.bat` để dừng các container (dữ liệu MySQL vẫn được giữ lại).
- Chạy lại `START.bat` để khởi động.
- Để xem log sau đó: `docker compose logs -f --tail=100`.

## Dữ liệu và cập nhật mã nguồn

MySQL dùng Docker volume `mysql_data`; ảnh/video tải lên được lưu trong `data/uploads` (bao gồm thư mục con `posts`). Những dữ liệu này sẽ còn nguyên khi chạy `docker compose down` và build bản mới. File SQL chỉ được tự động import khi volume database được khởi tạo lần đầu; Compose không xóa hoặc nhập đè dữ liệu hiện có mỗi lần khởi động.

Sau khi lấy mã nguồn mới, chạy lại `START.bat`; Docker Compose sẽ build image backend mới. Không dùng `docker compose down -v` trừ khi chủ động muốn xóa volume database và khởi tạo lại database từ file SQL.

## Khắc phục nhanh

- Nếu cổng `8088`, `8080` hoặc `3307` đã được chương trình khác sử dụng, hãy dừng chương trình đó rồi chạy lại.
- Nếu backend không sẵn sàng, xem log: `docker compose logs --tail=150 db backend redis web`.
- Nếu database đã được tạo trước đó nhưng đang trống, SQL init sẽ không chạy lại tự động. Sao lưu dữ liệu trước khi chủ động xóa volume `zenspace_mysql_data`/volume của Compose rồi khởi động lại.
