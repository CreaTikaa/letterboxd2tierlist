# letterboxd2tierlist

Turn every film you've logged on [Letterboxd](https://letterboxd.com) into a tier list, filtered by your own star ratings.

- **Import** your Letterboxd data export (ZIP). It's parsed entirely in your browser; nothing is uploaded.
- **Posters** are fetched from [TMDB](https://www.themoviedb.org) with your own free API key.
- **Filter** by rating (any mix of ½★ to 5★, with or without unrated films), title and release year.
- **Rank** on a drag-and-drop board. *Auto-fill by rating* pre-places films using a rating→tier mapping you can edit.
- **Export**
  - a **PNG** of your tier list,
  - a **TierMaker poster pack** (ZIP of posters named `Title (Year).jpg`, split into 500-image batches) to upload as a [TierMaker](https://tiermaker.com/create) template, optionally with the title and your rating drawn on each poster,
  - a **JSON save file** to back up or move your board.

## Using it

1. On Letterboxd: **Settings → Import & Export → Export your data**. You get a ZIP.
2. Open the app and drop the ZIP on the page.
3. Open **Settings** and paste a TMDB key: create a free account, then copy the *API Key* or *API Read Access Token* from <https://www.themoviedb.org/settings/api>.
4. Filter, click **Auto-fill by rating**, drag things around, then **Export**.

Click any poster to open it on Letterboxd or fix a wrong TMDB match. You can search by title, TMDB id or TMDB URL.

### Uploading to TierMaker

TierMaker has no API, so the poster pack is uploaded by hand. Go to <https://tiermaker.com/create>, fill in the template details and drag in the images. TierMaker accepts **500 images / 50 MB per upload** and **3,000 images per template**. Bigger packs come split into `batch-01/`, `batch-02/`… folders: publish with the first batch, then edit the template to add the next ones.

## Development

Requires Node 22.12+ (the repo pins Node 24 in `.node-version`).

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run build      # type-check + production build into dist/
```

Stack: Vite, React, TypeScript, Tailwind CSS, dnd-kit (drag and drop), Zustand + IndexedDB (state that persists between visits), JSZip, PapaParse.

```
src/
  lib/letterboxd/   export ZIP/CSV parsing and merging
  lib/tmdb/         TMDB client and title/year matching
  lib/export/       PNG renderer, TierMaker ZIP, save files
  lib/              filters, tiers, rating helpers
  store/            Zustand store, poster lookup, import
  components/       UI (board/ holds the drag-and-drop tier board)
```

Pushing to `main` runs lint, tests and build, then deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB. Not affiliated with Letterboxd or TierMaker.
