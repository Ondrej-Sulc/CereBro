import { ensureAdmin } from "./actions"
import { AdminSidebar } from "./admin-sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await ensureAdmin()

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
      <aside className="w-full md:w-auto flex-shrink-0">
        <div className="sticky top-20">
            <AdminSidebar />
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="bg-card rounded-lg border shadow-sm p-6">
            {children}
        </div>
      </main>
    </div>
  )
}
