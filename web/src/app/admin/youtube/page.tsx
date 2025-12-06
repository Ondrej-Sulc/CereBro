import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function YouTubeAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  // Check Admin Status
  const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'discord' }
  });
  const player = account ? await prisma.player.findFirst({ where: { discordId: account.providerAccountId } }) : null;
  
  if (!player?.isBotAdmin) {
     return <div className="p-8 text-center text-red-500">Access Denied</div>;
  }

  const currentToken = await prisma.systemConfig.findUnique({
      where: { key: 'YOUTUBE_REFRESH_TOKEN' }
  });

  const { success, error } = await searchParams;

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">YouTube Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">Status</p>
              <p className="text-xs text-slate-400">
                {currentToken ? "Token Present" : "No Token Found"}
              </p>
            </div>
            {currentToken ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            ) : (
                <AlertCircle className="h-6 w-6 text-amber-500" />
            )}
          </div>

          {success && (
            <Alert className="bg-emerald-900/20 border-emerald-900/50 text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                YouTube refresh token has been updated successfully.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error === 'no_refresh_token' 
                    ? 'No refresh token returned. You might need to revoke access in Google Account settings to force a new consent prompt.' 
                    : 'Failed to update token.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-4">
             <p className="text-sm text-slate-400">
                Clicking below will redirect you to Google to authorize the CereBro app. 
                Ensure you are logging in with the account that owns the YouTube channel.
             </p>
             <Link href="/api/admin/youtube/auth">
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
                    Connect YouTube Account
                </Button>
             </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
