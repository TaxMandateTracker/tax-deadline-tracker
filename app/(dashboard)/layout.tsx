import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { UserProvider } from "@/lib/context/UserContext"
import TopNav from "./components/TopNav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/sign-in")
  }

  return (
    <UserProvider>
      <div className="min-h-screen bg-gray-50">
        <TopNav email={user.email ?? ""} />
        <main>{children}</main>
      </div>
    </UserProvider>
  )
}