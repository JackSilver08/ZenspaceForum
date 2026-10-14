# ZenSpace — Stitch Cosmic Atelier adaptation

## Source materials
The design direction was supplied by the project owner as a Stitch export:
- `DESIGN.md` specifying an editorial, celestial design system
- `screen.png` illustrating the home feed and right-side panels
- `code.html` as a **static** Tailwind HTML mockup

The mockup was studied and reimplemented in the existing React/Vite + Bootstrap 5 project. The Stitch HTML was **not** copied into the app because its screenshots, names, engagement totals, astronomy calculations, and navigation were placeholders and not connected to backend features.

## Applied design decisions
- Warm ivory `#fbf9f6`; raised milk-paper `#f5f3f0`; white content panels
- Midnight ink `#141c30`, dark violet `#4b3a82`, restrained nebula rose `#b94e7d`
- Space Grotesk headlines and Plus Jakarta Sans long-form text, with system fallbacks
- Astronomy orbital geometry drawn with SVG/CSS rather than remote prototype image links
- Stitch-style broad editorial hero, hairline cards, pill controls, left dock, right discovery column, mobile navigation
- Follow feed, post creation and media, reactions, deletion, comments links, profile links, and share link continue to use existing functional APIs
- "Câu chuyện gần đây" gets **real posts** from `GET /api/baiviet?limit=3`; no invented follower counts, trends, accounts, or realtime claims
- Legacy `/IMG/ZenUser.png` falls back to a neutral typographic avatar without deleting people's uploaded images

## Non-functional reference elements consciously omitted
- Static 24.8k user and 142k post metrics
- Imaginary suggested people, hashtags, popularity numbers, timezones/moon phase
- Poll, bookmark, AI astronomy suggestion, and other controls not yet supported by the backend
- External Stitch `lh3.googleusercontent.com/aida-public/*` demo images

## Compatibility
This phase is focused on the Stitch home-feed screenshot. Profile, Explore, Auth, Messages, and Post Detail remain functional and are styled with a light compatibility layer; they require bespoke page design in subsequent sprints.
MySQL schema, Go/Gin endpoints, the legacy source folder, and media volumes are unchanged.

## QA
Run `npm run build`, Go tests, Windows launcher syntax checks, and Docker Compose smoke. Manually validate at 1440px, 1024px, and 390px. Do not merge unless CI passes; never remove volumes with `docker compose down -v`.
