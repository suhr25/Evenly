import { WifiOff } from "lucide-react";

export const metadata = { title: "You're offline | Evenly" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Evenly needs an internet connection to load your latest data. Reconnect and try again.
      </p>
    </div>
  );
}
