export function authDestination(raw: string | null, origin: string): string {
  if (raw) {
    try {
      const url = new URL(raw, origin);
      if (url.origin === origin && !url.pathname.startsWith("//") && !["/login", "/signup"].includes(url.pathname)) {
        return url.pathname + url.search + url.hash;
      }
    } catch { /* Invalid destinations fall back to the workspace. */ }
  }
  return "/dashboard";
}
