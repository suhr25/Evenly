import { NextRequest } from "next/server";
import { getAIProvider } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { serializeReceipt } from "@/lib/data/receipts";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getStorageProvider } from "@/lib/storage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  if (!rateLimit(`receipt-scan:${session.user.id}`, 10, 60_000)) {
    throw new ApiError(429, "Too many receipt scans. Please slow down.");
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "No image file provided.");
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ApiError(400, "Please upload a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new ApiError(400, "Image is too large (max 8MB).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `receipts/${session.user.id}/${Date.now()}-${crypto.randomUUID()}.${file.type.split("/")[1]}`;

  const storage = getStorageProvider();
  const { url } = await storage.upload({ buffer, key, contentType: file.type });

  let extraction: Awaited<ReturnType<ReturnType<typeof getAIProvider>["analyzeReceipt"]>> | null = null;
  let extractionFailed = false;
  try {
    extraction = await getAIProvider().analyzeReceipt(buffer.toString("base64"), file.type);
  } catch {
    // Poor image quality, unsupported content, or no AI provider configured:
    // still save the upload and let the user fill everything in by hand.
    extractionFailed = true;
  }

  const receipt = await prisma.receipt.create({
    data: {
      userId: session.user.id,
      imageKey: key,
      merchant: extraction?.merchant ?? null,
      date: extraction?.date ? new Date(extraction.date) : null,
      subtotal: extraction?.subtotal ?? null,
      tax: extraction?.tax ?? null,
      discount: extraction?.discount ?? null,
      tip: extraction?.tip ?? null,
      total: extraction?.total ?? null,
      confidence: extraction?.confidence ?? null,
      items: extraction?.items.length
        ? {
            create: extraction.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });

  return apiSuccess(serializeReceipt(receipt, url, extractionFailed), 201);
});
