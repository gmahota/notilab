import { redirect } from "next/navigation"
import { AdminDashboard } from "@/components/admin-dashboard"
import { checkAdminAuth } from "@/lib/admin-auth"

export default async function AdminPage() {
  const user = await checkAdminAuth()

  if (!user) {
    redirect("/admin/login")
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <AdminDashboard user={user} />
    </div>
  )
}
