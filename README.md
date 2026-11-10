# KawiQuest web

The statistics and data web app for KawiQuest: admin, validator, player and contributor roles on one
`accounts` collection. Next.js 16 (App Router, Cache Components) + MongoDB. The Unity game is a separate app.

```bash
npm install
npm run dev        # http://localhost:3000 — the component guide is at /ui (dev only)
```

## Design system

Styling follows the **KawiQuest** design system artifact (clean, light, flat; copper Kawi tiles, paper
canvas and Fredoka headings are the only links to the game).

- `src/styles/tokens.css` — generated from the design system's `tokens.json`. Don't hand-edit; re-copy it.
- `src/styles/kq.css` — the design system's `bundle.css` (the `kq-*` classes), with an appended section for
  patterns the screens need that the bundle left inline (drawer, field errors, link tabs, clickable rows).
- `src/app/globals.css` — imports both and points the font tokens at the `next/font` families.
- `src/components/ui/` — React components over those classes. Import from `@/components/ui`.

| Component | Use |
| --- | --- |
| `Button`, `ButtonLink`, `IconButton` | primary / secondary / danger / ghost; `sm`, `md`, `lg`; `iconOnly` keeps a screen-reader label |
| `Badge`, `StatusBadge`, `RoleBadge` | status always has an icon and a word |
| `Card`, `CardHead`, `CardBody`, `PageHead`, `FilterBar`, `Avatar` | page structure |
| `StatTile`, `ProgressBar` | one figure per tile; copper = collection target, patina = quality target |
| `DataTable` | columns with `render`; `onRowClick` only from a client component |
| `Tabs`, `Segmented` | `href` per item for URL filters on server pages, or `onChange` for client state |
| `TextField`, `SelectField`, `TextAreaField`, `Checkbox` | label, hint and error wired to `aria-describedby` |
| `Drawer`, `SplitLayout` | the 340px edit drawer; a full-height sheet under 960px; Escape closes |
| `Banner` | result banner (ok / bad / wait) |
| `CopperTile`, `GlyphCard`, `Logo`, `codePoints()` | Kawi forms in Noto Sans Kawi |

## Data

MongoDB through Mongoose. Copy `.env.example` to `.env.local` (defaults to the local MongoDB service), then:

```bash
npm run seed              # build indexes, insert any missing curriculum rows (never overwrites existing rows)
npm run seed -- --reset   # put the curriculum back to the seed and remove rows it doesn't have (keeps corrected
                          # reference images); accounts, samples and game data untouched
```

Models live in `src/lib/models/` (import from `@/lib/models`); connect with `connectDb()` from `@/lib/db`.
`GET /api/health` pings the database.

**The schema follows the project ERD** — 12 tables and their columns — plus these approved additions, which the
ERD (and the manuscript's Figure 6 / data dictionary) must show:

- `character_validations` (2026-10-26) — Expert Validator decisions on reference forms (see Expert validation).
- `accounts.is_active` (2026-11-10) — false = deactivated: can't sign in, data kept. `npm run seed` marks older
  accounts active.
- `game_builds` (2026-11-10) — FR3: `build_id`, `platform` (android), `version` (unique per platform),
  `model_version`, `notes`, `file_path`, `file_size`, `is_active` (one per platform), `uploaded_at`, `uploaded_by`.
- `player_achievements` and `player_items` (2026-11-10) — FR7: keyed by (`account_id`, `achievement_key`) and
  (`account_id`, `item_key`); written by the game through the sync API.
 Each primary key is
the ERD's integer column (`account_id`, `character_id`, …), taken from `counters`; MongoDB's own `_id` stays internal.
Don't add tables or columns without updating the ERD first.

| ERD tables | Notes |
| --- | --- |
| `roles`, `accounts`, `player_profiles` | `roles` is seeded with fixed ids (`src/lib/constants.ts`: admin 1, validator 2, contributor 3, player 4). A player gets a `player_profiles` row at sign-up. `account_id` is the anonymous ID shown to validators. |
| `categories`, `kawi_characters` | `unicode_codepoint` is one code point, `U+11F12`. Combining marks have `base_letter = "KA"`; `formOf()` in `src/lib/curriculum/forms.ts` builds the glyph to display. `reference_glyph` holds a corrected image uploaded by the Expert Validator (null = the Noto Sans Kawi form). |
| `game_levels`, `quests`, `quest_tasks` | Seeded for the game; the web has no pages for them. A character's level is the level of the quest it is a task of. `quests.parent_quest_id` nests a quest under another (null = top level). `quest_tasks` is keyed by (`quest_id`, `character_id`). |
| `handwriting_samples` | Contributor samples. Each has a 50 × 50 PNG at `image_path` and a stroke record beside it (same path, `.json`). |
| `game_sessions`, `player_attempts`, `player_quest_progress` | Written by the game (module 11), read by the web. `player_quest_progress` is keyed by (`account_id`, `quest_id`); `status` is 0 not started, 1 in progress, 2 completed (`QUEST_STATUS`). |

Sign-in plumbing lives outside the ERD in `sessions`, `auth_tokens` and `login_throttles`; unfinished APK uploads
in `build_uploads`.

The seed holds the manuscript's inventory: the 87 encoded characters of the Unicode Kawi block (thesis Table 2;
the CNN adds one reject class), with `character_id` in category order (vowels 1–13, consonants 14–47, digits 48–57,
marked forms 58–74 including the killer and the conjoiner, punctuation 75–87), and 9 levels in play order (House,
City Museum, Station, the five worlds, Great Hall). There are no ligatures. A database seeded before this change
still has the 20 ligature rows and the Ligatures category: `npm run seed -- --reset` removes them.

