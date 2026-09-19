# Evenly

An AI-powered money operating system: personal expense tracking, Splitwise-style
group expenses, budgets, savings goals, an AI receipt scanner, an AI financial
assistant, and subscription detection, built as a single Next.js app.

**Status:** Phase 0-9 and Phase 12-14 complete (architecture through savings
goals, plus AI bill scanning, the AI assistant, subscription/ghost-expense
detection, and a data-driven insights engine). See [Roadmap](#roadmap) for
what's built vs. planned.

## Features (this phase)

- Email/password and Google authentication, with every API route re-deriving
  the current user from the server session (never trusted from the client).
- A real financial dashboard: balance, monthly income/expenses/savings, budget
  utilization, category breakdown, a 6-month spending trend chart, recent
  transactions, group balances, an AI insight card, and a data-driven
  insights list that always works even without an AI provider configured.
- Full expense CRUD: search, filter (category/payment method/date range),
  sort, pagination, and voice entry (browser speech-to-text → AI parses it
  into amount/category/description → user reviews before saving).
- Splitwise-style groups: create/rename/delete groups, add members (linked to
  an account by email, or ledger-only), four split methods (equal, exact,
  percentage, shares) with server-recomputed canonical amounts, per-member net
  balances, manual settlement recording, and removal blocked while a member
  has a non-zero balance.
- Smart settlement: `simplifyDebts` (`src/lib/settlement.ts`) turns raw group
  balances into the minimum number of suggested payments (deterministic
  greedy max-creditor/max-debtor match), shown alongside current balances with
  a one-click "Mark as paid" action, in addition to manual settlement entry.
- AI bill scanner: upload a receipt photo, AI vision extracts merchant/date/
  items/tax/discount/tip/total, the user reviews and edits everything, assigns
  items to group members with a live split preview, then confirms into a real
  group expense (exact split) linked back to the receipt. Falls back to manual
  entry gracefully on a bad photo or no AI provider, never silently.
- AI financial assistant (`/ai-chat`): tool-calling chat grounded in real data
  via 8 read-only tools (spending by category/month, income, budgets, goals,
  group balances, recurring expenses); the model must call a tool to get a
  number, it's never handed the number directly and never invents one.
- Budgets: per-category monthly limits with progress bars, status (on track /
  near limit / exceeded), and month navigation.
- Savings goals: target amount, current progress, optional target date or
  planned monthly contribution, calculated required-monthly-saving or
  expected-completion-date projections, and a contribution history.
- Subscription and ghost-expense detection: groups expenses by description,
  flags ones with a consistent amount and a weekly/monthly/yearly cadence,
  and lets the user confirm, rename, or ignore each one; long-unconfirmed
  ones get a "worth reviewing" ghost-expense badge.
- Profile/settings page (name, currency).
- Dark / light / system theme.
- Mobile-first responsive layout (sidebar on desktop, bottom nav on mobile).
- Seed data for a realistic demo account: two months of expenses/income,
  budgets, three demo groups (Goa Trip, Flatmates, College Friends) exercising
  all four split types, three savings goals, and recurring subscriptions.

## Architecture

- **Framework:** Next.js (App Router) + TypeScript + React, Tailwind CSS +
  shadcn/ui (Base UI primitives) + Recharts.
- **Database:** PostgreSQL + Prisma ORM. All money columns are `Decimal(12,2)`;
  application-layer arithmetic goes through `decimal.js` via `src/lib/money.ts`.
  Never native floating point.
- **Auth:** Auth.js (NextAuth v5), JWT sessions (required when a Credentials
  provider is present), `@auth/prisma-adapter` for OAuth account linking.
  Route protection is split into an edge-safe `src/lib/auth.config.ts`
  (used by `src/proxy.ts`, Next's middleware/proxy convention) and the full
  Node-runtime config in `src/lib/auth.ts` (Prisma, bcrypt, providers).
- **AI:** `src/lib/ai/provider.ts` defines an `AIProvider` interface
  (`generateResponse`, `generateToolResponse`, `categorizeExpense`,
  `parseExpenseText`, `analyzeReceipt`, `generateInsight`, `analyzePurchase`).
  `GroqProvider` is the concrete implementation; a `NullAIProvider` is
  used automatically when no API key is configured, so AI-dependent UI shows
  "AI features are currently unavailable" instead of breaking the rest of the
  app. Swap providers via `AI_PROVIDER`/`GROQ_API_KEY`.
  `generateToolResponse` runs a full tool-use loop (call model → execute any
  requested tool via a caller-supplied executor → feed the result back →
  repeat) so the AI assistant (`src/lib/ai/financial-tools.ts`) can only ever
  answer with numbers a Prisma query actually returned.
- **Storage:** `src/lib/storage/provider.ts` defines a `StorageProvider`
  interface with a `LocalStorageProvider` (dev, files outside `/public`,
  served only through an authenticated route at `/api/uploads/[...key]` that
  checks the requesting user owns the underlying `Receipt`) and an
  `S3StorageProvider` (works with any S3-compatible service, incl. Supabase
  Storage, returns real presigned URLs so it never touches that route)
  selected via `STORAGE_PROVIDER`.
- **Validation:** Zod schemas in `src/lib/validations/`, parsed server-side on
  every write. Client-side validation is a UX nicety, never the source of truth.
- **Errors:** `src/lib/api-response.ts` provides a consistent `{ success, data | error }`
  envelope; unexpected errors are logged server-side and returned to the client
  as a generic message (no stack traces, no DB errors, no leaked internals).

## Folder structure

```
prisma/                  schema, migrations, seed script
src/
  app/
    (auth)/               login, signup: public, centered layout
    (app)/                 dashboard, expenses, groups, settings: protected, sidebar/bottom-nav layout
    api/                   route handlers (auth, user, expenses, groups, ai, ...)
  components/
    ui/                    shadcn primitives
    layout/                sidebar, bottom nav, topbar, theme toggle
    dashboard/              stat cards, charts, budget list, group balances, AI + data-driven insight cards
    expenses/               list, filters, form dialog, voice entry
    groups/                 list, detail, member management, split editor, balances, settlements, receipt scan
    budgets/, goals/         set-budget dialog; goal form, add-funds dialog, goal card
    subscriptions/           detected/confirmed/ignored subscription cards
    ai-chat/                 tool-calling chat UI
    shared/                  reusable pieces (emoji icon picker, ...)
    auth/, settings/
  lib/
    auth.ts / auth.config.ts
    prisma.ts, money.ts, settlement.ts, api-response.ts, rate-limit.ts, category-icons.ts
    ai/                     provider interface, Groq + null implementations, financial-tools.ts (assistant tools)
    storage/                provider interface, local + S3 implementations
    data/                   server-only data-fetching (dashboard, insights, financial-insights, expenses,
                             groups, budgets, goals, receipts, subscriptions)
    validations/            Zod schemas
  hooks/                   TanStack Query hooks (one per domain: expenses, groups, budgets, goals,
                             receipts, subscriptions, ai-chat, ...)
  types/                   ai.ts, next-auth.d.ts
```

## Database

PostgreSQL via Docker Compose for local dev. Models: `User`,
`Account`/`Session`/`VerificationToken` (Auth.js), `ExpenseCategory`, `Expense`,
`Income`, `Budget`, `Group`, `GroupMember`, `GroupExpense`,
`GroupExpenseShare`, `Settlement`, `SavingsGoal`, `GoalContribution`,
`AIConversation`, `AIMessage`, `Receipt`, `ReceiptItem`, `Subscription`.
Every user-owned query is scoped by `userId` (personal data) or verified
group membership (group data) from the server session; see any route in
`src/app/api/`. `requireGroupMembership` in `src/lib/data/groups.ts` is the
single choke point group routes go through; a non-member gets a 404 (not a
403) so group existence itself isn't leaked. `Achievement`/`UserAchievement`/
`SavingStreak` (gamification) aren't modeled yet (see [Roadmap](#roadmap)).

### Group balances

`computeGroupBalances` (per group) and `getUserGroupBalanceSummary` (cross-group,
for the dashboard) both derive net balance as `(amount paid + settlements sent)
− (share owed + settlements received)`, computed fresh from the ledger on
every read rather than stored, so it can never drift out of sync with the
underlying expenses. The dashboard summary is intentionally *not* netted
across groups: owing ₹500 in one group and being owed ₹300 in another shows
as both figures, never collapsed into ₹200. `simplifyDebts` in
`src/lib/settlement.ts` turns those raw balances into the minimum number of
suggested payments (a deterministic greedy max-creditor/max-debtor match,
tested in `tests/unit/settlement.test.ts`); users can also record a manual
payment between any two members directly.

## Getting started

```bash
cp .env.example .env        # fill in AUTH_SECRET at minimum (see below)
docker compose up -d        # starts Postgres on localhost:5432
npm install
npm run db:migrate          # applies the schema
npm run db:seed             # demo user: demo@evenly.app / password123
npm run dev
```

Generate a secret for `AUTH_SECRET`:

```bash
npx auth secret
```

### Environment variables

See `.env.example` for the full list. Only `DATABASE_URL` and `AUTH_SECRET`
are required to run the app. Everything else degrades gracefully when unset:

- **Google OAuth** (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`): omit to hide the
  "Continue with Google" button; email/password still works.
- **AI** (`GROQ_API_KEY`): omit and AI-dependent UI shows an
  "unavailable" state instead of erroring.
- **Storage** (`STORAGE_PROVIDER=s3` + `S3_*`): defaults to local filesystem
  storage for dev.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Run the unit test suite (Vitest) once |
| `npm run test:watch` | Run the unit test suite in watch mode |
| `npm run db:migrate` | Apply Prisma migrations (dev) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |

## Security

- Passwords are hashed with bcrypt (cost 12) and never returned from any API.
- Every API route derives the current user from the server-verified session;
  request bodies are never trusted for identity.
- Zod validates every write at the API boundary.
- A minimal in-memory rate limiter guards the signup, voice-parse,
  receipt-scan, and AI-chat endpoints (`src/lib/rate-limit.ts`); swap for a
  Redis-backed limiter (e.g. Upstash) before running more than one server
  instance.
- Uploaded receipt images are served only through `/api/uploads/[...key]`,
  which checks the requesting user owns the `Receipt` that key belongs to
  before streaming any bytes back.
- Errors are normalized before reaching the client; only server logs see
  stack traces or database error detail.

## Roadmap

Built: Phase 0 (architecture/scaffold), Phase 1 (auth), Phase 2 (dashboard),
Phase 3 (expense CRUD + voice entry), Phase 4 (Splitwise-style groups),
Phase 5 (smart settlement, `src/lib/settlement.ts`, tested in
`tests/unit/settlement.test.ts`), Phase 6 (AI bill scanner), Phase 7 (AI
financial assistant with tool-calling), Phase 8 (budgeting), Phase 9 (savings
goals), Phase 12-13 (subscription + ghost-expense detection), Phase 14
(data-driven insights engine, `src/lib/data/financial-insights.ts`).

Not yet built (planned, same discipline: typecheck/lint/build/verify each
phase before moving on): what-if simulator, before-you-buy analysis (the
`AIProvider.analyzePurchase` method already exists, no route/UI yet),
financial personality, gamification, expense roast, financial wrapped, money
time machine, couple mode.

## Future improvements

- Redis-backed rate limiting and caching for expensive dashboard aggregations.
- Background jobs for recurring expense/subscription detection instead of
  computing on read.
- E2E test suite (Playwright) covering the auth + dashboard flows exercised
  manually during this phase.
