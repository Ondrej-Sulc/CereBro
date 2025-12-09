import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FlipToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  leftLabel: string;
  rightLabel: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

export function FlipToggle({
  value,
  onChange,
  leftLabel,
  rightLabel,
  leftIcon,
  rightIcon,
  className,
}: FlipToggleProps) {
  return (
    <div
      className={cn(
        "relative flex items-center bg-slate-900/50 rounded-lg p-1 cursor-pointer select-none border border-slate-800/50 hover:border-slate-700 hover:bg-slate-900/60 transition-all duration-200",
        className
      )}
      onClick={() => onChange(!value)}
    >
      {/* Sliding Background */}
      <motion.div
        className="absolute inset-y-1 bg-slate-800 rounded-md shadow-sm border border-slate-700"
        style={{ width: "calc(50% - 4px)" }}
        initial={false}
        animate={{
          left: value ? "50%" : "4px",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />

      {/* Left Option */}
      <div
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 z-10 transition-colors duration-200 text-xs font-medium",
          !value ? "text-white" : "text-slate-400"
        )}
      >
        {leftIcon}
        <span>{leftLabel}</span>
      </div>

      {/* Right Option */}
      <div
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 z-10 transition-colors duration-200 text-xs font-medium",
          value ? "text-white" : "text-slate-400"
        )}
      >
        {rightIcon}
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
