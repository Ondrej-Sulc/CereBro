import { Menu } from "lucide-react"
import { ensureAdmin } from "./actions"
import { AdminSidebar } from "./admin-sidebar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await ensureAdmin()
  const isBotAdmin = user.isBotAdmin || false
  const permissions: string[] = user.permissions || []

  return (
    <div className="w-full max-w-[1600px] mx-auto px-3 py-3 md:px-4 md:py-6">
      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        <aside className="hidden shrink-0 md:block">
          <div className="sticky top-20">
            <AdminSidebar isBotAdmin={isBotAdmin} permissions={permissions} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 -mx-3 mb-3 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
                <h2 className="truncate text-base font-semibold tracking-tight">Control Panel</h2>
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open admin navigation">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[304px] p-0">
                  <SheetHeader className="border-b px-4 py-4 text-left">
                    <SheetTitle>Admin</SheetTitle>
                  </SheetHeader>
                  <div className="py-3">
                    <AdminSidebar isBotAdmin={isBotAdmin} permissions={permissions} isMobile />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
