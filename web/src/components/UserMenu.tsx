"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, User, LayoutDashboard } from "lucide-react"
import Link from "next/link"
import { signOutAction } from "@/app/actions/auth"

interface UserMenuProps {
  user: {
    name?: string | null
    image?: string | null
    isBotAdmin?: boolean
  }
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none">
        <Avatar className="h-9 w-9 border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer">
          <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
          <AvatarFallback className="bg-slate-800 text-slate-300">
            {user.name?.substring(0, 2).toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-slate-950 border-slate-800 text-slate-300">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-white">{user.name}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800" />
        
        {user.isBotAdmin && (
            <>
                <DropdownMenuItem asChild>
                  <Link href="/admin/champions" className="cursor-pointer flex items-center gap-2 focus:bg-slate-800 focus:text-white">
                    <LayoutDashboard className="w-4 h-4 text-amber-500" />
                    <span>Admin Portal</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800" />
            </>
        )}

        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer flex items-center gap-2 focus:bg-slate-800 focus:text-white">
            <User className="w-4 h-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem 
            className="cursor-pointer flex items-center gap-2 text-red-400 focus:bg-slate-800 focus:text-red-300"
            onClick={() => signOutAction()}
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}