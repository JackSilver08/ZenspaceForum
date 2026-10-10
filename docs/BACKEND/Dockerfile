# syntax=docker/dockerfile:1
FROM golang:1.24.3

WORKDIR /app

COPY go.mod ./ 
COPY go.sum ./
RUN go mod download

# ✅ Copy code Go từ thư mục hiện tại (BACKEND)
COPY . .

# ✅ Copy thư mục chứa HTML, CSS, JS, IMG (từ thư mục cha BACKEND → docs)
COPY ../docs ./docs

# ✅ Cài netcat
RUN apt-get update && apt-get install -y netcat-openbsd

COPY wait-for-mysql.sh /wait-for-mysql.sh
RUN chmod +x /wait-for-mysql.sh

RUN go build -o main .

EXPOSE 8080

CMD ["/wait-for-mysql.sh", "./main"]
