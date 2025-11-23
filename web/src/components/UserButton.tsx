import { signIn, signOut, auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { LogIn, LogOut } from "lucide-react"
import Image from "next/image"

import Link from "next/link"

export async function UserButton() {
  const session = await auth()

  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server"
          await signIn("discord")
        }}
      >
        <Button variant="ghost" size="sm" className="gap-2 text-slate-300 hover:text-white hover:bg-slate-800">
          <LogIn className="w-4 h-4" />
          Sign In
        </Button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity" title="View Profile">
          {session.user.image && (
            <Image
              src={session.user.image}
              alt={session.user.name ?? "User Avatar"}
              width={32}
              height={32}
              className="rounded-full ring-2 ring-slate-700"
            />
          )}
          <span className="text-sm font-medium text-slate-200 hidden sm:block">{session.user.name}</span>
      </Link>
      <form
        action={async () => {
          "use server"
          await signOut()
        }}
      >
        <Button variant="ghost" size="sm" className="gap-2 text-slate-300 hover:text-white hover:bg-slate-800 px-2 sm:px-4">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </form>
    </div>
  )
}
