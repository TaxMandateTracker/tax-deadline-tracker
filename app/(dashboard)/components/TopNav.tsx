"use client"

import Link from "next/link"
import { useUser } from "@/lib/context/UserContext"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  email: string
}

export default function TopNav({ email }: Props) {
  const { currentUser, loading, isPartner, isITAdmin, isManager, isSenior, canSeeAdminPortal } = useUser()
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const router = useRouter()

    const allNavLinks = [
    { href: "/mandates",     label: "Mandate Tracker", roles: ["Partner", "IT Admin", "Manager", "Senior", "Associate", "Junior"] },
    { href: "/tax-calendar", label: "Tax Calendar",    roles: ["Partner", "IT Admin", "Manager", "Senior"] },
  ]

  const userRole = currentUser?.role ?? "Associate"

  const visibleLinks = allNavLinks.filter((link) =>
    link.roles.includes(userRole) || currentUser?.isOwner
  )

    const ADD_MENU_ITEMS = [
    {
      label: "Import data",
      description: "Import staff, clients or mandates from Excel",
      icon: "📥",
      href: "/imports",
      roles: ["Partner", "IT Admin", "Manager"],
    },
    {
      label: "Export data",
      description: "Export data to CSV or Excel",
      icon: "📤",
      href: "/exports",
      roles: ["Partner", "IT Admin", "Manager"],
    },
  ]

  const visibleAddItems = ADD_MENU_ITEMS.filter(item =>
    item.roles.includes(userRole) || currentUser?.isOwner
  )

  const ROLE_COLORS: Record<string, string> = {
    Partner: "bg-purple-100 text-purple-700",
    "IT Admin": "bg-red-100 text-red-700",
    Manager: "bg-blue-100 text-blue-700",
    Senior: "bg-green-100 text-green-700",
    Associate: "bg-gray-100 text-gray-600",
    Junior: "bg-gray-100 text-gray-500",
  }

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-6 py-0">
        <div className="flex items-center justify-between h-12">

          {/* Left — Logo + Nav links */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 mr-4">
              <div className="w-6 h-6 bg-orange-500 rounded-sm flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
            </div>

            {loading ? (
              <div className="text-xs text-gray-400">Loading...</div>
            ) : (
              visibleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-600 hover:text-gray-900 py-3 border-b-2 border-transparent hover:border-orange-500 transition-colors whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))
            )}
          </div>

          {/* Right — Role badge + Admin + Add + User */}
          <div className="flex items-center gap-3">

            {/* Role badge */}
            {!loading && currentUser && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                ROLE_COLORS[currentUser.role] ?? "bg-gray-100 text-gray-600"
              }`}>
                {currentUser.role}
              </span>
            )}

            {/* Admin link */}
            {canSeeAdminPortal && (
              <Link
                href="/admin"
                className="text-xs text-orange-500 border border-orange-200 rounded px-2 py-1 hover:bg-orange-50"
              >
                Admin
              </Link>
            )}

            {/* + Add button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAddMenu(!showAddMenu)
                  setShowUserMenu(false)
                }}
                className="flex items-center gap-1 bg-orange-500 text-white text-sm px-3 py-1.5 rounded-md hover:bg-orange-600 transition-colors"
              >
                <span className="text-lg leading-none">+</span>
                <span>Add</span>
              </button>

              {showAddMenu && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-72 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-700">Quick create</p>
                  </div>
                  <div className="py-1">
                    {visibleAddItems.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => {
                          router.push(item.href)
                          setShowAddMenu(false)
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <span className="text-lg">{item.icon}</span>
                        <div>
                          <p className="text-xs font-medium text-gray-800">
                            {item.label}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User avatar dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu)
                  setShowAddMenu(false)
                }}
                className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-300"
              >
                {email?.[0]?.toUpperCase()}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-52 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-400 truncate">{email}</p>
                    {!loading && currentUser && (
                      <p className="text-xs font-medium text-gray-700 mt-0.5">
                        {currentUser.fullName}
                      </p>
                    )}
                    {!loading && currentUser && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${
                        ROLE_COLORS[currentUser.role] ?? "bg-gray-100 text-gray-600"
                      }`}>
                        {currentUser.role}
                      </span>
                    )}
                  </div>
                  {canSeeAdminPortal && (
                    <Link
                      href="/admin"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 border-b border-gray-100"
                    >
                      ⚙ Admin portal
                    </Link>
                  )}
                  <form action="/auth/signout" method="POST">
                    <button
                      type="submit"
                      className="w-full text-left text-xs text-red-500 hover:bg-red-50 px-3 py-2"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Close menus on outside click */}
      {(showAddMenu || showUserMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowAddMenu(false)
            setShowUserMenu(false)
          }}
        />
      )}
    </>
  )
}