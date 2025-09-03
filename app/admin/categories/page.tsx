import { AdminCategoryManager } from "@/components/admin-category-manager"
import { checkAdminAuth } from "@/lib/admin-auth"
import { redirect } from "next/navigation"

export default async function AdminCategoriesPage() {
  const user = await checkAdminAuth()

  if (!user) {
    redirect("/admin/login")
  }

  return <AdminCategoryManager user={user} />
}
