import { requireSession } from "@/lib/session";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <SidebarProvider className="app-workspace" style={{ "--sidebar-width": "15rem" } as React.CSSProperties}>
      {/* Hidden below md: small screens use BottomNav instead of a drawer,
          which suits a finance app people check one-handed. */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <SidebarInset className="min-w-0">
        <Topbar user={session.user} />
        <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-8 lg:px-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
      <BottomNav />
    </SidebarProvider>
  );
}
