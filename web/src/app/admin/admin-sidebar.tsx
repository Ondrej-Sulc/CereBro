"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"
import {
  Activity,
  Ban,
  Bug,
  ChevronLeft,
  ChevronRight,
  Hash,
  Heart,
  LayoutDashboard,
  LineChart,
  LucideIcon,
  Map,
  Server,
  Shield,
  Sword,
  Target,
  Users,
  Video,
  Youtube,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { SheetClose } from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Permission } from "@/lib/permissions"
import { cn } from "@/lib/utils"

interface SidebarItem {
  title: string
  href: string
  icon: LucideIcon
  permission?: Permission
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
      { title: "Usage", href: "/admin/usage", icon: Activity, permission: "VIEW_INSIGHTS" },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Alliances", href: "/admin/alliances", icon: Shield, permission: "MANAGE_ALLIANCES" },
      { title: "Discord Servers", href: "/admin/discord", icon: Server, permission: "MANAGE_SYSTEM" },
      { title: "Users", href: "/admin/users", icon: Users, permission: "MANAGE_USERS" },
    ],
  },
  {
    label: "Game Data",
    items: [
      { title: "Champions", href: "/admin/champions", icon: Sword, permission: "MANAGE_CHAMPIONS" },
      { title: "Abilities", href: "/admin/abilities", icon: Target, permission: "MANAGE_CHAMPIONS" },
      { title: "Quests", href: "/admin/quests", icon: Map, permission: "MANAGE_QUESTS" },
    ],
  },
  {
    label: "War Config",
    items: [
      { title: "Bans", href: "/admin/bans", icon: Ban, permission: "MANAGE_WAR_CONFIG" },
      { title: "Nodes", href: "/admin/nodes", icon: Hash, permission: "MANAGE_WAR_CONFIG" },
      { title: "Tactics", href: "/admin/tactics", icon: Target, permission: "MANAGE_WAR_CONFIG" },
      { title: "Video Queue", href: "/admin/war-videos", icon: Video, permission: "MANAGE_WAR_CONFIG" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Support", href: "/admin/support", icon: Heart, permission: "MANAGE_SYSTEM" },
      { title: "YouTube Token", href: "/admin/youtube", icon: Youtube, permission: "MANAGE_SYSTEM" },
      { title: "Debug Roster", href: "/admin/debug-roster", icon: Bug, permission: "MANAGE_SYSTEM" },
    ],
  },
]

const SIDEBAR_COLLAPSED_STORAGE_KEY = "admin-sidebar-collapsed"
const SIDEBAR_COLLAPSED_EVENT = "admin-sidebar-collapsed-change"

function subscribeToSidebarCollapsed(callback: () => void) {
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, callback)
  window.addEventListener("storage", callback)

  return () => {
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function getSidebarCollapsedSnapshot() {
  return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
}

function getServerSidebarCollapsedSnapshot() {
  return false
}

interface AdminSidebarProps {
  isBotAdmin: boolean
  permissions: string[]
  isMobile?: boolean
}

export function AdminSidebar({ isBotAdmin, permissions, isMobile }: AdminSidebarProps) {
  const pathname = usePathname()
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getServerSidebarCollapsedSnapshot
  )

  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (isBotAdmin) return true
        if (item.href === "/admin") return true
        return Boolean(item.permission && permissions.includes(item.permission))
      }),
    }))
    .filter((group) => group.items.length > 0)

  const collapsedState = isMobile ? false : isCollapsed
  const toggleCollapsed = () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(!isCollapsed))
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT))
  }

  return (
    <TooltipProvider delayDuration={0}>
      <nav
        className={cn(
          "flex flex-col transition-all duration-300",
          collapsedState ? "w-14" : "w-64",
          isMobile ? "w-full px-3 pb-4" : "rounded-lg border bg-card p-2 shadow-sm"
        )}
      >
        {!isMobile && (
          <div className={cn("flex items-center px-2 pb-2", collapsedState ? "justify-center" : "justify-between")}>
            {!collapsedState && (
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={toggleCollapsed}
              aria-label={collapsedState ? "Expand admin navigation" : "Collapse admin navigation"}
            >
              {collapsedState ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <div className={cn("flex flex-col", collapsedState ? "gap-2" : "gap-4")}>
          {filteredGroups.map((group) => (
            <div
              key={group.label}
              className={cn(
                "flex flex-col",
                collapsedState ? "items-center gap-1 border-t pt-2 first:border-t-0 first:pt-0" : "gap-1"
              )}
            >
              {!collapsedState ? (
                <h3 className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </h3>
              ) : (
                <span className="sr-only">{group.label}</span>
              )}

              <div className={cn("flex flex-col gap-1", collapsedState ? "items-center" : "w-full")}>
                {group.items.map((item) => {
                  const isActive = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href)
                  const linkClassName = cn(
                    buttonVariants({ variant: "ghost", size: isMobile ? "default" : "sm" }),
                    "relative w-full justify-start gap-3 rounded-md text-muted-foreground hover:text-foreground",
                    isMobile && "h-11 px-3 text-sm",
                    collapsedState && "h-10 w-10 justify-center px-0",
                    isActive && [
                      "bg-muted text-foreground shadow-sm hover:bg-muted hover:text-foreground",
                      !collapsedState &&
                        "font-medium before:absolute before:left-0 before:top-1.5 before:h-6 before:w-1 before:rounded-r-full before:bg-primary",
                    ]
                  )

                  const link = (
                    <Link key={item.href} href={item.href} className={linkClassName}>
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      {!collapsedState && <span className="truncate">{item.title}</span>}
                    </Link>
                  )

                  const content = isMobile ? (
                    <SheetClose key={item.href} asChild>
                      {link}
                    </SheetClose>
                  ) : (
                    link
                  )

                  if (collapsedState) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{content}</TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="flex flex-col">
                            <span>{item.title}</span>
                            <span className="text-[10px] text-muted-foreground">{group.label}</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return content
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </TooltipProvider>
  )
}
