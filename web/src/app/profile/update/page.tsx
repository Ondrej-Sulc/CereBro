import type { Metadata } from "next";
import { RosterUpdateForm } from "@/components/RosterUpdateForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageBackground from "@/components/PageBackground";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";

export const metadata: Metadata = {
  title: "Update Roster - CereBro",
  description:
    "Upload roster screenshots to automatically refresh your profile and champion data.",
};

export default async function RosterUpdatePage() {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/api/auth/discord-login?redirectTo=/profile/update");
    }

    // Check if user is admin
    let isBotAdmin = false;
    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { accounts: true }
        });
        
        const discordId = user?.accounts.find(a => a.provider === 'discord')?.providerAccountId;
        if (discordId) {
            const botUser = await prisma.botUser.findUnique({ where: { discordId } });
            isBotAdmin = botUser?.isBotAdmin ?? false;
        }
    } catch (e) {
        console.error("Failed to check admin status", e);
    }
    
    return (
        <div className="min-h-screen relative">
            <PageBackground />
            <div className="container mx-auto p-4 sm:p-8 space-y-8 relative z-10">
                <div className="text-center space-y-2 flex flex-col items-center">
                    <h1 className="text-3xl font-bold text-white">Update Roster</h1>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        Upload screenshots of your champion roster to automatically update your profile. 
                        Ensure screenshots are clear and contain the champion grid.
                    </p>
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 text-amber-400 text-sm">
                        <span className="font-bold uppercase text-xs bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">Note</span>
                        <span>Game language must be set to <strong>English</strong>. Other languages are not supported for screenshot processing.</span>
                    </div>
                    
                    {isBotAdmin && (
                        <div className="pt-2">
                            <Link href="/admin/debug-roster">
                                <Button variant="outline" size="sm" className="gap-2 border-yellow-500/50 text-yellow-500 hover:bg-yellow-950/30 hover:text-yellow-400">
                                    <Wrench className="w-3 h-3" />
                                    Debug Roster (Admin)
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
                
                <RosterUpdateForm />
            </div>
        </div>
    );
}