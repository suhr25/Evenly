import type { StorageProvider } from "@/lib/storage/provider";
import { LocalStorageProvider } from "@/lib/storage/providers/local";
import { S3StorageProvider } from "@/lib/storage/providers/s3";

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const providerName = process.env.STORAGE_PROVIDER ?? "local";

  if (providerName === "s3") {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "STORAGE_PROVIDER=s3 requires S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY"
      );
    }
    cached = new S3StorageProvider({
      bucket,
      region,
      endpoint: process.env.S3_ENDPOINT || undefined,
      accessKeyId,
      secretAccessKey,
    });
  } else {
    // The local provider writes under process.cwd(), which on serverless
    // hosting is read-only outside /tmp, and /tmp does not survive between
    // invocations. Refusing here is better than accepting an upload, telling
    // the user it worked, and losing the file.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "STORAGE_PROVIDER is 'local', which cannot persist files in production. " +
          "Set STORAGE_PROVIDER=s3 and supply S3_BUCKET, S3_REGION, " +
          "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY."
      );
    }
    cached = new LocalStorageProvider();
  }
  return cached;
}

export type { StorageProvider } from "@/lib/storage/provider";
