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
npm run seed              # build indexes, insert any missing curriculum rows (never overwrites admin edits)
npm run seed -- --reset   # put the curriculum back to the seed; accounts, samples and game data untouched
```

Models live in `src/lib/models/` (import from `@/lib/models`); connect with `connectDb()` from `@/lib/db`.
`GET /api/health` pings the database.

**The schema follows the project ERD exactly** — 12 tables and their columns — plus one approved addition,
`character_validations` (see Validation). Each primary key is
the ERD's integer column (`account_id`, `character_id`, …), taken from `counters`; MongoDB's own `_id` stays internal.
Don't add tables or columns without updating the ERD first.

| ERD tables | Notes |
| --- | --- |
| `roles`, `accounts`, `player_profiles` | `roles` is seeded with fixed ids (`src/lib/constants.ts`: admin 1, validator 2, contributor 3, player 4). A player gets a `player_profiles` row at sign-up. `account_id` is the anonymous ID shown to validators. |
| `categories`, `kawi_characters` | `unicode_codepoint` is `U+11F12`, or space-separated hex for a ligature (`11F12 11F42 11F31`, fits varchar(20)). Combining marks have `base_letter = "KA"`; `formOf()` in `src/lib/curriculum/forms.ts` builds the glyph to display. |
| `game_levels`, `quests`, `quest_tasks` | A character's level is the level of the quest it is a task of. `quests.parent_quest_id` nests a quest under another (null = top level). `quest_tasks` is keyed by (`quest_id`, `character_id`). |
| `handwriting_samples` | Contributor samples. |
| `game_sessions`, `player_attempts`, `player_quest_progress` | Written by the game (module 11), read by the web. `player_quest_progress` is keyed by (`account_id`, `quest_id`); `status` is 0 not started, 1 in progress, 2 completed (`QUEST_STATUS`). |

Sign-in plumbing lives outside the ERD in `sessions`, `auth_tokens` and `login_throttles`.

The seed holds the full inventory: 87 encoded characters (Unicode Kawi block, as listed in the thesis) + 20
ligatures = 107, with `character_id` in category order (vowels 1–13, consonants 14–47, digits 48–57, marked forms
58–74, punctuation 75–87, ligatures 88–107), and 9 levels in play order (House, City Museum, Station, the five
worlds, Great Hall). **The ligature list is provisional:** only KSA and KTA come from the sources; the other 18 are
placeholders until the Expert Validator signs off.

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

## Admin curriculum

`/admin/characters`, `/admin/levels` and `/admin/quests` edit the curriculum tables: filter bar → table → 340px
drawer, as in the design system. Server actions live next to each page (`actions.ts`) and go through `asAdmin()`
(`src/lib/admin/actions.ts`), which checks the admin session and refreshes the page.

- **Characters:** code points can be typed as `U+11F12`, `11F12`, a space-separated sequence, or pasted as Kawi text;
  they're stored in the ERD format. Marked forms need a base letter; ligatures must be consonant + conjoiner +
  consonant. "Taught in" comes from the quests the character is a task of. **Import CSV** (columns
  `unicode_codepoint, name, transliteration, category, base_letter`) updates matching code points and adds the rest,
  and writes nothing if any row is invalid. Deleting is blocked while samples or player attempts refer to the
  character; it is removed from every quest's task list.
- **Reference glyphs** (PNG, JPEG, WebP or SVG, under 512 KB) are stored in MongoDB GridFS (bucket `files`) and served
  to signed-in people from `/files/<path>` with a sandbox CSP (`src/lib/storage.ts`).
- **Levels:** area name and play order. Deleting is blocked while quests or game sessions refer to the level.
- **Quests:** level, `parent_quest_id` (sub-quests are listed under their parent; a quest can't be placed under itself
  or its own sub-quests) and the ordered task list (`quest_tasks`). Deleting is blocked while it has sub-quests or
  player progress.

## Admin accounts

`/admin/accounts` lists every account with role tabs and search (username, email, name or #id).

- **New staff account** creates a validator or admin (the only way to make either) with no password and sends a
  7-day set-password invite. Without `RESEND_API_KEY` the panel says the link was printed to the server console.
- The drawer shows name, email, account ID, birthday and how much data the account owns, and can **change role**
  (signs them out everywhere; becoming a player adds a `player_profiles` row), **send a password reset** (or resend a
  pending invite) and **sign out everywhere**.
- The ERD has no status column, so there is no "deactivate": **delete** is offered only for accounts with no
  handwriting samples, game sessions or quest progress. Admins can't change their own role or delete themselves, and
  the last admin can't be removed.

## Platform analytics

`/admin` is the admin dashboard, built only from what the ERD records (`src/lib/analytics/queries.ts`):

- Stat tiles: accounts by role, writers (contributors with samples) against the thesis target of 90, character
  samples against 107 classes × 180 (90 writers × 2 passes), and game sessions with play time.
- Class coverage grid (samples per character vs. 180, using the design system's coverage scale plus bar length),
  samples and in-game accuracy by category, writing attempts per week (last 8 weeks, Manila time), quest progress
  across players, and the hardest characters (lowest accepted rate, at least 5 attempts).
- Charts follow the dataviz skill: palettes checked with its validator (accepted `--ok` / not accepted
  `--copper-on-dark`; completed `--ok` / in progress `--good-bright`), thin marks, every chart with hover and
  keyboard-focus tooltips and a Table view. Chart parts are in `src/components/charts/`.
- Not shown, because the ERD doesn't record them: validation results, validator throughput, recognition confidence,
  and samples over time (`handwriting_samples` has no timestamp).

## Contributor canvas

`/contribute` is the writing canvas; `/contribute/submissions` lists the contributor's own samples.

- The target is the next character in this contributor's current **pass** (every character written once more),
  worked out from their existing `handwriting_samples` — the ERD has no pass column. "Skip for now" moves on within
  the session. Non-character mode saves the reject class (`is_non_character = true`, no `character_id`).
- The browser sends the drawing as exactly 2,500 grayscale pixels; the server builds the 50 × 50 grayscale PNG
  (`src/lib/png.ts`) and stores it at `samples/<account_id>/<sample_id>.png`, so nothing else can be uploaded.
- Feedback is usability only (empty, too small, touching the edge). The device (mouse / stylus / finger) is detected
  and shown but not stored, and strokes and submission time aren't stored either — the ERD has no columns for them.
- Sample images are served only to their writer, validators and admins. Contributors can remove their own samples.

## Validation

`character_validations` was added to the data model on 2026-10-26 (the one table beyond the ERD): one row per
validator decision — `validation_id`, `sample_id`, the validator's `account_id`, `status` (`approved` / `rejected` /
`flagged`), `remarks` (required to reject or flag), `validated_at`. A sample's status is its latest row; no row means
pending.

- `/validator` — the queue (`src/lib/validation/queries.ts`): category tabs with counts, character filter, and
  Pending / Flagged / Mine. Oldest sample first (`sample_id` order). The review pane shows the reference glyph beside
  the 50 × 50 sample and the contributor's account ID only. Keyboard: **A** approve, **R** reject, **F** flag, **S**
  skip; the next sample opens straight away.
- `/validator/reviews` — the validator's own decision history; `/validator/glyphs` — every reference form.
- Contributors see each sample's status; reviewed samples can no longer be removed. Validators with decisions can't
  be deleted from Accounts. The admin dashboard shows validation status and validator throughput.

## Modules

1. Foundation / UI kit ✔
2. Data layer ✔
3. Auth & accounts ✔
4. App shell ✔
5. Admin · Curriculum ✔
6. Admin · Accounts ✔
7. Admin · Analytics ✔
8. Contributor ✔
9. Validator ✔
10. Player
11. Game sync API
12. File storage ✔ (GridFS store and `/files` route, module 5; sample images, module 8)
