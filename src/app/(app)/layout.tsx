import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      {/* Hidden below md: small screens use BottomNav instead of a drawer,
          which suits a finance app people check one-handed. */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <SidebarInset className="min-w-0">
        <Topbar user={session.user} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-10">
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
      <BottomNav />
    </SidebarProvider>
  );
}
