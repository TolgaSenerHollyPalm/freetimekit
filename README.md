# FreeTimeKit

Conversation cards for ten minutes a day: a few short facts, quiz questions and discussion questions, one card a
day, and a weekend table where friends pass the phone around. One of the [KitShelf](https://kitshelf.app) kits:
free, no account, works offline, and the data stays on the device, backed up as a file. It will live at
`https://freetime.kitshelf.app`; it is not published yet.

Built from [kit-template](https://github.com/TolgaSenerHollyPalm/kit-template) on
[kitshelf-ui](https://github.com/TolgaSenerHollyPalm/kitshelf-ui), which brings the theme, the components and the
backups. The designs are in `docs/design/freetimekit/`; the plan it is built from is `docs/plans/06-freetimekit/PLAN.md`
in the quiz-trip repository.

## Development

Requires Node 26 (see `.github/workflows/deploy.yml`).

```bash
npm install
npm run dev        # http://localhost:5177/
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ with the service worker at http://localhost:4177/
```

The ports come from `.env` and are FreeTimeKit's own: on a port another kit has used, that kit's service worker would
open instead. The service worker only runs in the production build, so test offline behaviour with
`npm run build && npm run preview`.

## Where things are

| Path | What |
| --- | --- |
| `.env` | The kit's id, name, description and ports; `kit.config.ts` checks them and stops the build on a bad value. |
| `src/kit.ts` | The same identity for the code, and `KEYS`: every localStorage key, all starting with `freetimekit-`. |
| `src/kit.css` | FreeTimeKit's amber: four tokens in both schemes, over kitshelf-ui's defaults. |
| `public/favicon.svg`, `scripts/generate-icons.sh` | The icon and the PNGs made from it and from the maskable drawing in `docs/design/freetimekit/icons/`. |
| `public/packs/` | The card packs and their `index.json`; the service worker leaves them out, the app downloads them. |
| `src/app/`, `src/screens/` | The app shell, the router and the screens. |
| `.github/workflows/deploy.yml` | Tests, builds and publishes to GitHub Pages; started by hand until the release. |

## Icons

`public/favicon.svg` is the app icon and the mark on the home screen. After changing it, regenerate the PNGs (macOS
only, uses the built-in `sips`):

```bash
npm run icons -- docs/design/freetimekit/icons/freetimekit-maskable.svg
```
