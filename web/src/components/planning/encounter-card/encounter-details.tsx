"use client";

import type React from "react";
import { motion } from "framer-motion";

export function EncounterDetails({
    children
}: {
    children: React.ReactNode;
}) {
    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-[#03060c]"
        >
            <div className="space-y-6 p-4">
                {children}
            </div>
        </motion.div>
    );
}
