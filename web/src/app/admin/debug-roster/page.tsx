import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageBackground from "@/components/PageBackground";
import { prisma } from "@/lib/prisma";
import { DebugRosterForm } from "@/components/DebugRosterForm";

export default async function DebugRosterPage() {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/api/auth/discord-login?redirectTo=/admin/debug-roster");
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

    if (!isBotAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
                    <p className="text-slate-400">You must be a bot administrator to view this page.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen relative">
            <PageBackground />
            <div className="container mx-auto p-4 sm:p-8 space-y-8 relative z-10">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-white">Debug Roster Processing</h1>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        Upload screenshots to see the raw OCR debug output, including bounding boxes and detected text.
                    </p>
                </div>
                
                <DebugRosterForm />
            </div>
        </div>
    );
}
