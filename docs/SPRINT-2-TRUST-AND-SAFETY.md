# Sprint 2 — Trust & Safety: reporting, blocking, comment controls

## Changes and migration
- New `user_blocks(blocker_id,blocked_id)` unique directed relationships.
- New `post_reports` keeps immutable content_snapshot plus reporter and reason. Deleting a post
  sets `post_id=NULL`, **retaining the report** for admin review. Reports are never public.
- Add `BaiDang.commentsEnabled TINYINT(1) NOT NULL DEFAULT 1`.
- All migrations are **additive**, checked against information_schema, and rerun safely at startup.
  Existing posts, comments, likes, uploaded media and MySQL volumes are retained.

## Behavior
- The post author can turn comments on or off via their three-dot menu. Existing comments
  remain readable, but no new comments can be posted while closed. The author may delete
  any comment under their post; the comment writer and admins also retain deletion rights.
- Logged-in users can report posts (not their own) with a restricted reason and up to
  500 Unicode characters of optional detail. Repeated reports by the same person on the
  same post receive HTTP 409. Only admins can view/edit the moderation queue.
- Admins choose "dismissed" or "actioned"; marking actioned is **not automatic deletion**.
  Deleting an offending post remains a deliberate, separately authorized action.
- Users can block/unblock another account. Blocking removes mutual follows. While either
  side has blocked, following, comments, reactions and new private messages are rejected.
  Authenticated public/Following feeds and saved-post pages filter posts by either blocked party.
- A personal list at /blocked lets users unblock; profile controls also support unblock.
- Guest-facing public profile and direct post URLs remain publicly accessible. Blocking is
  **not equivalent to making public posts private**, and this scope makes no anonymity promise.

## Routes
Protected JWT endpoints:
- `PUT|DELETE /api/v1/users/:id/block`
- `GET /api/v1/users/:id/block-status`, `GET /api/v1/users/blocks`
- `POST /api/v1/posts/:id/report` body {reason,details?}
- `PUT /api/v1/posts/:id/comments` body {enabled:true|false}, owner only
- `GET /api/v1/moderation/reports?status=pending|dismissed|actioned|all`, admin only
- `PUT /api/v1/moderation/reports/:id` body {status:'dismissed'|'actioned'}, admin only

## Tests and rollout
- Go unit test for allowed reason values; static contract checks;
  real MySQL/HTTP smoke covering permissions, comment close/open, two-party blocks,
  pending-report admin privacy, report deletion persistence; Chromium browser flow.
- Before pulling on an existing MySQL volume, back up the database.
- `docker compose down -v` deletes volumes; do not use it during this upgrade.

Out of scope: automatic content takedown, global anonymity/privacy modes, automated
moderation, appeal workflow, and notification system. These need separate reviews.
