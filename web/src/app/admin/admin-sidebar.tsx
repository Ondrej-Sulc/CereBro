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
import { Permission } from "@/lib/permissions"

interface SidebarItem {
  title: string
  href: string
  icon: LucideIcon
  permission?: Permission // If set, requires this permission OR isBotAdmin
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
      { title: "Insights", href: "/admin/insights", icon: LineChart, permission: "VIEW_INSIGHTS" },
    ]
  },
  {
    label: "Community",
    items: [
      { title: "Alliances", href: "/admin/alliances", icon: Shield, permission: "MANAGE_ALLIANCES" },
      { title: "Discord Servers", href: "/admin/discord", icon: Server, permission: "MANAGE_SYSTEM" },
      { title: "Users", href: "/admin/users", icon: Users, permission: "MANAGE_USERS" },
    ]
  },
  {
    label: "Game Data",
    items: [
      { title: "Champions", href: "/admin/champions", icon: Sword, permission: "MANAGE_CHAMPIONS" },
      { title: "Abilities", href: "/admin/abilities", icon: Target, permission: "MANAGE_CHAMPIONS" },
      { title: "Quests", href: "/admin/quests", icon: Map, permission: "MANAGE_QUESTS" },
    ]
  },
  {
    label: "War Config",
    items: [
      { title: "War Bans", href: "/admin/bans", icon: Ban, permission: "MANAGE_WAR_CONFIG" },
      { title: "War Nodes", href: "/admin/nodes", icon: Hash, permission: "MANAGE_WAR_CONFIG" },
      { title: "War Tactics", href: "/admin/tactics", icon: Target, permission: "MANAGE_WAR_CONFIG" },
    ]
  },
  {
    label: "System",
    items: [
      { title: "YouTube Token", href: "/admin/youtube", icon: Youtube, permission: "MANAGE_SYSTEM" },
      { title: "Debug Roster", href: "/admin/debug-roster", icon: Bug, permission: "MANAGE_SYSTEM" },
    ]
  }
]

interface AdminSidebarProps {
  isBotAdmin: boolean;
  permissions: string[];
  isMobile?: boolean;
}

export function AdminSidebar({ isBotAdmin, permissions, isMobile }: AdminSidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Persist collapse state
  useEffect(() => {
    if (!isMobile) {
      const saved = localStorage.getItem("admin-sidebar-collapsed")
      if (saved !== null) {
          setIsCollapsed(saved === "true")
      }
    }
    setIsMounted(true)
  }, [isMobile])

  useEffect(() => {
    if (isMounted && !isMobile) {
        localStorage.setItem("admin-sidebar-collapsed", String(isCollapsed))
        // Dispatch custom event for layout to react to width change
        window.dispatchEvent(new CustomEvent("admin-sidebar-toggle", { detail: { collapsed: isCollapsed } }))
    }
  }, [isCollapsed, isMounted, isMobile])

  if (!isMounted) return null

  // Filter groups based on permissions
  const filteredGroups = groups.map(group => {
    return {
      ...group,
      items: group.items.filter(item => {
        if (isBotAdmin) return true;
        // Non-admins can only see Dashboard and items they explicitly have permission for
        if (item.href === "/admin") return true; 
        if (item.permission && permissions.includes(item.permission)) return true;
        return false;
      })
    }
  }).filter(group => group.items.length > 0);

  const collapsedState = isMobile ? false : isCollapsed;

  return (
    <TooltipProvider delayDuration={0}>
      <nav className={cn(
        "flex flex-col space-y-4 transition-all duration-300",
        collapsedState ? "w-12" : "w-64",
        isMobile && "w-full px-4"
      )}>
        {!isMobile && (
          <div className="flex items-center justify-between px-2 mb-2">
              {!collapsedState && <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</span>}
              <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 ml-auto" 
                  onClick={() => setIsCollapsed(!isCollapsed)}
              >
                  {collapsedState ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
          </div>
        )}

        {filteredGroups.map((group) => (
          <div key={group.label} className="flex flex-col space-y-1">
            {!collapsedState && (
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
                                collapsedState ? "px-0 justify-center w-10 mx-auto" : "px-4",
                                isActive && "bg-muted font-medium"
                            )}
                            asChild
                        >
                            <Link href={item.href}>
                                <item.icon className={cn("h-4 w-4", !collapsedState && "mr-2")} />
                                {!collapsedState && <span>{item.title}</span>}
                            </Link>
                        </Button>
                    );

                    if (collapsedState) {
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
            {!collapsedState && <div className="h-2" />}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  )
}
