import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { LocalStorageProvider } from "@/lib/storage/providers/local";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Serves locally-stored receipt images. Only reachable when
 * STORAGE_PROVIDER is unset/"local"; S3-backed uploads are served directly
 * via signed URLs and never hit this route. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const session = await auth();
  if (!session?.user) return apiError(401, "You must be logged in.");

  const { key: keyParts } = await ctx.params;
  const key = keyParts.join("/");

  const receipt = await prisma.receipt.findFirst({ where: { imageKey: key, userId: session.user.id } });
  if (!receipt) return apiError(404, "Not found.");

  try {
    const buffer = await new LocalStorageProvider().read(key);
    const ext = key.split(".").pop() ?? "";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return apiError(404, "Not found.");
  }
}
