import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

/**
 * Amazon RDS terminates TLS with a certificate signed by the Amazon RDS root
 * CA, which is not in Node's default trust store. Without the CA supplied,
 * `sslmode=require` either fails verification or silently degrades to an
 * unverified connection.
 *
 * Set DATABASE_CA_CERT to the contents of the RDS global bundle to get a
 * properly verified connection. Local Docker Postgres speaks plaintext, so
 * SSL stays off unless the URL asks for it.
 */
function sslConfig() {
  const ca = process.env.DATABASE_CA_CERT;
  if (ca) {
    return { ca, rejectUnauthorized: true as const };
  }

  const wantsSsl = connectionString?.includes("sslmode=require");
  if (!wantsSsl) return undefined;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL requests SSL but DATABASE_CA_CERT is not set. Refusing to " +
        "connect to a production database without verifying its certificate."
    );
  }

  // Non-production only: encrypted but unverified, so a developer can point at
  // RDS before the CA bundle is wired up.
  console.warn("[prisma] Connecting over SSL without CA verification (non-production).");
  return { rejectUnauthorized: false as const };
}

const adapter = new PrismaPg({ connectionString, ssl: sslConfig() });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
