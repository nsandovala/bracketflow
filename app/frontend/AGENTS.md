# Frontend Agent Notes

## Next.js warning

This project uses a modern Next.js App Router stack. Before changing framework-level behavior, confirm current conventions in local docs or installed packages instead of relying on stale defaults.

## BracketFlow frontend notes

- Main screen lives in `app/page.tsx`
- API client lives in `lib/api.ts`
- Styling is intentionally centralized in `app/globals.css`
- Keep the current dark dashboard layout; do not replace it with a marketing landing page
- Prefer extending the existing screen instead of splitting the MVP into many routes

## Current UI scope

- Tournament creation with format selection
- Manual teams
- Players
- Roulette 2v2 and 3v3
- Battle royale rounds
- Result entry
- Leaderboard
- Round-by-round scoring detail
- Classic bracket compatibility

## Validation

```powershell
cd frontend
npm run lint
```