## Sign-in and accounts

Copy `.env.example` to `.env.local` and set `SESSION_SECRET` (the file shows how to generate one) and `APP_URL`.
Create the first admin; they get a set-password link (printed to the console unless `RESEND_API_KEY` is set):

```bash
npm run create-admin -- --email you@example.com --username your.name --first Juan --last "Dela Cruz"
```

- One sign-in for every role (`/sign-in`), routed by `accounts.role_id`: admin → `/admin`, validator → `/validator`,
  player → `/player`, contributor → `/contribute`. Self sign-up (`/sign-up`) creates players and contributors only.
- Sessions are rows in `sessions` named by an HMAC-signed `kq_session` cookie (httpOnly, SameSite=Lax). The proxy
  (`src/proxy.ts`) routes from the signed cookie alone; `requireAccount()` in `src/lib/auth/session.ts` is the real
  check in every page and action, so sign-out, password changes and role changes take effect at once.
- Passwords: scrypt (`src/lib/auth/password.ts`). Five wrong tries lock an account for a minute. Sign-in errors never
  say which field was wrong; forgot-password answers the same whether or not the account exists.
- Reset and invite links are single-use tokens (only their SHA-256 is stored): 30 minutes for resets, 7 days for invites.
- Pages that read the session do it inside `<Suspense>` (required by Cache Components).

## App shell

Every signed-in page sits in `AppShell` (`src/components/shell/`): a 236px sidebar and the main column. Each role's
area has a layout that picks its sidebar (`src/app/<area>/layout.tsx`); `/account` uses whoever is signed in. The nav
per role is in `nav.ts`. The nav is static and prerenders; item counts and the signed-in footer stream in. On phones
the sidebar becomes a top bar with a menu that closes on navigation. Pages not built yet show a placeholder
(`ComingSoon`), which still checks the role.

## Admin accounts (FR2)

