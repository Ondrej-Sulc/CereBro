"use client";

import commandData from "@/lib/data/commands.json";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Command as CommandIcon,
  ChevronRight,
  Hash,
  List,
  User,
  Shield,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---

interface CommandArgumentOption {
  type: number;
  name: string;
  description: string;
  required: boolean;
  choices?: { name: string; value: string | number }[];
}

interface SubcommandOption {
  type: 1;
  name: string;
  description: string;
  options?: CommandArgumentOption[];
}

interface SubcommandGroupOption {
  type: 2;
  name: string;
  description: string;
  options?: SubcommandOption[];
}

interface Command {
  name: string;
  description: string;
  group: string;
  color: string;
  options?: (SubcommandOption | SubcommandGroupOption | CommandArgumentOption)[];
  subcommands: {
    [key: string]: {
      image?: string;
    } | undefined;
  };
}

// --- Helpers ---

const getGroupColor = (group: string) => {
  // Map the JSON colors to Tailwind classes
  // The JSON has "red", "sky", "indigo", etc.
  switch (group.toLowerCase()) {
    case "BOT_ADMIN": return "text-red-400 bg-red-500/10 border-red-500/20";
    case "alliance tools": return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    case "information & search": return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    default: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
  }
};

// --- Components ---

function GroupIconDisplay({ group, className }: { group: string; className?: string }) {
  switch (group.toLowerCase()) {
    case "bot_admin": return <Shield className={className} />;
    case "alliance tools": return <User className={className} />;
    case "information & search": return <Search className={className} />;
    default: return <CommandIcon className={className} />;
  }
}

interface CommandReferenceProps {
  isAdmin?: boolean;
}

