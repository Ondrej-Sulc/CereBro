"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Sword,
  LineChart,
  Shield,
  Users,
  Ban,
  Bug,
  Hash,
  Target,
  Youtube,
  Map
} from "lucide-react"

const items = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Insights",
    href: "/admin/insights",
    icon: LineChart,
  },
  {
    title: "Alliances",
    href: "/admin/alliances",
    icon: Shield,
  },
  {
    title: "Players",
    href: "/admin/players",
    icon: Users,
  },
  {
    title: "Champions",
    href: "/admin/champions",
    icon: Sword,
  },
  {
    title: "War Bans",
    href: "/admin/bans",
    icon: Ban,
  },
  {
    title: "War Nodes",
    href: "/admin/nodes",
    icon: Hash,
  },
  {
    title: "War Tactics",
    href: "/admin/tactics",
    icon: Target,
  },
  {
    title: "YouTube Token",
    href: "/admin/youtube",
    icon: Youtube,
  },
  {
    title: "Debug Roster",
    href: "/admin/debug-roster",
    icon: Bug,
  },
  {
    title: "Quests",
    href: "/admin/quests",
    icon: Map,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col space-y-1">
      {items.map((item) => (
        <Button
          key={item.href}
          variant={
            (item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href))
              ? "secondary"
              : "ghost"
          }
          className={cn(
            "justify-start",
            (item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href)) && "bg-muted"
          )}
          asChild
        >
          <Link href={item.href}>
            <item.icon className="mr-2 h-4 w-4" />
            {item.title}
          </Link>
        </Button>
      ))}
    </nav>
  )
}
