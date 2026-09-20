# Deploying Evenly to AWS Amplify Hosting

Written for whoever is doing the deploy, including future you. It assumes the
Amplify app is already connected to the GitHub repository.

The application is server-rendered. It uses route handlers, server components
and Auth.js, none of which survive a static export, so Amplify must build it as
a Next.js SSR app. `amplify.yml` in the repository root does that; there is no
static export setting anywhere and there should not be one.

## Environment variables

Set these in Amplify under **App settings → Environment variables**. Names
only here; the values are yours.

Required:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | The RDS connection string, ending `?schema=public&sslmode=require`. Must not point at localhost; the app refuses to start if it does. |
| `AUTH_SECRET` | Generate a fresh one with `npx auth secret`. Do not reuse the development secret: a leaked dev secret forges production sessions. |
| `AUTH_URL` | This deployment's public origin, no trailing slash, e.g. `https://main.d1234abcd.amplifyapp.com`. Not known until the first deploy, so deploy once, set it, redeploy. |
| `AUTH_GOOGLE_ID` | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret. |
| `STORAGE_PROVIDER` | Must be `s3`. `local` is refused in production. |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Required whenever `STORAGE_PROVIDER=s3`. |

Optional:

| Variable | Notes |
| --- | --- |
| `AI_PROVIDER` | Defaults to `groq`. |
| `GROQ_API_KEY` | Without it the AI features report themselves unavailable and everything else keeps working. |
| `GROQ_MODEL`, `GROQ_VISION_MODEL` | Sensible defaults are compiled in. |
| `S3_ENDPOINT` | Only for S3-compatible services that are not AWS S3. |
| `DATABASE_CA_CERT` | Not needed. The region CA is committed at `prisma/rds-ca-us-east-1.pem`. See below. |

`AUTH_URL` does more than it looks like it does. Auth.js builds its callback
URLs from it, the Gmail integration builds its redirect URI from it, and
Auth.js reads its presence as permission to trust the incoming `Host` header.
Without it, sign-in fails as an untrusted host and OAuth redirects are built
against localhost.

## Google Cloud Console

Add the production callbacks to the existing OAuth client. Google matches
redirect URIs exactly, so the scheme, host and path all have to be right.

Authorised redirect URIs:

```
https://YOUR-DOMAIN/api/auth/callback/google
https://YOUR-DOMAIN/api/integrations/gmail/callback
```

The second one is the Gmail import consent flow, which is a separate grant with
its own read-only scope. Keep the existing localhost entries so development
keeps working.

## TLS to RDS

The server verifies the database's certificate against Amazon's RDS root CA,
which is not in Node's default trust store. That CA is committed at
`prisma/rds-ca-us-east-1.pem` (a public certificate, not a secret) with a
`.gitignore` exception, because the deployed server has nowhere else to get it:
the global bundle is 165KB and Lambda allows 4KB for all environment variables
combined.

If you move the database to another region, download that region's bundle to
`prisma/rds-ca-<region>.pem` and add it to `CA_BUNDLE_FILES` in
`src/lib/prisma.ts`.

The app deliberately refuses to start in production if `sslmode=require` is set
and no CA is available, rather than falling back to an unverified connection.
An unverified TLS connection is encrypted but authenticates nothing, which is
no defence against anything sitting between the app and the database.

## Dependency install on the build image

`amplify.yml` runs `npm install`, not `npm ci`, and that is a deliberate
concession rather than a preference.

The lockfile is generated on Windows. npm records only the optional platform
packages that apply to the machine that wrote it, and it will not record the
dependencies of an optional package it cannot install locally. Three packages
here pull in wasm fallbacks (`@img/sharp-wasm32`, `@napi-rs/wasm-runtime`,
`@tailwindcss/oxide-wasm32-wasi`) that depend on `@emnapi/core` and
`@emnapi/runtime`. Neither has an entry in the lockfile, while
`@napi-rs/wasm-runtime`, which requires them, does. On Linux `npm ci` follows
that dangling edge and fails.

It cannot be repaired from a Windows checkout: `npm install --package-lock-only`
leaves both out, and so does the same command with `--os=linux --cpu=x64
--libc=glibc`.

The cost is that builds are no longer reproducible from the lockfile alone.
npm resolves against the registry at build time, so a dependency can arrive at
a newer version than the one that was tested, constrained only by the ranges in
package.json.

To get `npm ci` back, generate the lockfile on Linux and commit it:

```bash
docker run --rm -v "$PWD":/app -w /app node:22 npm install --package-lock-only
```

Then change the `preBuild` command back to `npm ci`. Worth doing before this
carries anything that matters; a build that silently picks up a new minor
version of a dependency is a bad thing to debug later.

Related: Amplify's default Node image may ship an npm older than the one used
locally (11.x). Pinning the build image to Node 22 or newer, via the
`_CUSTOM_IMAGE` environment variable or Amplify's Node version setting, keeps
install behaviour consistent with development.

## Migrations

**The build does not run migrations, on purpose.** Amplify builds can run
concurrently and are retried automatically, so a migration in the build phase
can execute several times at once against one database. `prisma migrate deploy`
is not safe under that. `prisma migrate dev` must never run against production
at all: it can reset the database.

Apply migrations deliberately, from somewhere with network access to RDS, after
the build has succeeded and before or alongside promoting the new version:

```bash
DATABASE_URL="<production url>" npx prisma migrate deploy
```

`migrate deploy` only applies pending migrations and never resets. Check what
would run first:

```bash
DATABASE_URL="<production url>" npx prisma migrate status
```

Do not run `npm run db:seed` against production. It creates demo accounts,
including one with a known password.

## Networking: Amplify to RDS

This is the part that cannot be fixed in the repository.

Amplify's SSR compute runs in an AWS-managed VPC and its outbound addresses are
not fixed, so there is no IP to allow in the RDS security group. A rule pinned
to one address works until the address changes, which it will.

Options, best first:

1. **RDS Proxy** in front of the instance. It also solves connection
   exhaustion, below. Costs money.
2. **A NAT gateway with an Elastic IP**, if you move the compute into your own
   VPC, giving one stable address to allow.
3. **Widening the security group.** Do not open 5432 to `0.0.0.0/0`. A publicly
   reachable Postgres port is found by scanners within hours, and the only
   thing between an attacker and the data is the password.

Related, and easy to miss until it bites: every Lambda instance holds its own
Prisma connection pool. A `db.t3.micro` allows about 87 connections, and
concurrent instances will exhaust that under modest traffic. RDS Proxy is the
usual answer; otherwise keep the pool small and watch `pg_stat_activity`.

## First deploy

1. Set every required variable except `AUTH_URL`.
2. Deploy. The build should succeed; sign-in will not work yet.
3. Copy the domain Amplify assigns, set `AUTH_URL`, redeploy.
4. Add both redirect URIs in Google Cloud Console.
5. Apply migrations as above.
6. Sign in and confirm the dashboard loads.

If the app fails to start, read the error before changing anything: the startup
check in `src/instrumentation.ts` names every misconfigured variable at once.
