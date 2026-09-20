import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const rawConnectionString = process.env.DATABASE_URL ?? "";

/**
 * Amazon RDS presents a certificate signed by the Amazon RDS root CA, which is
 * not in Node's default trust store. Two things therefore have to happen for a
 * verified connection:
 *
 *  1. Supply the CA bundle, so verification can actually succeed.
 *  2. Strip `sslmode` from the URL. node-postgres reads `sslmode=require` from
 *     the connection string and applies its own handling, which overrides the
 *     `ssl` object passed here and fails with "self-signed certificate in
 *     certificate chain". Passing the CA through `ssl` is the path that works.
 *
 * The tempting shortcut is `rejectUnauthorized: false`. That encrypts the
 * connection but verifies nothing, so it offers no protection against a
 * man-in-the-middle sitting between the app and the database. For financial
 * data that is not an acceptable default.
 */
/**
 * Certificate file names tried in order, relative to the project root.
 *
 * The region bundle is committed because the deployed server has to verify
 * RDS's certificate and has nowhere else to get one: these are public
 * certificates rather than secrets, and the global bundle is far too large to
 * pass through an environment variable (Lambda allows 4KB for all of them
 * together). The global bundle is still honoured when present, for anyone
 * running against a different region.
 */
const CA_BUNDLE_FILES = ["rds-ca-us-east-1.pem", "rds-ca-bundle.pem"];

function loadCaCert(): string | undefined {
  const inline = process.env.DATABASE_CA_CERT;
  if (inline && inline.includes("BEGIN CERTIFICATE")) return inline;

  for (const file of CA_BUNDLE_FILES) {
    const bundlePath = path.join(process.cwd(), "prisma", file);
    if (fs.existsSync(bundlePath)) return fs.readFileSync(bundlePath, "utf8");
  }

  return undefined;
}

const wantsSsl = /sslmode=(require|verify-ca|verify-full)/.test(rawConnectionString);
// sslmode is handled here via the ssl option instead, for the reason above.
const connectionString = rawConnectionString.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");

/**
 * Whether the database is Amazon RDS, which decides where trust comes from.
 *
 * RDS presents a certificate signed by an Amazon root that is not in Node's
 * default trust store, so it needs the bundle below. Every other managed
 * Postgres worth using chains to a public root instead, and handing those the
 * Amazon bundle would reject a perfectly valid certificate. Getting this wrong
 * is not a soft failure: it looks exactly like the database being unreachable.
 */
function isAmazonRdsHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".rds.amazonaws.com");
  } catch {
    return false;
  }
}

function sslConfig() {
  if (!wantsSsl) return undefined;

  // Public CA: verified against Node's own trust store, nothing to supply.
  if (!isAmazonRdsHost(rawConnectionString)) {
    return { rejectUnauthorized: true as const };
  }

  const ca = loadCaCert();
  if (ca) return { ca, rejectUnauthorized: true as const };

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL requests SSL but no CA certificate is available. Set " +
        "DATABASE_CA_CERT or commit prisma/rds-ca-us-east-1.pem. Refusing to " +
        "connect to a production database without verifying its certificate."
    );
  }

  console.warn("[prisma] SSL requested but no CA bundle found; connection will be unverified.");
  return { rejectUnauthorized: false as const };
}

const adapter = new PrismaPg({
  connectionString,
  ssl: sslConfig(),
  /*
   * Without these, an unreachable database does not fail: it hangs. The
   * request sits on the socket until something upstream gives up, which turns
   * a network problem into a page that never responds and, on the auth
   * routes, into an error that reads as a misconfiguration. Better to fail in
   * a few seconds with a real error than to stall.
   */
  connectionTimeoutMillis: 8_000,
  query_timeout: 20_000,
  statement_timeout: 20_000,
  idleTimeoutMillis: 30_000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
