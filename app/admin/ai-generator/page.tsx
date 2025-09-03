import { AINewsGenerator } from "@/components/ai-news-generator"
import { checkAdminAuth } from "@/lib/admin-auth"
import { redirect } from "next/navigation"

export default async function AIGeneratorPage() {
  const user = await checkAdminAuth()

  if (!user) {
    redirect("/admin/login")
  }

  return <AINewsGenerator user={user} />
}
