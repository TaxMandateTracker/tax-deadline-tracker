"use client"

import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SignInPage() {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const supabase = createClient()
  const router   = useRouter()

  async function signIn() {
    setError("")

    // Restrict to @crowebgk.com emails only
    if (!email.toLowerCase().endsWith("@crowebgk.com")) {
      setError("Only @crowebgk.com email addresses are allowed.")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email:    email.toLowerCase(),
      password: password,
    })

    if (error) {
      setError("Invalid email or password. Please try again.")
    } else {
      router.push("/mandates")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md">

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Tax Deadline Tracker
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Crowe BGK — Secure Access
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="yourname@crowebgk.com"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-orange-400"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-orange-400"
              onKeyDown={e => e.key === "Enter" && signIn()}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            onClick={signIn}
            disabled={loading || !email || !password}
            className="w-full bg-orange-500 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">
          Access restricted to Crowe BGK staff only
        </p>
      </div>
    </div>
  )
}