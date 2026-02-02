import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PlayerWithRoster, FightWithNode } from "@cerebro/core/data/war-planning/types";
import { War } from "@prisma/client";
import { ExtraChampion } from "../hooks/use-war-planning";
import { Champion } from "@/types/champion";
import { PlayerListContent } from "./player-list-content";

interface PlayerListPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  players: PlayerWithRoster[];
  currentFights: FightWithNode[];
  highlightedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  isDesktop: boolean;
  currentBattlegroup: number;
  extraChampions: ExtraChampion[];
  onAddExtra: (playerId: string, championId: number) => void;
  onRemoveExtra: (extraId: string) => void;
  champions: Champion[];
  war: War; // Add war prop
  isReadOnly?: boolean;
  activeDefensePlan?: { placements: { defenderId: number | null; playerId: string | null }[] } | null;
}

export const PlayerListPanel = ({
  isOpen,
  onToggle,
  players,
  currentFights,
  highlightedPlayerId,
  onSelectPlayer,
  isDesktop,
  currentBattlegroup,
  extraChampions,
  onAddExtra,
  onRemoveExtra,
  champions,
  war, // Destructure war prop
  isReadOnly = false,
  activeDefensePlan,
}: PlayerListPanelProps) => {

  if (!isDesktop) return null; // Desktop only sidebar wrapper

  return (
    <motion.div
      initial={{ width: isOpen ? 300 : 0, opacity: isOpen ? 1 : 0 }}
      animate={{ width: isOpen ? 300 : 0, opacity: isOpen ? 1 : 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "flex flex-col border-r border-slate-800 bg-slate-950 h-full overflow-hidden relative shrink-0",
        !isOpen && "w-0 border-none"
      )}
    >
      <div className="h-full flex flex-col">
          <div className="flex-1 overflow-hidden">
             <PlayerListContent
                players={players}
                currentFights={currentFights}
                highlightedPlayerId={highlightedPlayerId}
                onSelectPlayer={onSelectPlayer}
                currentBattlegroup={currentBattlegroup}
                extraChampions={extraChampions}
                onAddExtra={onAddExtra}
                onRemoveExtra={onRemoveExtra}
                champions={champions}
                onClose={onToggle}
                war={war} // Pass war prop
                isReadOnly={isReadOnly}
                activeDefensePlan={activeDefensePlan}
             />
          </div>
      </div>
    </motion.div>
  );
};

