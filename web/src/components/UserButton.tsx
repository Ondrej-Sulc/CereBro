import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"
import { UserMenu } from "./UserMenu"
import { signInAction } from "@/app/actions/auth"

export async function UserButton() {
  const session = await auth()

  if (!session?.user) {
    return (
      <form action={signInAction}>
        <Button variant="ghost" size="sm" className="gap-2 text-slate-300 hover:text-white hover:bg-slate-800">
          <LogIn className="w-4 h-4" />
          Sign In
        </Button>
      </form>
    )
  }

  return <UserMenu user={session.user} />
}