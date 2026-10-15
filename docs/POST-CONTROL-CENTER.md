# ZenSpace Post Control Center — Sprint 1

## User-facing features
The shared `PostActionsMenu` works on Home Feed, Following, Saved, Profile and Post Detail.
Authors can edit their text and pin/unpin one post on their profile. Everyone
signed in can save/unsave a post (private to them), and hide someone else's
post from *their own* feeds. The Feed shows an Undo control after hiding.
Authors/admins retain the delete action.

## New MySQL schema (automatic, additive)
- `post_bookmarks(user_id, post_id, created_at)`: unique (user,post), cascading
  foreign keys to `TaiKhoan` and `BaiDang`.
- `post_hides(user_id, post_id, created_at)`: same design.
- `BaiDang.pinnedAt DATETIME NULL`: pin indicator and pinned-first Profile order.
- Existing IDs, body, media, comments, reactions and follows are unchanged.
- `MigratePostControls` executes at backend startup, after legacy migrations,
  checks information_schema before adding the column and is safe to rerun.

## API contracts (all protected by JWT)
- `GET /api/v1/posts/my-state?ids=1,2` gives `{data:{bookmarked:[1],hidden:[2]}}`, max 100 IDs.
- `PUT|DELETE /api/v1/posts/:id/bookmark` save / unsave.
- `PUT|DELETE /api/v1/posts/:id/hide` hide / unhide.
- `PUT|DELETE /api/v1/posts/:id/pin` pin / unpin; **author only**.
- `GET /api/v1/bookmarks` lists posts saved by authenticated user.
- `GET /api/v1/feed/public` filters viewer's hidden posts.
- Authenticated `GET /api/v1/feed` (Following) also filters hidden posts.
- Public guest `GET /api/baiviet`, profile and direct post URLs remain
  public; hiding is *not* global content removal.
- Editing uses existing `PUT /api/baiviet/:id` (only owner or admin).

## Test and rollout
Existing Go, React, Docker/MySQL and Playwright CI remains mandatory.
CI smoke checks permission boundaries, save/unsave, hide/unhide and private
visibility, pin changes and repeat-run migration.
Back up personal MySQL volumes before updating. There is NO volume deletion
or schema data reset. Do not run `docker compose down -v`.
