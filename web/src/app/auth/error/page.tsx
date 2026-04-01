import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Auth.js passes the error type as a query param, e.g. ?error=InvalidCheck
const ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  InvalidCheck: {
    title: "Login session expired",
    detail:
      "Your login session timed out or was started in another tab. Please try signing in again.",
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
  const { title, detail } = (error && ERROR_MESSAGES[error]) || DEFAULT_ERROR;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-amber-400" />
      <h1 className="mb-2 text-2xl font-bold">{title}</h1>
      <p className="mb-8 max-w-md text-slate-400">{detail}</p>
      <Link
        href="/api/auth/signin"
        className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
      >
        <RefreshCw className="h-4 w-4" />
        Try signing in again
      </Link>
      <Link href="/" className="mt-4 text-sm text-slate-500 hover:text-slate-300">
        Return to home
      </Link>
    </div>
  );
}
