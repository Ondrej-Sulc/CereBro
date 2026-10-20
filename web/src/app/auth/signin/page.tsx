import Link from "next/link";
import { signInFromAuthPageAction } from "@/app/actions/auth";
import AuthErrorPage from "../error/page";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  if (error) return AuthErrorPage({ searchParams: Promise.resolve({ error }) });

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-2 text-2xl font-bold">Sign in to CereBro</h1>
      <p className="mb-8 max-w-md text-slate-400">Use the Discord account you originally used with CereBro.</p>
      <form action={signInFromAuthPageAction}>
        <input type="hidden" name="callbackUrl" value={callbackUrl || "/"} />
        <button type="submit" className="rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700">
          Sign in with Discord
        </button>
      </form>
      <Link href="/" className="mt-4 text-sm text-slate-500 hover:text-slate-300">Return to home</Link>
    </div>
  );
}
