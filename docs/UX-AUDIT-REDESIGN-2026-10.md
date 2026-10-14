# ZenSpace UX audit – feed-first redesign (October 2026)

## Evidence and limits
This change implements the direction in the owner's 8-page `ZenSpace UX/UI Review & Redesign Direction` PDF (15 October 2026) based on the supplied desktop screenshot. Report scores are **qualitative from an image**, not actual user testing. We have not measured conversion or task completion.

## Product priorities (PDF pages 2–5)

| Original issue | Decision | UX rationale |
| --- | --- | --- |
| P0: 3 columns compete | Start with 212px navigation, 700px feed, 250px suggestions; right column disappears below 1250px | Reading has priority |
| P0: oversized hero pushes posts down | Replaced with title and one-line description, compact orbit mark | Show composer and posts sooner |
| P0: short posts consume excessive height | Smaller card padding, no fake privacy badge, no duplicate read-link, no repeated hashtags; optional engagement stats only if present | More posts above fold |
| P1: confusing `Bảng tin`, `Khám phá`, `Cộng đồng` | `/` = public feed; `/following` = followed accounts; `/explore` = people search; `/messages` = private messages | Explicit destinations, no duplicate feed tab |
| P1: widget noise | Remove spotlight, inspiration map, recent posts (already in feed) and ornamental sidebar card; keep **one** real people-suggestions card | Every module supports a user action |
| Header author + sidebar author duplicated | Header account dropdown with profile and signout; sidebar only navigation | No repeated account module |
| Create-post CTA vs form | Header action scrolls to and expands the **same** composer | Single task destination |
| Overly long composer with poetic placeholders | Initially collapsed; concise title+body labels; optional media; clear cancel/publish states; warn before abandoning draft | Faster posting, better feedback |

## Visual system (PDF page 6)
- Background: `#F8F7F4`, surface: `#FFFFFF`, text: `#222235`, secondary: `#5C6274`.
- PDF suggests `#1F80FF` primary. **For white text**, `#1F80FF` only yields about 3.76:1 contrast; the implementation uses darker `#096BDC` (~5.06:1). Original blue survives as a highlight.
- Deep violet `#4B3A82` and subtle rose remain for astronomical brand character, not full-size ornamental widgets.
- Consistent 4/8px-based spacing and 40–44px interactive targets; headings, post content and metadata have distinct size/weight.

## API and data
Unchanged Go/Gin, MySQL, Docker, uploaded files and post data.
- `/baiviet` = public feed; `/v1/feed` = followed accounts.
- `/timkiemnguoidung` for sidebar suggestions; no fictitious follower counts.
- Creation still POSTs multipart to `/baiviet`; reactions/comments/share retain existing routes.
- The screenshot includes test-like posts. Do not destroy existing user data to make the demo cleaner. Curate a **separate** demo dataset before a public presentation.

## Acceptance (PDF pages 7–8)

### Automated checks
- `python3 scripts/check_stitch_design.py`
- `python3 scripts/check_ux_audit.py`
- `npm run build` and the existing Go/Windows/Docker integration CI.

### Manual tests required before merge
- 1440, 1280, 1024, 768, and 390px; no horizontal scrolling.
- Reading: page title, composer and first card appear early; content remains comfortable to read.
- Navigation: `Bảng tin`, `Đang theo dõi`, `Khám phá`, `Tin nhắn` always lead to the expected view.
- Create post: header opens composer; form validates required fields, posting/failed/success states, upload; cancel warns when draft is unsaved; refresh warns.
- Posts: detail link, reaction toggle, comment, copy/share, delete-author-only work.
- Account menu: keyboard focus and logout, logged-out states.
- Check keyboard tab/focus, screen-reader labels, hover/active/disabled/empty/error states and color contrast.
- Content audit: demo posts should be curated without deleting production records.

**Do not equate successful build/CI with actual usability acceptance.** The PDF explicitly requires the redesign to be reviewed in the running product.
