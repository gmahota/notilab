import { AdminNewsManager } from "@/components/admin-news-manager"
import { checkAdminAuth } from "@/lib/admin-auth"
import { redirect } from "next/navigation"

export default async function AdminNewsPage() {
  const user = await checkAdminAuth()

  if (!user) {
    redirect("/admin/login")
  }

  return <AdminNewsManager user={user} />
}
