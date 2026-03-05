"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  Map,
  Server,
  ChevronLeft,
  ChevronRight,
  LucideIcon
} from "lucide-react"

interface SidebarItem {
  title: string
  href: string
  icon: LucideIcon
}

interface SidebarGroup {
  label: string
  items: SidebarItem[]
}

const groups: SidebarGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { title: "Insights", href: "/admin/insights", icon: LineChart },
    ]
  },
  {
    label: "Community",
    items: [
      { title: "Alliances", href: "/admin/alliances", icon: Shield },
      { title: "Discord Servers", href: "/admin/discord", icon: Server },
      { title: "Players", href: "/admin/players", icon: Users },
    ]
  },
  {
    label: "Game Data",
    items: [
      { title: "Champions", href: "/admin/champions", icon: Sword },
      { title: "Quests", href: "/admin/quests", icon: Map },
    ]
  },
  {
    label: "War Config",
    items: [
      { title: "War Bans", href: "/admin/bans", icon: Ban },
      { title: "War Nodes", href: "/admin/nodes", icon: Hash },
      { title: "War Tactics", href: "/admin/tactics", icon: Target },
    ]
  },
  {
    label: "System",
    items: [
      { title: "YouTube Token", href: "/admin/youtube", icon: Youtube },
      { title: "Debug Roster", href: "/admin/debug-roster", icon: Bug },
    ]
  }
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed")
    if (saved !== null) {
        setIsCollapsed(saved === "true")
    }
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isMounted) {
        localStorage.setItem("admin-sidebar-collapsed", String(isCollapsed))
        // Dispatch custom event for layout to react to width change
        window.dispatchEvent(new CustomEvent("admin-sidebar-toggle", { detail: { collapsed: isCollapsed } }))
    }
  }, [isCollapsed, isMounted])

  if (!isMounted) return null

  return (
    <TooltipProvider delayDuration={0}>
      <nav className={cn(
        "flex flex-col space-y-4 transition-all duration-300",
        isCollapsed ? "w-12" : "w-64"
      )}>
        <div className="flex items-center justify-between px-2 mb-2">
            {!isCollapsed && <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</span>}
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 ml-auto" 
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
        </div>

        {groups.map((group) => (
          <div key={group.label} className="flex flex-col space-y-1">
            {!isCollapsed && (
              <h3 className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                {group.label}
              </h3>
            )}
            <div className="flex flex-col space-y-1">
                {group.items.map((item) => {
                    const isActive = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
                    
                    const content = (
                        <Button
                            key={item.href}
                            variant={isActive ? "secondary" : "ghost"}
                            className={cn(
                                "justify-start h-9",
                                isCollapsed ? "px-0 justify-center w-10 mx-auto" : "px-4",
                                isActive && "bg-muted font-medium"
                            )}
                            asChild
                        >
                            <Link href={item.href}>
                                <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                                {!isCollapsed && <span>{item.title}</span>}
                            </Link>
                        </Button>
                    );

                    if (isCollapsed) {
                        return (
                            <Tooltip key={item.href}>
                                <TooltipTrigger asChild>
                                    {content}
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    {item.title}
                                </TooltipContent>
                            </Tooltip>
                        );
                    }

                    return content;
                })}
            </div>
            {!isCollapsed && <div className="h-2" />}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  )
}
