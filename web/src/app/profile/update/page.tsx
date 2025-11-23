import { RosterUpdateForm } from "@/components/RosterUpdateForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function RosterUpdatePage() {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/api/auth/signin?callbackUrl=/profile/update");
    }
    
    return (
        <div className="container mx-auto p-4 sm:p-8 space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-white">Update Roster</h1>
                <p className="text-slate-400 max-w-2xl mx-auto">
                    Upload screenshots of your champion roster to automatically update your profile. 
                    Ensure screenshots are clear and contain the champion grid.
                </p>
            </div>
            
            <RosterUpdateForm />
        </div>
    );
}