import { MarketingDashboard } from "@/components/marketing-dashboard"
import { checkAdminAuth } from "@/lib/admin-auth"
import { redirect } from "next/navigation"

export default async function MarketingPage() {
  const user = await checkAdminAuth()

  if (!user) {
    redirect("/admin/login")
  }

  return <MarketingDashboard user={user} />
}
