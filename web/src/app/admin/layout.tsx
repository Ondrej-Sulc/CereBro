import { ensureAdmin } from "./actions"
import { AdminSidebar } from "./admin-sidebar"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await ensureAdmin()
  const user = session.user as any;
  const isBotAdmin = user.isBotAdmin || false;
  const permissions = user.permissions || [];

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-auto flex-shrink-0">
        <div className="sticky top-20">
            <AdminSidebar isBotAdmin={isBotAdmin} permissions={permissions} />
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {/* Mobile Header with Sheet */}
        <div className="md:hidden flex items-center justify-between mb-4 bg-card rounded-lg border shadow-sm p-4">
            <h2 className="text-lg font-semibold tracking-tight">Admin Menu</h2>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 pt-10">
                <AdminSidebar isBotAdmin={isBotAdmin} permissions={permissions} isMobile />
              </SheetContent>
            </Sheet>
        </div>

        <div className="bg-card rounded-lg border shadow-sm p-4 md:p-6 overflow-x-auto">
            {children}
        </div>
      </main>
    </div>
  )
}
