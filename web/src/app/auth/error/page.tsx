import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { DISCORD_INVITE } from "@/lib/links";

// Auth.js masks non-client-safe errors (including InvalidCheck) as Configuration.
// Do not infer the original cause from that external error code.
const ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  OAuthAccountNotLinked: {
    title: "Account conflict",
    detail:
      "This Discord sign-in could not be matched safely to your CereBro account. If you are signed into a different CereBro account, sign out first. Then sign in using your original Discord account. If that still fails, contact support to review your account link.",
  },
  Configuration: {
    title: "Sign-in could not be completed",
    detail:
      "This can happen when a sign-in check fails or when there is a server configuration problem. Start again in one tab in the same browser and allow cookies for CereBro. If it keeps happening, contact support so we can investigate.",
  },
  InvalidCheck: {
    title: "Sign-in could not be verified",
    detail:
      "A security check failed. Start sign-in again in one tab in the same browser and allow cookies for CereBro. If it keeps happening, contact support.",
  },
  OAuthCallbackError: {
    title: "Discord sign-in failed",
    detail:
      "Discord returned an error during sign-in. Please try again. If the problem persists, check that you haven't revoked CereBro's access in your Discord settings.",
  },
  OAuthSignin: {
    title: "Could not start sign-in",
    detail: "Failed to begin the Discord sign-in flow. Please try again.",
  },
  AccessDenied: {
    title: "Access denied",
    detail: "You do not have permission to access this application.",
  },
};

const DEFAULT_ERROR = {
  title: "Sign-in failed",
  detail:
    "An unexpected error occurred during sign-in. Please try again. If the problem keeps happening, let us know in the Discord server.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { title, detail } = (error && Object.hasOwn(ERROR_MESSAGES, error) && ERROR_MESSAGES[error]) || DEFAULT_ERROR;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-amber-400" />
      <h1 className="mb-2 text-2xl font-bold">{title}</h1>
      <p className="mb-8 max-w-md text-slate-400">{detail}</p>
      {error === "OAuthAccountNotLinked" && (
        <form action={signOutAction} className="mb-4">
          <button type="submit" className="rounded-md border border-slate-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            Sign out of CereBro
          </button>
        </form>
      )}
      <Link
        href="/api/auth/signin"
        className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
      >
        <RefreshCw className="h-4 w-4" />
        Try signing in again
      </Link>
      <a href={DISCORD_INVITE} className="mt-4 text-sm text-sky-400 hover:text-sky-300">
        Contact support
      </a>
      <Link href="/" className="mt-4 text-sm text-slate-500 hover:text-slate-300">
        Return to home
      </Link>
    </div>
  );
}
