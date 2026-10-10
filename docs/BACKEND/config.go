package main

import (
	"fmt"
	"os"

	mysql "github.com/go-sql-driver/mysql"
)

// envOrDefault returns an environment variable or its local-development default.
func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// databaseDSN builds a correctly escaped MySQL DSN from environment variables.
// Defaults retain the existing ZenSpace development database settings.
func databaseDSN(parseTime bool) string {
	cfg := mysql.Config{
		User:                 envOrDefault("DB_USER", "root"),
		Passwd:               envOrDefault("DB_PASSWORD", "Tuan@1234"),
		Net:                  "tcp",
		Addr:                 fmt.Sprintf("%s:%s", envOrDefault("DB_HOST", "db"), envOrDefault("DB_PORT", "3306")),
		DBName:               envOrDefault("DB_NAME", "ZenSpaceDB"),
		ParseTime:            parseTime,
		AllowNativePasswords: true,
		Params:               map[string]string{"charset": "utf8mb4"},
	}
	return cfg.FormatDSN()
}
