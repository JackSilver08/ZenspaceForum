package platform

import (
    "context"
    "database/sql"
    "fmt"
    "time"
)

// MigrateSocialSafety adds controls without changing existing posts/comments or data.
func MigrateSocialSafety(db *sql.DB) error {
    ctx,cancel:=context.WithTimeout(context.Background(), 2*time.Minute)
    defer cancel()
    schema:=[]string{
        `CREATE TABLE IF NOT EXISTS user_blocks (
            blocker_id INT NOT NULL, blocked_id INT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(blocker_id,blocked_id),
            INDEX idx_user_blocks_blocked (blocked_id),
            FOREIGN KEY(blocker_id) REFERENCES TaiKhoan(id) ON DELETE CASCADE,
            FOREIGN KEY(blocked_id) REFERENCES TaiKhoan(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        // Snapshot means a report survives the author deleting the original post.
        `CREATE TABLE IF NOT EXISTS post_reports (
            id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            post_id INT NULL,
            reporter_id INT NOT NULL,
            reported_author_id INT NOT NULL,
            reason VARCHAR(32) NOT NULL,
            details VARCHAR(500) NOT NULL DEFAULT '',
            content_snapshot MEDIUMTEXT NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            reviewed_by INT NULL,
            reviewed_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_post_report_user (reporter_id,post_id),
            INDEX idx_post_reports_status (status,created_at),
            FOREIGN KEY(post_id) REFERENCES BaiDang(id) ON DELETE SET NULL,
            FOREIGN KEY(reporter_id) REFERENCES TaiKhoan(id) ON DELETE CASCADE,
            FOREIGN KEY(reviewed_by) REFERENCES TaiKhoan(id) ON DELETE SET NULL
        ) ENGINE=InnoDB`,
    }
    for _,statement:=range schema {
        if _,err:=db.ExecContext(ctx,statement);err!=nil{return fmt.Errorf("create safety tables: %w",err)}
    }
    var exists int
    err:=db.QueryRowContext(ctx,`SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='BaiDang' AND COLUMN_NAME='commentsEnabled'`).Scan(&exists)
    if err!=nil{return fmt.Errorf("inspect commentsEnabled: %w",err)}
    if exists==0 {
        if _,err:=db.ExecContext(ctx,"ALTER TABLE BaiDang ADD COLUMN commentsEnabled TINYINT(1) NOT NULL DEFAULT 1");err!=nil {
            return fmt.Errorf("add commentsEnabled: %w",err)
        }
    }
    return nil
}
