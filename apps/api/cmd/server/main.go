package main

import (
    "context"
    "database/sql"
    "log"
    "os"
    "time"

    "github.com/JackSilver08/ZenspaceForum/apps/api/internal/httpapi"
    "github.com/JackSilver08/ZenspaceForum/apps/api/internal/platform"
    "github.com/redis/go-redis/v9"
)

func main() {
    cfg, err := platform.LoadConfig()
    if err != nil { log.Fatal(err) }

    db, err := sql.Open("mysql", cfg.DSN())
    if err != nil { log.Fatal(err) }
    defer db.Close()
    db.SetConnMaxLifetime(5 * time.Minute)
    db.SetMaxIdleConns(10)
    db.SetMaxOpenConns(50)

    ctx, cancel := context.WithTimeout(context.Background(), 60 * time.Second)
    defer cancel()
    for {
        if err := db.PingContext(ctx); err == nil { break }
        if ctx.Err() != nil { log.Fatal("MySQL unavailable: ", ctx.Err()) }
        time.Sleep(2 * time.Second)
    }
    if err := platform.Migrate(db); err != nil { log.Fatal("Database migration failed: ", err) }
    if err := os.MkdirAll(cfg.UploadDir + "/posts", 0755); err != nil { log.Fatal(err) }

    redisClient := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr,
        DialTimeout: 150 * time.Millisecond, ReadTimeout: 150 * time.Millisecond,
        WriteTimeout: 150 * time.Millisecond, MaxRetries: -1,
    })
    redisCtx, stopRedisPing := context.WithTimeout(context.Background(), 300*time.Millisecond)
    redisErr := redisClient.Ping(redisCtx).Err()
    stopRedisPing()
    if redisErr != nil {
        log.Printf("Redis unavailable; running without optional cache: %v", redisErr)
        _ = redisClient.Close()
        redisClient = nil
    } else {
        defer redisClient.Close()
    }
    app := &httpapi.App{DB: db, Redis: redisClient, Secret: []byte(cfg.JWTSecret), UploadDir: cfg.UploadDir}
    app.PurgeExpiredPosts()
    go func(){
        ticker:=time.NewTicker(12*time.Hour);defer ticker.Stop()
        for range ticker.C {app.PurgeExpiredPosts()}
    }()
    router := app.Router()
    log.Printf("Zenspace API listening on :%s", cfg.Port)
    if err := router.Run(":" + cfg.Port); err != nil { log.Fatal(err) }
}
