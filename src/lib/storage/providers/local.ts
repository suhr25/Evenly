import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import type { StorageProvider, UploadParams, UploadResult } from "@/lib/storage/provider";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

/** Dev-only local filesystem storage. Files live outside /public and are only
 * ever served through an authenticated route handler that checks resource
 * ownership before streaming bytes back. */
export class LocalStorageProvider implements StorageProvider {
  async upload({ buffer, key }: UploadParams): Promise<UploadResult> {
    const filePath = path.join(STORAGE_ROOT, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return { key, url: `/api/uploads/${key}` };
  }

  async getSignedUrl(key: string): Promise<string> {
    return `/api/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(STORAGE_ROOT, key);
    await rm(filePath, { force: true });
  }

  async read(key: string): Promise<Buffer> {
    return readFile(path.join(STORAGE_ROOT, key));
  }
}
