# Sử dụng image Golang chính thức
FROM golang:1.24.3

# Đặt thư mục làm việc trong container
WORKDIR /app

# Copy file go.mod và go.sum để cài dependency
COPY go.mod go.sum ./
RUN go mod download

# Copy toàn bộ mã nguồn vào container
COPY . .

# Cài đặt netcat để dùng cho wait-for-mysql
RUN apt-get update && apt-get install -y netcat-openbsd

# Copy script đợi MySQL (nếu chưa copy ở lệnh trước)
COPY wait-for-mysql.sh /wait-for-mysql.sh
RUN chmod +x /wait-for-mysql.sh

# Biên dịch Go app
RUN go build -o main .

# Expose cổng cho service backend
EXPOSE 8080

# Lệnh mặc định khi container chạy
CMD ["/wait-for-mysql.sh", "./main"]
