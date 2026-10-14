FROM golang:1.24.3-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /zenspace-api ./cmd/server

FROM alpine:3.21
RUN apk add --no-cache su-exec \
    && addgroup -S app \
    && adduser -S app -G app
WORKDIR /app
COPY --from=build /zenspace-api /app/server
COPY docker-entrypoint.sh /usr/local/bin/zenspace-entrypoint
RUN chmod +x /usr/local/bin/zenspace-entrypoint
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/zenspace-entrypoint"]