export default function CommandReference({ isAdmin = false }: CommandReferenceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Reset selection when group changes, unless searching
  useEffect(() => {
    if (searchQuery === "") {
      // Optional: could reset selectedCommand here if desired, but keeping it might be better UX
    }
  }, [selectedGroup, searchQuery]);

  const commandGroups = useMemo(() => {
    const groups = ["All", ...Array.from(new Set(commandData.map((c) => c.group)))];
    const sortedGroups = groups.sort();

    if (isAdmin) {
      return sortedGroups;
    }

    return sortedGroups.filter(group => group !== "BOT_ADMIN");
  }, [isAdmin]);

  const filteredCommands = useMemo(() => {
    return (commandData as Command[]).filter((command) => {
      // Filter out BOT_ADMIN commands if not admin, even if "All" is selected
      if (!isAdmin && command.group === "BOT_ADMIN") {
        return false;
      }

      const groupMatch = selectedGroup === "All" || command.group === selectedGroup;
      const searchMatch =
        searchQuery === "" ||
        command.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        command.description.toLowerCase().includes(searchQuery.toLowerCase());
      return groupMatch && searchMatch;
    });
  }, [searchQuery, selectedGroup, isAdmin]);

  const handleCommandClick = (command: Command) => {
    setSelectedCommand(command);
    setIsMobileDetailOpen(true);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[400px] max-h-[calc(100vh-18rem)] overflow-hidden">

      {/* Left Sidebar: Groups & Search & List */}
      <div className="w-full lg:w-1/3 flex flex-col gap-4 h-full">

        {/* Search Bar */}
        <div className="relative shrink-0 z-20">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-transparent transition-all relative z-20"
          />
        </div>

        {/* Groups (Wrapped Pills) */}
        <div className="flex flex-wrap gap-2 pb-2 shrink-0">
          {commandGroups.map((group) => {
            const isActive = selectedGroup === group;
            return (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border cursor-pointer",
                  isActive
                    ? "bg-slate-100 text-slate-900 border-slate-100"
                    : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                {group !== "All" && <GroupIconDisplay group={group} className="w-3 h-3" />}
                {group}
              </button>
            );
          })}
        </div>

        {/* Command List */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar max-h-[600px]">
          {filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500">
              <Search className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No commands found</p>
            </div>
          ) : (
            filteredCommands.map((command) => (
              <button
                key={command.name}
                onClick={() => handleCommandClick(command)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden cursor-pointer",
                  selectedCommand?.name === command.name
                    ? "bg-slate-800 border-slate-700 shadow-lg shadow-black/20"
                    : "bg-slate-900/30 border-transparent hover:bg-slate-800/50 hover:border-slate-700/50"
                )}
              >
                <div className={cn("absolute left-0 top-0 bottom-0 w-1 transition-colors", selectedCommand?.name === command.name ? getGroupColor(command.group).split(' ')[1].replace('/10', '') : "bg-transparent")} />

                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-200 group-hover:text-sky-300 transition-colors">
                      /{command.name}
                    </span>
                    {selectedCommand?.name === command.name && (
                      <motion.span layoutId="active-dot" className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    )}
                  </div>
                  <ChevronRight className={cn("w-4 h-4 text-slate-600 transition-transform", selectedCommand?.name === command.name ? "translate-x-1 text-sky-400" : "")} />
                </div>
                <p className="text-xs text-slate-400 line-clamp-1 pl-0.5">
                  {command.description}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Content: Command Details (Desktop) */}
      <div className="hidden lg:block flex-1 bg-slate-900/30 rounded-2xl border border-slate-800/50 overflow-hidden relative">
        {selectedCommand ? (
          <CommandDetailView command={selectedCommand} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Mobile Detail Modal/Drawer */}
      {mounted && createPortal(
        <AnimatePresence>
          {isMobileDetailOpen && selectedCommand && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-[100] lg:hidden bg-slate-950 flex flex-col"
            >
              <div className="sticky top-0 z-50 flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
                <span className="font-mono font-bold text-slate-200 text-lg">/{selectedCommand.name}</span>
                <button
                  onClick={() => setIsMobileDetailOpen(false)}
                  className="p-2 -mr-2 text-slate-400 hover:text-white bg-slate-900/50 rounded-full border border-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 relative">
                <CommandDetailView command={selectedCommand} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// --- Sub-components ---

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-slate-800/50 flex items-center justify-center mb-6 rotate-3">
        <CommandIcon className="w-10 h-10 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-2">Select a command</h3>
      <p className="text-sm max-w-xs mx-auto">
        Choose a command from the list on the left to view its usage, arguments, and examples.
      </p>
    </div>
  );
}

function CommandDetailView({ command }: { command: Command }) {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-6 border-b border-slate-800/50 bg-gradient-to-b from-slate-800/20 to-transparent">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-3xl font-bold text-white font-mono mb-2">/{command.name}</h2>
            <p className="text-slate-300 text-lg leading-relaxed">{command.description}</p>
          </div>
          <div className={cn("shrink-0 px-3 py-1.5 rounded-lg border flex items-center gap-2", getGroupColor(command.group))}>
            <GroupIconDisplay group={command.group} className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">{command.group}</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Options / Subcommands */}
        {command.options && command.options.length > 0 && (
          <div className="space-y-6">
            {command.options.map((option, idx) => {
              if (option.type === 1) { // Subcommand
                return <SubcommandCard key={idx} commandName={command.name} option={option as SubcommandOption} command={command} />;
              }
              if (option.type === 2) { // Subcommand Group
                return <SubcommandGroupCard key={idx} commandName={command.name} group={option as SubcommandGroupOption} command={command} />;
              }
              // Top level arguments (rare for slash commands with subcommands but possible)
              return <ArgumentRow key={idx} option={option as CommandArgumentOption} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SubcommandCard({ commandName, option, command }: { commandName: string; option: SubcommandOption; command: Command }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden transition-all hover:border-slate-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center gap-3 bg-slate-900/30 hover:bg-slate-800/50 transition-colors text-left"
      >
        <ChevronRight className={cn("w-4 h-4 text-slate-500 transition-transform shrink-0", isOpen ? "rotate-90" : "")} />
        <div className="font-mono text-sm text-sky-300 bg-sky-500/10 px-2 py-1 rounded border border-sky-500/20 shrink-0">
          {option.name}
        </div>
        <p className="text-sm text-slate-400 line-clamp-1">{option.description}</p>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 border-t border-slate-800/50">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">
                <Hash className="w-3 h-3" /> Usage
              </div>
              <div className="bg-slate-950 rounded-lg p-3 font-mono text-sm text-slate-300 mb-4 border border-slate-800 overflow-x-auto">
                <span className="text-sky-400">/{commandName}</span> <span className="text-indigo-400">{option.name}</span>
                {option.options?.map(opt => (
                  <span key={opt.name} className={opt.required ? "text-slate-200" : "text-slate-500"}>
                    {' '}{opt.required ? `<${opt.name}>` : `[${opt.name}]`}
                  </span>
                ))}
              </div>

              {option.options && option.options.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">
                    <List className="w-3 h-3" /> Arguments
                  </div>
                  <div className="grid gap-2">
                    {option.options.map(opt => (
                      <ArgumentRow key={opt.name} option={opt} />
                    ))}
                  </div>
                </div>
              )}

              {/* Image Preview if available */}
              {(() => {
                const subcommandDetails = command.subcommands?.[option.name];
                if (subcommandDetails?.image) {
                  return (
                    <div className="mt-4">
                      <div className="relative rounded-xl overflow-hidden border border-slate-800/50 group">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
                        <Image
                          src={subcommandDetails.image}
                          alt={`${commandName} ${option.name} preview`}
                          width={600}
                          height={300}
                          className="w-full h-auto opacity-90 transition-opacity group-hover:opacity-100"
                        />
                      </div>
                    </div>
                  )
                }
                return null;
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubcommandGroupCard({ commandName, group, command }: { commandName: string; group: SubcommandGroupOption, command: Command }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Group: {group.name}</span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>
      {group.options?.map(subOption => (
        <SubcommandGroupItem key={subOption.name} commandName={commandName} group={group} subOption={subOption} command={command} />
      ))}
    </div>
  )
}

function SubcommandGroupItem({ commandName, group, subOption, command }: { commandName: string; group: SubcommandGroupOption; subOption: SubcommandOption; command: Command }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden transition-all hover:border-slate-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center gap-3 bg-slate-900/30 hover:bg-slate-800/50 transition-colors text-left"
      >
        <ChevronRight className={cn("w-4 h-4 text-slate-500 transition-transform shrink-0", isOpen ? "rotate-90" : "")} />
        <div className="flex items-center gap-1 font-mono text-sm text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 shrink-0">
          <span>{group.name}</span>
          <span className="text-slate-600">/</span>
          <span>{subOption.name}</span>
        </div>
        <p className="text-sm text-slate-400 line-clamp-1">{subOption.description}</p>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 border-t border-slate-800/50">
              <div className="bg-slate-950 rounded-lg p-3 font-mono text-sm text-slate-300 mb-4 border border-slate-800 overflow-x-auto">
                <span className="text-sky-400">/{commandName}</span> <span className="text-indigo-400">{group.name}</span> <span className="text-indigo-300">{subOption.name}</span>
                {subOption.options?.map(opt => (
                  <span key={opt.name} className={opt.required ? "text-slate-200" : "text-slate-500"}>
                    {' '}{opt.required ? `<${opt.name}>` : `[${opt.name}]`}
                  </span>
                ))}
              </div>

              {subOption.options && subOption.options.length > 0 && (
                <div className="grid gap-2">
                  {subOption.options.map(opt => (
                    <ArgumentRow key={opt.name} option={opt} />
                  ))}
                </div>
              )}

              {/* Image Preview if available */}
              {(() => {
                const subcommandDetails = command.subcommands?.[subOption.name];
                if (subcommandDetails?.image) {
                  return (
                    <div className="mt-4">
                      <div className="relative rounded-xl overflow-hidden border border-slate-800/50 group">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
                        <Image
                          src={subcommandDetails.image}
                          alt={`${commandName} ${subOption.name} preview`}
                          width={600}
                          height={300}
                          className="w-full h-auto opacity-90 transition-opacity group-hover:opacity-100"
                        />
                      </div>
                    </div>
                  )
                }
                return null;
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ArgumentRow({ option }: { option: CommandArgumentOption }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/30 transition-colors">
      <div className={cn(
        "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-0.5 border",
        option.required
          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
      )}>
        {option.required ? "REQ" : "OPT"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-slate-200">{option.name}</span>
          {option.choices && (
            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 rounded">
              {option.choices.length} choices
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{option.description}</p>
      </div>
    </div>
  );
}
