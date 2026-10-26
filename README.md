# letterboxd2tierlist

Turn every film you've logged on [Letterboxd](https://letterboxd.com) into a tier list, filtered by your own star ratings. Rank together with friends in a room, or crown your favourite film in a tournament.

### Tier list

- **Import** your Letterboxd data export (ZIP). It's parsed entirely in your browser; nothing is uploaded.
- **Posters** are fetched from [TMDB](https://www.themoviedb.org) with your own free API key.
- **Filter** by rating (any mix of ½★ to 5★, with or without unrated films), **genre**, title and release year.
- **Rank** on a drag-and-drop board. *Auto-fill by rating* pre-places films using a rating→tier mapping you can edit.
- **Export**
  - a **PNG** of your tier list,
  - a **TierMaker poster pack** (ZIP of posters named `Title (Year).jpg`, split into 500-image batches) to upload as a [TierMaker](https://tiermaker.com/create) template, optionally with the title and your rating drawn on each poster,
  - a **JSON save file** to back up or move your board,
  - a **share link**: a read-only view of your tier list that anyone can open. No account or server is involved; the list is compressed into the link itself.

### Rooms (with friends)

- **Create a room** and send the invite link. Everyone shares their Letterboxd films with the room.
- **Group board**: one tier list everyone edits live. It holds every film anyone has watched, each showing the group's average rating and how many people saw it. Filter by group average or by "seen by at least N people", and auto-fill from the average.
- **Password (optional)**: set one when creating the room, and only people who know it can connect. "Copy link + password" makes an invite that includes it (it's removed from the address bar once opened).
- **Showdown**: the host picks a set of films (for example, ones everyone has seen). Everyone ranks them on their own board in secret, the host reveals all the lists at once, and everyone votes for the best 👑 and worst 💀 list. The results show the winner and the films that split the room most. In **Guess whose list** mode, lists are revealed without names, and everyone also guesses who made each one. The results then reveal the authors, the best detectives and the easiest list to recognise.
- **Group tournament**: one bracket for the whole room, drawn from films everyone has seen (or at least N of you) and seeded by the **median** rating across the room. Everyone votes on each matchup. A match is decided when everyone online has voted (or the host closes the vote), with the majority winning and ties going to the better seed. Votes stay hidden until the match is decided. The results list every vote.
- Posters are fetched by anyone in the room who has a TMDB key, then shared with everyone else.

Rooms are **peer-to-peer** (WebRTC via [Trystero](https://github.com/dmotz/trystero)). Browsers find each other through public Nostr relays and then talk directly. There's no server and nothing stored online. The room's first visitor acts as host; if they leave, another member takes over automatically. Every browser keeps a copy of the room, so anyone can reopen it later from the same link. Some strict networks (certain corporate or mobile ones) block direct connections.

### Tournament (UwUfufu-style)

- Pick a bracket of 8–256 films: your top-rated ones or a random draw, filtered by minimum rating.
- Films are **seeded by your rating**, so your favourites can only meet in the late rounds. Top seeds get byes when the count isn't a power of two.
- Pick one film per matchup (click, or press ←/→, with Z to undo) until a champion remains. You get final standings, the biggest upsets and a downloadable results image.
- Optionally limit the bracket to one genre.
- **Send to my tier list** turns the result into tiers: champion in S, runner-up in A, semi-finalists in B, and so on. In rooms, it sends the result to the group board.

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

Stack: Vite, React, TypeScript, Tailwind CSS, dnd-kit (drag and drop), Zustand + IndexedDB (state that persists between visits), JSZip, PapaParse, Trystero (peer-to-peer rooms).

```
src/
  lib/letterboxd/   export ZIP/CSV parsing and merging
  lib/tmdb/         TMDB client and title/year matching
  lib/export/       PNG renderers, TierMaker ZIP, save files
  lib/room/         room state, ops, sync protocol (session.ts), group merging, showdown scoring, group tournament voting
  lib/tournament.ts bracket seeding, picks, standings
  lib/share.ts      share links (tier list ⇄ compressed URL)
  lib/              filters, genres, tiers, rating helpers
  store/            Zustand stores (app, room session), poster lookup, import
  pages/            tier list, rooms lobby, room, tournament, shared view (hash routes: #/, #/rooms, #/room/CODE, #/tournament, #/view/…)
  components/       UI (board/ = drag-and-drop tier board, room/ = room panels)
```

The room protocol is host-authoritative. The host numbers every change and broadcasts it; followers apply changes in order and fetch a full snapshot when they detect a gap. When two hosts meet, an *anchored* copy (the creator's, one received from the room, or a saved one) beats a fresh copy from someone who just opened the link; otherwise the newer room wins. The protocol sits behind a small `Transport` interface, so `session.test.ts` runs it against an in-memory network to test joining, syncing, host hand-off and room revival.

Pushing to `main` runs lint, tests and build, then deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB. Not affiliated with Letterboxd, TierMaker or UwUfufu.
Thanks to letterboxd for their amazing website.
Thanks to Claude Code allowing me to make this.
