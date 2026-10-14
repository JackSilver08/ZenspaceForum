FROM golang:1.24.3-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /zenspace-api ./cmd/server
FROM alpine:3.21
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /zenspace-api /app/server
USER app
EXPOSE 8080
CMD ["/app/server"]
