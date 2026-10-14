FROM golang:1.24.3-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
# go.sum has not yet been committed for the new Go module. Resolve all
# direct and transitive checksums as part of the actual Docker build.
RUN go mod tidy \
    && go mod verify \
    && CGO_ENABLED=0 go build -trimpath -o /zenspace-api ./cmd/server

FROM alpine:3.21
RUN apk add --no-cache su-exec \
    && addgroup -S app \
    && adduser -S app -G app
WORKDIR /app
COPY --from=build /zenspace-api /app/server
COPY docker-entrypoint.sh /usr/local/bin/zenspace-entrypoint
# Defensive normalization for Windows CRLF checkouts, even if Git settings are overridden.
# Without it Linux may look for a nonexistent /bin/sh\r interpreter.
RUN sed -i 's/\r$//' /usr/local/bin/zenspace-entrypoint \
    && chmod +x /usr/local/bin/zenspace-entrypoint \
    && /bin/sh -n /usr/local/bin/zenspace-entrypoint
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/zenspace-entrypoint"]
