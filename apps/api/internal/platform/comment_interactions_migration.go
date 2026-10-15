package platform

import (
    "context"
    "database/sql"
    "fmt"
    "time"
)

// MigrateCommentInteractions preserves old comments and can run again safely.
// Replies are one level deep; deleting a parent does not delete its replies.
func MigrateCommentInteractions(db *sql.DB) error {
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
    defer cancel()
    conn, err := db.Conn(ctx)
    if err != nil { return err }
    defer conn.Close()

    var locked sql.NullInt64
    if err := conn.QueryRowContext(ctx, "SELECT GET_LOCK('zenspace_comment_interactions',60)").Scan(&locked); err != nil || !locked.Valid || locked.Int64 != 1 {
        return fmt.Errorf("lock comment migration: %v", err)
    }
    defer conn.ExecContext(context.Background(), "SELECT RELEASE_LOCK('zenspace_comment_interactions')")

    columns := []struct{name,ddl string}{
        {"parent_id","INT NULL"},
        {"edited_at","DATETIME(6) NULL"},
    }
    for _,column := range columns {
        var exists int
        err := conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='binhluan' AND COLUMN_NAME=?`,column.name).Scan(&exists)
        if err != nil { return fmt.Errorf("inspect comment column %s: %w",column.name,err) }
        if exists == 0 {
            if _,err := conn.ExecContext(ctx,"ALTER TABLE binhluan ADD COLUMN "+column.name+" "+column.ddl);err != nil {
                return fmt.Errorf("add comment column %s: %w",column.name,err)
            }
        }
    }

    var parentKey int
    err = conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='binhluan'
        AND CONSTRAINT_NAME='fk_comment_parent'`).Scan(&parentKey)
    if err != nil { return fmt.Errorf("inspect comment parent foreign key: %w",err) }
    if parentKey == 0 {
        if _,err := conn.ExecContext(ctx,`ALTER TABLE binhluan ADD CONSTRAINT fk_comment_parent
          FOREIGN KEY(parent_id) REFERENCES binhluan(id) ON DELETE SET NULL`);err != nil {
            return fmt.Errorf("create comment parent foreign key: %w",err)
        }
    }

    _,err = conn.ExecContext(ctx,`CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(comment_id,user_id),
        INDEX idx_comment_likes_user(user_id),
        CONSTRAINT fk_comment_likes_comment FOREIGN KEY(comment_id) REFERENCES binhluan(id) ON DELETE CASCADE,
        CONSTRAINT fk_comment_likes_user FOREIGN KEY(user_id) REFERENCES TaiKhoan(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`)
    if err != nil { return fmt.Errorf("create comment likes: %w",err) }
    return nil
}
