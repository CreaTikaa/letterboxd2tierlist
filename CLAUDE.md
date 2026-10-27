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

## State
Merged (#6, "big batch"): tap-to-place + keyboard, undo/redo (`src/hooks/useHistory.ts`) on all boards + Z/Ctrl+Z in tournament and ranking, likes/lists import + source select, director/actor filter (TMDB credits), Rank everything (`src/lib/rank.ts`, `src/pages/RankPage.tsx`), share links v2 for tournaments/rankings (`src/lib/share.ts`), bracket view, compare page (`src/lib/compare.ts`, `src/pages/ComparePage.tsx`), lazy dictionaries, Playwright suite + CI job.

Branch feat/find-and-compare: "Find a film" on every board + Ctrl+F (`src/components/board/FindFilm.tsx`, `findFilms`/`foldText` in `src/lib/filter.ts`), compare accepts tournament/ranking links (`rankingAsList`, `tournamentAsList`), bracket image (`src/lib/export/bracketPng.ts`), list names capitalised, unsaved changes rescued to localStorage on `pagehide` (`src/store/useStore.ts`).

Tests: copy buttons are async, so read links with `copyLink(page, button)` from `e2e/support.ts`, never straight from the clipboard.

Ideas not done yet:
- Compare two rooms' showdown lists.
- Lists imported before the capitalisation fix keep their lower-case name until re-imported.
