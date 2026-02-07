import { ensureAdmin } from "./actions"
import { AdminSidebar } from "./admin-sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await ensureAdmin()

  return (
    <div className="container mx-auto py-6 flex flex-col md:flex-row gap-6">
      <aside className="w-full md:w-64 flex-shrink-0">
        <div className="sticky top-20">
            <h2 className="text-xl font-bold mb-4 px-4">Admin Portal</h2>
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
