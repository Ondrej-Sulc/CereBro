'use client';

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { DISCORD_INVITE } from "@/lib/links";

function QueryErrorToastInner() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const error = searchParams.get("error");

  useEffect(() => {
    if (error === "unregistered_player") {
      toast({
        title: "Registration Required",
        description: (
          <div className="space-y-2">
            <p>You need to be registered with CereBro to upload videos. This usually happens when you join an alliance through the bot.</p>
            <div className="flex flex-col gap-1 text-xs">
              <Link href={DISCORD_INVITE} target="_blank" className="text-sky-400 hover:underline">
                Join our Discord to sync your roles
              </Link>
              <Link href="/alliance/onboarding" className="text-sky-400 hover:underline">
                Register or join an alliance
              </Link>
            </div>
          </div>
        ),
        variant: "destructive",
        duration: 10000,
      });

      // Clear the error param from the URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      const newQuery = params.toString();
      const newUrl = `${pathname}${newQuery ? `?${newQuery}` : ""}`;
      router.replace(newUrl, { scroll: false });
    }
  }, [error, toast, router, pathname, searchParams]);

  return null;
}

export function QueryErrorToast() {
  return (
    <Suspense>
      <QueryErrorToastInner />
    </Suspense>
  );
}
