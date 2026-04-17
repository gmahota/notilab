import { redirect } from "next/navigation"
import { checkAdminAuth } from "@/lib/admin-auth"
import { getOverviewStats } from "@/lib/admin/overview"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AdminOverview } from "@/components/admin-overview"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const user = await checkAdminAuth()

  if (!user) {
    redirect("/admin/login")
  }

  const stats = await getOverviewStats()

  return (
    <div className="flex h-screen bg-gray-950">
      <AdminSidebar userRole={user.role} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader user={user} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <AdminOverview stats={stats} userName={user.name} />
          </div>
        </main>
      </div>
    </div>
  )
}
