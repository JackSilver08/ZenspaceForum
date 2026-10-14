# Prevent React white screens (October 2026)

## Incident
User reported blank localhost:8089 and DevTools `ReferenceError: Orbit is not defined`.
The home feed referenced `<Orbit />` without importing it from `lucide-react`.
This broke the entire React render. Vite's production build succeeded because it did not
perform undeclared-JSX-symbol checks; prior Docker smoke tests fetched JS bundles
over HTTP but did not execute them in a browser.

## Fix and regression controls
1. Import `Orbit` explicitly in `FeedPage.jsx`.
2. Run ESLint `no-undef` and `react/jsx-no-undef` on **all frontend source** before the build.
3. Run Playwright + Chromium **against the live Docker Compose website and API**. It checks
   guest feed, Explore/Login, authenticated composer/following, and mobile navigation.
   It fails if any uncaught browser JavaScript exception occurs or critical content is absent.
4. CI saves Playwright failure screenshots/traces for debugging.

## Manual verification (Windows)
After merge:
```powershell
git status
git pull --ff-only origin main
.\START.bat
```
Visit http://localhost:8089 and press Ctrl+Shift+R if a previous frontend bundle is cached.
The app must show the `Bảng tin` heading, a post list, and the navigation.
Do not use `docker compose down -v` or delete MySQL volumes to solve browser rendering errors.

Browser CI verifies Chromium on Linux; Windows Docker Desktop and additional browsers
still warrant manual QA before production.
