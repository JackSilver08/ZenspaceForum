package main

import (
	"fmt"
	"os"

	mysql "github.com/go-sql-driver/mysql"
)

// envOrDefault returns an environment variable or a non-sensitive default.
func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// databaseDSN builds an escaped MySQL DSN from environment variables.
// Credentials are provided by the local .env/Docker environment, never source code.
func databaseDSN(parseTime bool) string {
	cfg := mysql.Config{
		User:                 envOrDefault("DB_USER", "root"),
		Passwd:               os.Getenv("DB_PASSWORD"),
		Net:                  "tcp",
		Addr:                 fmt.Sprintf("%s:%s", envOrDefault("DB_HOST", "db"), envOrDefault("DB_PORT", "3306")),
		DBName:               envOrDefault("DB_NAME", "ZenSpaceDB"),
		ParseTime:            parseTime,
		AllowNativePasswords: true,
		Params:               map[string]string{"charset": "utf8mb4"},
	}
	return cfg.FormatDSN()
}
