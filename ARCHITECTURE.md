# ZenSpace v2

## Structure
- apps/api: Go + Gin modular backend. JWT, MySQL, posts, comments, reactions, profiles, chat, follow, chronological feed.
- apps/web: React + Vite + Bootstrap 5 frontend.
- ZenSpaceDB_latest.sql: database schema and seed data.

## Data migration and rollback
Existing MySQL tables (TaiKhoan, BaiDang, binhluan, Cam_Xuc, tin_nhan) are kept. Startup migration only creates the additive follows table. Preserve the Docker MySQL volume and data/uploads.
BEFORE upgrading: take a MySQL dump, back up data/uploads and .env, and save the last working commit. The SQL import only runs when the database volume is empty. Never run docker compose down -v during normal updates.

New passwords use bcrypt. Existing plaintext passwords are upgraded after a successful login, so old accounts continue working. Change demo passwords before any external exposure.

The codebase now operates entirely on the new architecture (apps/api and apps/web). Historic code remains safely preserved in Git history.

## Architecture direction
A Go modular monolith. Internal HTTP endpoints are organized by feature for this first migration; further separation into services and repositories should follow real business complexity. Gin handles routing and auth. MySQL remains source of truth, Redis remains optional. NoSQL may be added in a later, measured stage.

## Security / production TODO
Rate limits, password-reset flow, stronger media validation, audit log, automated integration tests, privacy model, notification system, cursor pagination and production-grade observability. This migration is not yet a security certification or production-hardening completion.
