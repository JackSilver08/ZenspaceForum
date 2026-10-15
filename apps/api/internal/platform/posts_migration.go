package platform

import (
    "context"
    "database/sql"
    "fmt"
    "time"
)

// MigrateContentOnlyPosts upgrades pre-Facebook-style ZenSpace post schemas on
// existing MySQL volumes. MySQL DDL is not transactional; the migration marker
// and content conversion ARE atomic, so a crash before DROP COLUMN cannot
// prepend an old title twice during a retry.
func MigrateContentOnlyPosts(db *sql.DB) error {
    ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
    defer cancel()
    conn, err := db.Conn(ctx)
    if err != nil { return err }
    defer conn.Close()

    var locked sql.NullInt64
    if err := conn.QueryRowContext(ctx, "SELECT GET_LOCK('zenspace_content_posts_v1', 60)").Scan(&locked); err != nil {
        return fmt.Errorf("lock post migration: %w", err)
    }
    if !locked.Valid || locked.Int64 != 1 { return fmt.Errorf("post migration lock unavailable") }
    defer conn.ExecContext(context.Background(), "SELECT RELEASE_LOCK('zenspace_content_posts_v1')")

    if _, err := conn.ExecContext(ctx, "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"); err != nil {
        return fmt.Errorf("create migration ledger: %w", err)
    }
    var hasTitle int
    if err := conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='BaiDang' AND COLUMN_NAME='tieuDe'").Scan(&hasTitle); err != nil {
        return fmt.Errorf("inspect posts table: %w", err)
    }
    if hasTitle == 0 { return nil } // fresh installs already use content-only posts

    // Avoid truncation while moving up to 255 title characters into the body.
    if _, err := conn.ExecContext(ctx, "ALTER TABLE BaiDang MODIFY COLUMN noiDung MEDIUMTEXT NOT NULL"); err != nil {
        return fmt.Errorf("expand post content column: %w", err)
    }

    const version = "20261015_content_only_posts"
    var applied int
    if err := conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM schema_migrations WHERE version=?", version).Scan(&applied); err != nil {
        return fmt.Errorf("read migration ledger: %w", err)
    }
    if applied == 0 {
        tx, err := conn.BeginTx(ctx, nil)
        if err != nil { return err }
        // Keep historical titles visible as part of the post body, preserve text,
        // media, IDs, timestamps, authors, comments and all existing reactions.
        _, err = tx.ExecContext(ctx, `UPDATE BaiDang SET noiDung = CASE
            WHEN TRIM(tieuDe) = '' THEN noiDung
            WHEN TRIM(tieuDe) = TRIM(noiDung) THEN noiDung
            WHEN TRIM(noiDung) = '' THEN tieuDe
            ELSE CONCAT(tieuDe, CHAR(10), CHAR(10), noiDung)
            END`)
        if err == nil {
            _, err = tx.ExecContext(ctx, "INSERT INTO schema_migrations(version) VALUES(?)", version)
        }
        if err != nil { _ = tx.Rollback(); return fmt.Errorf("preserve legacy titles: %w", err) }
        if err := tx.Commit(); err != nil { return fmt.Errorf("commit legacy conversion: %w", err) }
    }
    // Safe to retry after a crash: a committed ledger row skips conversion.
    if _, err := conn.ExecContext(ctx, "ALTER TABLE BaiDang DROP COLUMN tieuDe"); err != nil {
        return fmt.Errorf("remove legacy title column: %w", err)
    }
    return nil
}
