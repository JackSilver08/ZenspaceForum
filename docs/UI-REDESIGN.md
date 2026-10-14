# ZenSpace · Premium Dark UI (Sprint UI-1)

This is a **review-only UI branch**, not a production rollout. The new visual language is a dark, atmospheric social product with restrained violet/cyan lighting and clear reading hierarchy. The MySQL/Go/Gin API and existing `/api` contracts remain unchanged.

## Scope

- Responsive app shell: desktop left rail, main feed, right exploration panel; mobile bottom navigation.
- Shared color, type, spacing and surface tokens in `apps/web/src/styles/tokens.css`.
- Dedicated React Home Feed in `apps/web/src/features/feed/FeedPage.jsx`.
- Working composer (text and optional supported media), chronological community feed / following feed, post reactions, copy-link sharing, delete-own-post, and post detail navigation.
- Loading, empty, error and file-size handling.
- Compatibility styles preserve the old login/register, profile, post detail, explore and chat pages until their own redesign sprints.

## Preview

```powershell
git fetch origin
git switch feature/ui-redesign-premium-dark
.\START.bat
```

Visit http://localhost:8089 (or the launcher-reported web port). Local changes and data should be backed up before switching branch. Do **not** use `docker compose down -v` during UI testing.

To return to the original interface, switch back to `main` and rebuild Docker.

## QA review checklist

1. Desktop: sidebar / card reading width / right panel at 1440px and 1080px.
2. Mobile: bottom navigation / composer / post card at 390px and 760px.
3. Public: community feed, discover users, post detail, login page.
4. Authenticated: composer, optional media, reaction selector, follow feed, delete own post, chat/profile links, logout.
5. Accessibility: keyboard focus, reduced motion, button labels, readable text.

## Constraints / known follow-up

- No new backend endpoints or database migrations.
- Legacy page internals are deliberately retained; profile, explore, chat, comments and auth get fully redesigned in subsequent UI sprints.
- Following feed remains chronological based on server-side follow relationships.
- External fonts use local system fallbacks when offline.
- Do not merge until a visual review plus GitHub Actions CI pass.
