"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogIn, LogOut, User, LayoutDashboard, UserRound } from "lucide-react";
import Link from "next/link";
import { signInAction, signOutAction } from "@/app/actions/auth";
import type { Session } from "next-auth";
import { useHeaderOverlay } from "./header-overlay";
import styles from "./header.module.css";

export function UserMenu({ user }: { user?: Session["user"] }) {
  const { overlay, setOverlay } = useHeaderOverlay();
  const hasAdminAccess =
    user &&
    (user.isBotAdmin || (user.permissions && user.permissions.length > 0));
  return (
    <DropdownMenu
      open={overlay === "account"}
      onOpenChange={(open) =>
        setOverlay((current) =>
          open ? "account" : current === "account" ? null : current,
        )
      }
      modal={false}
    >
      <DropdownMenuTrigger
        className={styles.accountButton}
        aria-label="Account"
      >
        {user ? (
          <Avatar className={styles.accountAvatar}>
            <AvatarImage src={user.image || undefined} alt="" />
            <AvatarFallback>
              {user.name?.substring(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <UserRound aria-hidden="true" />
        )}
        <span>Account</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className={styles.accountDropdown}
        onCloseAutoFocus={(event) => {
          if (overlay && overlay !== "account") event.preventDefault();
        }}
      >
        {user ? (
          <>
            <div className={styles.accountName}>
              {user.name || "Your account"}
            </div>
            <DropdownMenuSeparator className={styles.separator} />
            {hasAdminAccess && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className={styles.link}>
                  <LayoutDashboard aria-hidden="true" />
                  Admin Portal
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/profile" className={styles.link}>
                <User aria-hidden="true" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className={styles.separator} />
            <DropdownMenuItem
              className={`${styles.link} ${styles.signOut}`}
              onSelect={() => signOutAction()}
            >
              <LogOut aria-hidden="true" />
              Sign Out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <div className={styles.accountName}>Your CereBro account</div>
            <form action={signInAction}>
              <DropdownMenuItem
                asChild
                onSelect={(event) => event.preventDefault()}
              >
                <button type="submit" className={styles.link}>
                  <LogIn aria-hidden="true" />
                  Sign in with Discord
                </button>
              </DropdownMenuItem>
            </form>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
