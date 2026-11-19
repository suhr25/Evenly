import { WalletCover } from "@/components/auth/wallet-cover";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wallet-entry">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:p-3">Skip to form</a>
      <WalletCover />
      <main id="main-content" className="wallet-form">
        <Link href="/" className="wallet-back"><ArrowLeft size={15} aria-hidden />Back to home</Link>
        <div className="wallet-fields">{children}</div>
      </main>
    </div>
  );
}
