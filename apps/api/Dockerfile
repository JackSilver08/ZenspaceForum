# syntax=docker/dockerfile:1.7
FROM golang:1.24.3-alpine AS build
WORKDIR /src

# go.mod and go.sum change less frequently than the application source.
# Keep dependency download cached separately from normal code changes.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod,sharing=locked \
    echo '[ZenSpace] Downloading and verifying Go modules...' \
    && go mod download \
    && go mod verify

COPY . .

# Preserve both the module download cache and compiler object cache across
# changed application source (BuildKit cache mounts, even on cache misses).
# -v lists compiled packages, avoiding a silent first build on Windows Docker.
RUN --mount=type=cache,target=/go/pkg/mod,sharing=locked \
    --mount=type=cache,target=/root/.cache/go-build,sharing=locked \
    echo '[ZenSpace] Compiling backend (cold Go build may take a few minutes)...' \
    && CGO_ENABLED=0 go build -v -trimpath -o /zenspace-api ./cmd/server

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
