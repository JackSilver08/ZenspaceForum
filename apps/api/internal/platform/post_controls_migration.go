package platform

import (
    "context"
    "database/sql"
    "fmt"
    "time"
)

// MigratePostControls is additive and idempotent. Existing posts and media stay intact.
// Do not delete post rows or recreate the users/posts tables during migration.
func MigratePostControls(db *sql.DB) error {
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
    defer cancel()
    statements := []string{
        `CREATE TABLE IF NOT EXISTS post_bookmarks (
            user_id INT NOT NULL,
            post_id INT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id, post_id),
            INDEX idx_post_bookmarks_post (post_id),
            FOREIGN KEY (user_id) REFERENCES TaiKhoan(id) ON DELETE CASCADE,
            FOREIGN KEY (post_id) REFERENCES BaiDang(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS post_hides (
            user_id INT NOT NULL,
            post_id INT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id, post_id),
            INDEX idx_post_hides_post (post_id),
            FOREIGN KEY (user_id) REFERENCES TaiKhoan(id) ON DELETE CASCADE,
            FOREIGN KEY (post_id) REFERENCES BaiDang(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
    }
    for _, statement := range statements {
        if _, err := db.ExecContext(ctx, statement); err != nil {
            return fmt.Errorf("migrate post controls: %w", err)
        }
    }

    // MySQL 8 versions differ in ADD COLUMN IF NOT EXISTS support. Inspect
    // information_schema rather than relying on version-specific DDL syntax.
    var exists int
    err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='BaiDang' AND COLUMN_NAME='pinnedAt'`).Scan(&exists)
    if err != nil { return fmt.Errorf("inspect pinnedAt column: %w", err) }
    if exists == 0 {
        if _, err := db.ExecContext(ctx, "ALTER TABLE BaiDang ADD COLUMN pinnedAt DATETIME NULL DEFAULT NULL"); err != nil {
            return fmt.Errorf("add pinnedAt column: %w", err)
        }
    }
    return nil
}
