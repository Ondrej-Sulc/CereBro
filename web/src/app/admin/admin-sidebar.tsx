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
  Youtube 
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
    title: "Bans",
    href: "/admin/bans",
    icon: Ban,
  },
  {
    title: "Nodes",
    href: "/admin/nodes",
    icon: Hash,
  },
  {
    title: "Tactics",
    href: "/admin/tactics",
    icon: Target,
  },
  {
    title: "YouTube",
    href: "/admin/youtube",
    icon: Youtube,
  },
  {
    title: "Debug Roster",
    href: "/admin/debug-roster",
    icon: Bug,
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
