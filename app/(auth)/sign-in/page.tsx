"use client"

import { createClient } from "@/lib/supabase/client"
import { useState } from "react"

export default function SignInPage() {
  const [email, setEmail]       = useState("")
  const [otp, setOtp]           = useState("")
  const [loading, setLoading]   = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError]       = useState("")
  const supabase = createClient()

  async function sendOTP() {
    setError("")

    // Restrict to @crowe.com emails only
    if (!email.toLowerCase().endsWith("@crowebgk.com")) {
      setError("Only @crowebgk.com email addresses are allowed.")
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        shouldCreateUser: false,
      },
    })

    if (error) {
      setError("Could not send code. Please check your email address.")
    } else {
      setCodeSent(true)
    }
    setLoading(false)
  }

  async function verifyOTP() {
    setError("")
    setLoading(true)

    const { error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase(),
      token: otp,
      type: "email",
    })

    if (error) {
      setError("Invalid or expired code. Please try again.")
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

        {!codeSent ? (
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
                onKeyDown={e => e.key === "Enter" && sendOTP()}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              onClick={sendOTP}
              disabled={loading || !email}
              className="w-full bg-orange-500 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending..." : "Send Sign-In Code"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600 text-center">
              A 6-digit code was sent to:
              <br />
              <span className="font-medium text-gray-900">{email}</span>
            </p>

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Enter 6-digit code
              </label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-center tracking-widest text-lg focus:outline-none focus:border-orange-400"
                onKeyDown={e => e.key === "Enter" && verifyOTP()}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              onClick={verifyOTP}
              disabled={loading || otp.length !== 6}
              className="w-full bg-orange-500 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "Verifying..." : "Sign In"}
            </button>

            <button
              onClick={() => { setCodeSent(false); setOtp(""); setError("") }}
              className="text-xs text-gray-400 hover:text-gray-600 text-center"
            >
              Use a different email
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-8">
          Access restricted to Crowe BGK staff only
        </p>
      </div>
    </div>
  )
}