`/admin/accounts` lists every account with role tabs, a Deactivated tab and search (username, email, name or #id).

- **New account** creates any role (the only way to make validators and admins) with no password and sends a
  7-day set-password invite. Without `RESEND_API_KEY` the panel says the link was printed to the server console.
- The drawer **edits** first and last name, email, username and birthday; **changes the role** (signs them out
  everywhere; becoming a player adds a `player_profiles` row); **sends a password reset** (or resends a pending
  invite); **signs them out everywhere**; and **deactivates or reactivates** the account.
- **Deactivate** keeps the data, ends every session and cancels pending links. A deactivated account is told so at
  sign-in (only after the right password, so it doesn't reveal which accounts exist), gets no reset emails, and
  can't use an old reset link.
- **Delete** is offered only for accounts with no samples, game data or validation decisions. Admins can't
  deactivate, demote or delete themselves, and the last active admin can't be removed.

For local testing, `npm run test-accounts` creates `admin`, `validator`, `contributor` and `player`, each with the
username as the password. It refuses to run unless `MONGODB_URI` points at localhost.

## Game builds (FR3)

`/admin/builds` uploads Android builds and chooses which one players get.

- **Upload:** the APK (up to 400 MB), its version (unique), the model version it expects, and release notes. The
  browser sends it in 4 MiB pieces (under Vercel's 4.5 MB request limit) to `/api/admin/builds/uploads`; each
  piece is written straight into GridFS as one chunk, and the file is registered when the last piece is in
  (`src/lib/builds/upload.ts`). Pieces are retried on network errors; a cancelled or failed upload is cleaned up,
  and abandoned ones expire after 6 hours. A file that isn't a ZIP (every APK is) is refused at the first piece.
- **Make active** picks the build players download; the first upload is active automatically. The active build
  can't be deleted.
- **Public:** `GET /downloads/kawiquest.apk` streams the active build; `GET /api/builds/latest` returns its version,
  model version, size and URL for the game's update check. Admins can download any build from the table.

## Admin dashboard

`/admin` is the admin landing page (FR1), plain counts with no charts (`src/lib/accounts/dashboard.ts`): accounts by
role, reference forms validated out of 87, writers against the thesis target of 90, and character samples against
87 × 180 (90 writers × 2 passes), plus non-character samples.

## Contributor canvas

`/contribute` is the writing canvas; `/contribute/submissions` lists the contributor's own samples.

- Only characters whose reference form the Expert Validator has validated (approved or corrected) are offered, and the
  server refuses samples for any other character. Until at least one form is validated, only non-characters can be drawn.
- The target is the next character in this contributor's current **pass** (every validated character written once
  more), worked out from their existing `handwriting_samples` — the ERD has no pass column. "Skip for now" moves on within
  the session. Non-character mode saves the reject class (`is_non_character = true`, no `character_id`).
- The browser sends the drawing as exactly 2,500 grayscale pixels; the server builds the 50 × 50 grayscale PNG
  (`src/lib/png.ts`) and stores it at `samples/<account_id>/<sample_id>.png`, so nothing else can be uploaded.
- Feedback is usability only (empty, too small, touching the edge). The device (mouse / stylus / finger) is detected,
  shown, and saved in the stroke record.
- Sample images are served only to their writer, validators and admins. Contributors can remove their own samples.
- Each sample is stored as the 50 × 50 PNG **and** a stroke record (manuscript: Dataset Development) at
  `samples/<account_id>/<sample_id>.json`: format `kawiquest-strokes/1`, the character, `input_method` (mouse,
  stylus or finger, for per-method results), submission time, and the strokes as point lists in 0–1 coordinates.
  Removing a sample removes both files.

## Expert validation (FR4)

`character_validations` (the one table beyond the ERD) records the Expert Validator's decisions on reference forms:
`validation_id`, `character_id`, the validator's `account_id`, `status` (`approved` / `corrected`), `remarks`
(required for corrected), `validated_at`. A form's status is its latest row; no row means pending. Approved and
corrected forms both count as validated and are used in data collection.

- `/validator` — every character's reference form (`src/lib/validation/queries.ts`): category tabs, Pending / Approved /
  Corrected / All. The review pane shows the form (the uploaded image, or the Noto Sans Kawi form on KA for marks),
  its name, transliteration and code point, and every earlier decision. **Corrected** needs remarks and can attach a
  corrected image (PNG, JPEG, WebP or SVG under 512 KB), which replaces the reference form. Keyboard: **A** approve,
  **C** corrected, **S** skip.
- `/validator/reviews` — the validator's own decision history.
- Validators with decisions can't be deleted from Accounts.
- Handwriting samples are not reviewed in the web app.

## Player dashboard (FR7)

`/player` shows the player's game data, view only (`src/lib/player/queries.ts`): current area, quests completed,
characters written correctly out of 87, writing accuracy; **assessment results** as one copper tile per character
(written correctly / practising / not tried) with accuracy per category; quest progress; play sessions; achievements;
and items. Until the game has synced anything, it says so and links the active build's download.

## Recognition service

`recognition/` is the separate FastAPI service that runs the CNN (POST `/predict`, decision rule, internal token);
see `recognition/README.md`. `npm run export-labels` writes `recognition/model/labels.json`, the class order training
and the service must share.

## Modules

Matched to the manuscript's functional requirements (FR1–FR7), the dataset collection portal and the services.

1. Foundation / UI kit ✔
2. Data layer ✔
3. Auth & accounts ✔ — FR1, FR5 (one sign-in for every role)
4. App shell ✔
5. Admin · Dashboard ✔ — FR1 landing page
6. Admin · Accounts ✔ — FR2 (create any role, edit, deactivate)
7. Admin · Game builds ✔ — FR3
8. Expert validation ✔ — FR4
9. Contributor (dataset collection portal) ✔ — PNG + stroke record per sample
10. Player · Profile ✔ — FR6 (`/account`)
11. Player · Game data dashboard ✔ — FR7
12. Game sync API — not built (FR8, FR12: game sign-in, progress, attempts, achievements, items, recognition)
13. File storage ✔ (GridFS `files` bucket: reference images, sample PNG + JSON, APKs)
14. Recognition service ✔ — `recognition/` (FastAPI + ONNX Runtime); waits for the trained `model.onnx`
