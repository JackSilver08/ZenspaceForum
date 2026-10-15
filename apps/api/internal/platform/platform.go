package platform

import (
    "database/sql"
    "errors"
    "fmt"
    "os"
    "strings"

    mysql "github.com/go-sql-driver/mysql"
)

type Config struct {
    Port, JWTSecret, RedisAddr, UploadDir string
    DBHost, DBPort, DBName, DBUser, DBPassword string
}

func env(key, fallback string) string {
    if s := strings.TrimSpace(os.Getenv(key)); s != "" { return s }
    return fallback
}

func LoadConfig() (Config, error) {
    c := Config{
        Port: env("PORT", "8080"),
        JWTSecret: os.Getenv("JWT_SECRET"),
        RedisAddr: env("REDIS_ADDR", "redis:6379"),
        UploadDir: env("UPLOAD_DIR", "./uploads"),
        DBHost: env("DB_HOST", "db"),
        DBPort: env("DB_PORT", "3306"),
        DBName: env("DB_NAME", "ZenSpaceDB"),
        DBUser: env("DB_USER", "root"),
        DBPassword: os.Getenv("DB_PASSWORD"),
    }
    if len(c.JWTSecret) < 32 { return c, errors.New("JWT_SECRET must be at least 32 characters") }
    if c.DBPassword == "" { return c, errors.New("DB_PASSWORD must not be empty") }
    return c, nil
}

func (c Config) DSN() string {
    return (&mysql.Config{
        User: c.DBUser, Passwd: c.DBPassword, Net: "tcp",
        Addr: fmt.Sprintf("%s:%s", c.DBHost, c.DBPort), DBName: c.DBName,
        ParseTime: true, Params: map[string]string{"charset": "utf8mb4"},
    }).FormatDSN()
}

// Additive migrations: the existing TaiKhoan/BaiDang/etc tables and data are untouched.
func Migrate(db *sql.DB) error {
    _, err := db.Exec("CREATE TABLE IF NOT EXISTS follows (" +
        "follower_id INT NOT NULL, following_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
        "PRIMARY KEY (follower_id, following_id), INDEX idx_follows_following (following_id)," +
        "FOREIGN KEY (follower_id) REFERENCES TaiKhoan(id) ON DELETE CASCADE," +
        "FOREIGN KEY (following_id) REFERENCES TaiKhoan(id) ON DELETE CASCADE)")
    if err != nil { return err }
    if err := MigrateContentOnlyPosts(db); err != nil { return err }
    if err := MigratePostControls(db); err != nil { return err }
    if err := MigrateSocialSafety(db); err != nil { return err }
    if err := MigratePostLifecycle(db); err != nil { return err }
    return MigrateCommentInteractions(db)
}
