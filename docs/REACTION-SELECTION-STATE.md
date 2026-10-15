# Reaction selection state — ZenSpace

## Incident
The API correctly stores `Cam_Xuc.loaiCamXuc` and returns aggregate totals. The feed
only rendered the aggregate number, with a hardcoded button label "Cảm xúc".
Totals cannot reveal a specific user's selected reaction, so it stayed neutral even
after selecting "Bất ngờ".

## Contract
- `GET /api/camxuc/cua-toi?ids=1,2,3` requires a bearer token.
  Returns `{"success":true,"data":{"1":"wow","2":"love"}}` for that user only.
- Max 100 numeric positive post IDs per request; invalid input returns 400.
- `POST /api/camxuc/:id` continues to toggle the same reaction and switch
  between reaction types, returning `action=updated|deleted`.
- The UI derives emoji and label from the authenticated user's actual saved choice,
  marks the picker choice active, and updates after the mutation response.
- The feed loads individual choices **once per page**, not per post.
- On refresh, the choices are queried again from MySQL through the private API.

## Regression coverage
- Docker HTTP smoke checks auth rejection, cross-account privacy, invalid input,
  toggle, switching and restoration.
- Playwright Chromium checks the same reaction's visual label immediately and
  across page reloads, switching and toggling off.
- Frontend lint/build and existing Go/Windows/Docker regression jobs still run.

MySQL schema and historical reactions are unchanged.
