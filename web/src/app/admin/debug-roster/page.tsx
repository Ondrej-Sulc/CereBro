import type { Metadata } from "next";
import PageBackground from "@/components/PageBackground";
import { DebugRosterForm } from "@/components/DebugRosterForm";
import { ensureAdmin } from "../actions";

export const metadata: Metadata = {
  title: "Debug Roster Processing - CereBro",
  description:
    "Upload roster screenshots to inspect OCR output, bounding boxes, and detected text.",
};

export default async function DebugRosterPage() {
    await ensureAdmin("MANAGE_SYSTEM");
    
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
