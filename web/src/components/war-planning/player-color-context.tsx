import React, { createContext, useContext, useMemo } from 'react';
import { PALETTE } from '@/lib/player-colors';

interface PlayerColorContextType {
  getPlayerColor: (playerId: string | undefined | null) => string;
}

export const PlayerColorContext = createContext<PlayerColorContextType | undefined>(undefined);

interface PlayerColorProviderProps {
  children: React.ReactNode;
  players: { id: string; battlegroup: number | null; ingameName: string }[];
}

export function PlayerColorProvider({ children, players }: PlayerColorProviderProps) {
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    
    // Sort players globally: By Battlegroup (1, 2, 3, null), then by Name
    const sortedPlayers = [...players].sort((a, b) => {
        // Handle Battlegroup Sorting
        const bgA = a.battlegroup || 999; // Treat null as high number to put at end
        const bgB = b.battlegroup || 999;
        
        if (bgA !== bgB) {
            return bgA - bgB;
        }

        // Handle Name Sorting
        return a.ingameName.localeCompare(b.ingameName);
    });

    // Assign colors sequentially
    sortedPlayers.forEach((player, index) => {
        map.set(player.id, PALETTE[index % PALETTE.length]);
    });

    return map;
  }, [players]);

  const getPlayerColor = (playerId: string | undefined | null) => {
    if (!playerId) return '#94a3b8'; // Slate 400
    return colorMap.get(playerId) || '#94a3b8'; // Fallback
  };

  return (
    <PlayerColorContext.Provider value={{ getPlayerColor }}>
      {children}
    </PlayerColorContext.Provider>
  );
}

export function usePlayerColor() {
  const context = useContext(PlayerColorContext);
  if (context === undefined) {
    throw new Error('usePlayerColor must be used within a PlayerColorProvider');
  }
  return context;
}
