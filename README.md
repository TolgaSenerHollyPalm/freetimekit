# FreeTimeKit

Conversation cards for ten minutes a day: a few short facts, quiz questions and discussion questions, one card a
day from the topics you chose, and a weekend table where friends pass the phone around. One of the
[KitShelf](https://kitshelf.app) kits: free, no account, works offline, and the data stays on the device, backed up
as a file. It lives at [freetime.kitshelf.app](https://freetime.kitshelf.app).

Built from [kit-template](https://github.com/TolgaSenerHollyPalm/kit-template) on
[kitshelf-ui](https://github.com/TolgaSenerHollyPalm/kitshelf-ui), which brings the theme, the components and the
backups. The designs are in `docs/design/freetimekit/`; the plan it is built from is `docs/plans/06-freetimekit/PLAN.md`
in the quiz-trip repository.

## Development

Requires Node 26 (see `.github/workflows/deploy.yml`).

```bash
npm install
npm run dev        # http://localhost:5177/
npm test           # unit tests (Vitest), no network
npm run lint       # oxlint
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ with the service worker at http://localhost:4177/
```

The ports come from `.env` and are FreeTimeKit's own: on a port another kit has used, that kit's service worker would
open instead. The service worker only runs in the production build, so test offline behaviour with
`npm run build && npm run preview`.

## Cards and packs

The cards come in packs: `public/packs/index.json` lists the categories (id, label, colour, description) and the
packs, and each `ftk-<category>-<n>.json` holds a category's cards. A card has 3–4 facts, 1–3 sources, 3–5 quiz
questions with four options each, and 2–3 discussion questions. The app carries a copy of the index and replaces it
with the server's when that one's `updatedAt` is newer.

Packs are not in the service worker's cache. They are downloaded with `cache: 'no-store'`, at most ten seconds each,
and kept in IndexedDB, where the app reads them offline. A pack is checked before it is stored (`src/packs/validate.ts`):
schema version 1, ids unique across all packs, four different options, the counts above, no empty text, a known
category. They download by themselves when:
- the app opens more than six hours after the last check;
- the connection comes back;
- the welcome's "Başla" is pressed, or a backup was restored.

The automatic downloads are every pack of the interests, a newer version of every pack on the device, and the packs
of categories the progress, the weekend list or today's card come from. Other categories are downloaded by hand in
"Konular ve paketler".

A newer version replaces its pack whole. A card left out of it keeps its progress, but no list shows it.

To add a pack:
1. Write it from sources and have it checked independently.
2. Raise `version` (or add a file), list it in `index.json` and raise the index's `updatedAt`.
3. `npm test`: `src/packs/audit.test.ts` reads every file in `public/packs/` the way the app does.

## The day's card, the streak and the table

`src/cards/` holds every rule as pure functions with tests.

**The day's card.**
- It is picked once a day, together with three suggestions, and stays all day.
- The order: unseen cards from the interests, rotating through the categories; then other downloaded categories;
  then cards seen but not finished; finally a repeat day with a finished card.

**The streak.**
- A day counts when a card was finished that day, or on a repeat day when its card was opened.
- The streak counts such days in a row, from yesterday while today has not counted yet.

**The weekend list and the table.**
- The weekend list holds card topics and topics of one's own; one's own have discussion questions only.
- A table copies its topics when it starts.
- Each topic's quiz questions go round the players, carrying on across topics. A right answer is one point.
- The discussion questions are unscored, with an optional three-minute timer and a note each.

## Backups

`Ayarlar › Yedeği kaydet` writes `freetimekit-yedek-<date>.json` in kitshelf-ui's backup format: kit `freetimekit`,
data version 1, `data: { settings, progress, days, weekend }`. The packs and the table in play stay out; after a
restore the packs download again, including the categories the restored records use.

**Merging:**
- A card's progress merges field by field, so a finished card never comes back unfinished.
- A day keeps the counted cards of both sides.
- The list keeps the newer of each topic.
- The settings: the newer wins, and any backup's replace the ones the welcome saved without a stamp.

**Replacing** takes all four from the file and drops the table.

The welcome's "Yedeğin var mı? Geri yükle" opens the same restore, and restored interests skip the welcome.
`src/backup/` holds the kit's side: the texts, the checks a file has to pass, the merge and the restore plan.

## Where things are

| Path | What |
| --- | --- |
| `.env` | The kit's id, name, description and ports; `kit.config.ts` checks them and stops the build on a bad value. |
| `src/kit.ts` | The same identity for the code, and `KEYS`: every localStorage key, all starting with `freetimekit-`. |
| `src/kit.css` | FreeTimeKit's amber: four tokens in both schemes, over kitshelf-ui's defaults. |
| `public/favicon.svg`, `scripts/generate-icons.sh` | The icon and the PNGs made from it and from the maskable drawing in `docs/design/freetimekit/icons/`. |
| `public/packs/` | The card packs and their index. |
| `src/packs/` | Pack types, the checks, the downloads and the audit of the published files. |
| `src/cards/` | The library, the day's card and suggestions, progress and the streak, the weekend list, the table, dates. |
| `src/backup/` | The merge, the backup adapter, the restore plan and the restore flow the settings and the welcome share. |
| `src/storage/` | IndexedDB (`packs`, `progress`, `days`, `weekend`, `meta`) through `idb`, the migration steps, and what "Tüm verileri sil" removes. |
| `src/app/`, `src/screens/`, `src/ui/` | The app shell, the data and the router; the screens; the category tiles, the options and the icons. |
| `.github/workflows/deploy.yml` | Tests, builds and publishes to GitHub Pages on every push to `main`. |

## Publishing

A push to `main` runs `.github/workflows/deploy.yml`: `npm ci`, the tests, the build and the upload to GitHub Pages.
The custom domain `freetime.kitshelf.app` is set in the repository's Pages settings. In Cloudflare it is a CNAME to
`tolgasenerhollypalm.github.io`, DNS only. No CNAME file is needed with an Actions deployment.

Pages serves files with `cache-control: max-age=600`, so a deploy, a new pack included, can take up to ten minutes to
show. Visits are counted by Cloudflare Web Analytics, without cookies, with the snippet the other kits use. Pack
requests carry nothing of the user's.

## Icons

`public/favicon.svg` is the app icon and the mark on the home screen. After changing it, regenerate the PNGs (macOS
only, uses the built-in `sips`):

```bash
npm run icons -- docs/design/freetimekit/icons/freetimekit-maskable.svg
```
