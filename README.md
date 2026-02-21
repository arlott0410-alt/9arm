# 9arm Ledger

Production-ready internal web app for recording deposit/withdraw + income/expense ledger for multiple gambling websites. Includes wallets, transfers, dashboards, reports, and CSV export.

## PWA & Icon

Copy your app icon to `public/icon.png` (recommended: 512×512 px or larger). The app uses it as favicon, PWA icon, and Apple touch icon. `public/manifest.webmanifest` is configured for PWA install.

## Deployment (GitHub → Cloudflare Pages)

The app is designed to deploy exclusively via **GitHub → Cloudflare Pages** integration. No local Node.js, Wrangler, or database setup is required on your machine.

### 1. Push to GitHub

Push this repository to a GitHub repository.

### 2. Create Cloudflare Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select your GitHub repository.
3. Configure:
   - **Project name**: 9arm-ledger (or your choice)
   - **Production branch**: main (or your default branch)
   - **Framework preset**: Next.js
   - **Build command**: `npx @cloudflare/next-on-pages`
   - **Build output directory**: `.vercel/output/static`

   > **Note**: `@cloudflare/next-on-pages` produces output in `.vercel/output/static`. Use this exact path as the build output directory.

4. Under **Build configuration** (optional): If `npm install` fails with peer dependency errors, set **Install command** to `npm install --legacy-peer-deps`.

5. Under **Environment variables (advanced)**, add:
   - `NODE_VERSION`: `18` (or higher)
   - `APP_SECRET`: a long random string for signing sessions (e.g. generate with `openssl rand -hex 32`)
   - `SESSION_TTL_HOURS`: `24` (optional; default 24)

6. Go to **Settings** → **Functions** → **Compatibility Flags**:
   - Add `nodejs_compat` for both Production and Preview
   - Set **Compatibility date** to at least `2022-11-30`

### 3. Create D1 Database

1. In Cloudflare Dashboard: **Workers & Pages** → **D1** → **Create database**.
2. Name it (e.g. `9arm-ledger-db`).
3. Create the database and note the **Database ID**.

### 4. Bind D1 to Pages Project

1. Go to your Pages project → **Settings** → **Functions**.
2. Under **D1 database bindings**, click **Add binding**.
3. **Variable name**: `DB` (must be exactly `DB`).
4. **D1 database**: Select the database you created.
5. Save.

### 5. Execute Schema

1. Go to **Workers & Pages** → **D1** → Select your database.
2. Open **Console** (Execute SQL).
3. Copy the contents of `db/schema.sql` and paste into the console.
4. Click **Execute**.

### 6. Deploy

After saving all settings, trigger a deploy (or push a commit). The build command runs `next build` (via `npm run build`) then produces Pages output. Use `npx @cloudflare/next-on-pages` as the build command — not `npm run build` — to avoid recursive build errors.

### 7. Create Superadmin (First Time Only)

1. Open your deployed site URL.
2. You will see **Create Superadmin** (no login exists yet).
3. Enter username and password (min 8 chars), then click **Create Superadmin**.
4. After creation, the setup UI is permanently disabled. You will be logged in and redirected to the dashboard.

## Troubleshooting

### API returns 500 / 503 — "เข้าสู่ระบบ" instead of "สร้าง Superadmin"

If `/api/auth/needs-setup` or `/api/auth/me` returns 500/503:

1. **Check D1 binding**: Cloudflare Dashboard → Pages project → **Settings** → **Functions** → **D1 database bindings**
   - Variable name must be exactly `DB`
   - Must be bound to your D1 database

2. **Check environment variables**: **Settings** → **Environment variables**
   - `APP_SECRET` must be set (e.g. `openssl rand -hex 32`)
   - Apply to Production and Preview

3. **Check schema**: D1 → your database → **Console** → run `db/schema.sql` if tables don't exist

4. **Check Network tab**: Open DevTools (F12) → Network → reload. If `/api/auth/needs-setup` returns 503 with `DB_NOT_CONFIGURED` or `APP_SECRET_MISSING`, fix the corresponding setting and redeploy.

### Node.JS Compatibility Error

Add `nodejs_compat` under **Settings** → **Functions** → **Compatibility Flags** for both Production and Preview.

## Features

- **Auth**: Login with username/password, HttpOnly session cookies, RBAC (SUPER_ADMIN, ADMIN, AUDIT).
- **Transactions**: Deposit/Withdraw forms, listing with filters, edit with reason + audit trail.
- **Wallets**: Create wallets with opening balance; balances computed from transactions + transfers.
- **Transfers**: Internal, External Out, External In.
- **Dashboard**: Today/month deposits, withdraws, net; wallet balances.
- **Reports**: Daily/Monthly/Yearly summaries for transactions and transfers.
- **CSV Export**: Transactions and transfers with filters.
- **Settings** (SUPER_ADMIN only): Websites, users, display currency, exchange rates.

## Tech Stack

- Next.js 14 App Router + TypeScript
- Cloudflare Pages + Pages Functions (Workers runtime)
- D1 (SQLite) + Drizzle ORM
- Zod validation, WebCrypto PBKDF2 for passwords
- TailwindCSS + shadcn/ui + lucide-react
