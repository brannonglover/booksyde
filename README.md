# Booksyde

A colourful, social home for readers: track what you read, discover books by mood and trope,
and read along with friends.

## Repo layout

```
apps/
  web/        Next.js 16 (App Router, Tailwind v4): website + SEO-friendly book pages
  mobile/     Expo SDK 58 (Expo Router): iOS + Android
packages/
  shared/     Typed Supabase client, queries, Zod schemas, ISBN + formatting utils
  types/      Database types generated from the Supabase schema
  theme/      Design tokens (colours, genre colours, fonts, spacing) shared by both apps
supabase/
  migrations/ SQL schema, RLS policies, triggers, RPC functions
  seed.sql    Tags + a few public-domain classics for local dev
  import/     Notes for importing the Open Library catalog
```

npm workspaces + [Turborepo](https://turbo.build). Internal packages ship TypeScript source;
Next compiles them via `transpilePackages`, Metro handles them natively.

## Getting started

Requirements: Node 20+, and [Docker](https://www.docker.com/) for the local Supabase stack.

```bash
npm install
npm run db:start          # local Supabase (prints URL + publishable key)
cp apps/web/.env.example apps/web/.env.local       # fill in the values
cp apps/mobile/.env.example apps/mobile/.env.local
npm run dev:web           # http://localhost:3000
npm run dev:mobile        # Expo dev server (press i / a for simulators)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run every app's dev server |
| `npm run build` | Build everything |
| `npm run typecheck` | Typecheck every workspace |
| `npm run db:start` / `db:stop` | Start/stop local Supabase |
| `npm run db:reset` | Rebuild the local DB from migrations + seed |
| `npm run db:new <name>` | Create a new migration file |
| `npm run db:types` | Regenerate `packages/types` from the local DB |

## Data model

A **work** is the abstract book (_Dune_); an **edition** is a specific printing with its own
ISBN, format and cover. Ratings and reviews attach to works.

- **Catalog**: `works`, `editions`, `authors`, `work_contributors`, `series`, `tags`
  (genre / mood / trope / pace / content warning). Public read; librarians and the service role write.
- **Reading**: `user_books` (status shelves), `reading_sessions` (rereads + progress),
  `shelves` / `shelf_items` (custom shelves).
- **Social**: `reviews` (half-star ratings), `review_likes`, `review_comments`, `follows`
  (private profiles get follow requests), `tag_votes`, `activities` (feed), `clubs`.
- **Search & discovery**: `search_works()` (full-text + typo-tolerant trigram),
  `similar_works()` (pgvector), `get_feed()`.

Counters (`avg_rating`, `ratings_count`, `likes_count`, follower counts…) are maintained by
triggers, and every table has Row Level Security.
