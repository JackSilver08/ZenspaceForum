package platform

import (
 "context"
 "database/sql"
 "fmt"
 "time"
)

// Additive and re-runnable. Historic posts remain public and active.
func MigratePostLifecycle(db *sql.DB) error {
 ctx,cancel:=context.WithTimeout(context.Background(),3*time.Minute);defer cancel()
 conn,err:=db.Conn(ctx);if err!=nil{return err};defer conn.Close()
 var locked sql.NullInt64
 if err=conn.QueryRowContext(ctx,"SELECT GET_LOCK('zenspace_sprint3_lifecycle',60)").Scan(&locked);err!=nil||!locked.Valid||locked.Int64!=1{return fmt.Errorf("cannot lock lifecycle migration: %v",err)}
 defer conn.ExecContext(context.Background(),"SELECT RELEASE_LOCK('zenspace_sprint3_lifecycle')")
 columns:=[]struct{name,ddl string}{
  {"visibility","VARCHAR(16) NOT NULL DEFAULT 'public'"},
  {"lifecycle_state","VARCHAR(16) NOT NULL DEFAULT 'active'"},
  {"previous_state","VARCHAR(16) NOT NULL DEFAULT 'active'"},
  {"archived_at","DATETIME(6) NULL"},
  {"trashed_at","DATETIME(6) NULL"},
  {"purge_after","DATETIME(6) NULL"},
  {"updated_at","DATETIME(6) NULL"},
  {"revision","INT NOT NULL DEFAULT 1"},
 }
 for _,column:=range columns{
  var count int
  err=conn.QueryRowContext(ctx,`SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='BaiDang' AND COLUMN_NAME=?`,column.name).Scan(&count)
  if err!=nil{return fmt.Errorf("inspect lifecycle column %s: %w",column.name,err)}
  if count==0 {
   if _,err=conn.ExecContext(ctx,"ALTER TABLE BaiDang ADD COLUMN "+column.name+" "+column.ddl);err!=nil {
    return fmt.Errorf("add lifecycle column %s: %w",column.name,err)
   }
  }
 }
 _,err=conn.ExecContext(ctx,`CREATE TABLE IF NOT EXISTS post_edit_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  revision INT NOT NULL,
  content_before MEDIUMTEXT NOT NULL,
  edited_by INT NOT NULL,
  edited_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_post_revision(post_id,revision),
  INDEX idx_post_history(post_id,edited_at),
  FOREIGN KEY(post_id) REFERENCES BaiDang(id) ON DELETE CASCADE,
  FOREIGN KEY(edited_by) REFERENCES TaiKhoan(id) ON DELETE CASCADE
 ) ENGINE=InnoDB`)
 if err!=nil{return fmt.Errorf("create post_edit_history: %w",err)}
 return nil
}
