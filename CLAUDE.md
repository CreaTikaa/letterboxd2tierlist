# Notes for agents

Vite + React 19 + TypeScript, Tailwind v4, Zustand (persisted to IndexedDB), dnd-kit, Trystero (P2P rooms), TMDB API. Node 24 (`.node-version`).

## Checks
- `npm run typecheck`, `npm run lint` (oxlint), `npm test` (Vitest, `src/**/*.test.ts`), `npm run test:e2e` (Playwright, `e2e/*.e2e.ts`).
- E2E: TMDB is mocked in `e2e/support.ts` (fixtures are generated zips). Pin `locale: 'en-US'`. Rooms connect over public Nostr relays, so room tests can be slow/flaky (CI retries 2×).
- Saves are batched 150 ms (`src/store/useStore.ts`); use `waitForSave(page)` before a reload in tests.
- Right after a dnd-kit drag, the next click is swallowed briefly; tests retry the tap (`room.e2e.ts`).

## Conventions
- All UI text goes through `src/i18n` (`en.ts` is the source; `fr`, `zh`, `pt` must have every key; plurals use `_one`/`_other`). Non-English dictionaries are lazy-loaded (`loadLanguage`).
- The language e2e test fails if any English text is left on a Chinese screen.
- PRs target `main`; the owner merges.

## State of the "big batch" (branch feat/big-batch)
Done: tap-to-place + keyboard, undo/redo (`src/hooks/useHistory.ts`) on all boards + Z/Ctrl+Z in tournament and ranking, likes/lists import + source select, director/actor filter (TMDB credits), Rank everything (`src/lib/rank.ts`, `src/pages/RankPage.tsx`), share links v2 for tournaments/rankings (`src/lib/share.ts`), bracket view, compare page (`src/lib/compare.ts`, `src/pages/ComparePage.tsx`), lazy dictionaries, Playwright suite + CI job.

Ideas not done yet:
- Lists without a metadata block are named from the file name in lower case ("guilty pleasures"); could capitalise.
- Saves pending during a reload within 150 ms of a change can be lost (IndexedDB write on `pagehide` isn't guaranteed).
- Compare page: also accept tournament/ranking links; compare two rooms' showdown lists.
- Bracket image export (the PNG is still the standings layout).
