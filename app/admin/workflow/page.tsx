import { WorkflowManager } from "@/components/workflow-manager"
import { checkAdminAuth } from "@/lib/admin-auth"
import { redirect } from "next/navigation"

export default async function WorkflowPage() {
  const user = await checkAdminAuth()

  if (!user) {
    redirect("/admin/login")
  }

  return <WorkflowManager user={user} />
}
