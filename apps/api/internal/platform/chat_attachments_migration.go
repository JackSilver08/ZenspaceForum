package platform

import (
    "context"
    "database/sql"
    "fmt"
    "time"
)

// Additive migration; all pre-existing chat messages remain untouched.
func MigrateChatAttachments(db *sql.DB) error {
    ctx,cancel:=context.WithTimeout(context.Background(),2*time.Minute)
    defer cancel()
    conn,err:=db.Conn(ctx)
    if err!=nil{return err}
    defer conn.Close()
    var locked sql.NullInt64
    if err=conn.QueryRowContext(ctx,"SELECT GET_LOCK('zenspace_chat_attachments_v1',60)").Scan(&locked);err!=nil || !locked.Valid || locked.Int64!=1 {
        return fmt.Errorf("lock chat attachment migration: %v",err)
    }
    defer conn.ExecContext(context.Background(),"SELECT RELEASE_LOCK('zenspace_chat_attachments_v1')")
    _,err=conn.ExecContext(ctx,`CREATE TABLE IF NOT EXISTS chat_attachments (
        id BIGINT NOT NULL AUTO_INCREMENT,
        message_id INT NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(80) NOT NULL,
        media_type VARCHAR(128) NOT NULL,
        kind VARCHAR(16) NOT NULL,
        original_bytes BIGINT NOT NULL,
        stored_bytes BIGINT NOT NULL,
        encoding VARCHAR(16) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(id),
        UNIQUE KEY uq_chat_attachment_message(message_id),
        UNIQUE KEY uq_chat_attachment_stored(stored_name),
        CONSTRAINT fk_chat_attachment_message FOREIGN KEY(message_id)
          REFERENCES tin_nhan(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`)
    if err!=nil{return fmt.Errorf("create chat attachment table: %w",err)}
    return nil
}
