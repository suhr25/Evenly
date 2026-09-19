import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { listCardProducts } from "@/lib/data/cards";
import { listCardProductsQuerySchema } from "@/lib/validations/card";

// Catalog search for the Add Card flow. Intentionally returns the full catalog
// (not scoped to ownership), Portfolio vs Discovery filtering happens in the
// /api/cards routes, never here, so this one function can't accidentally leak
// the wrong mode.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const { search } = listCardProductsQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  const products = await listCardProducts(search);
  return apiSuccess(products);
});
