import React, { createContext, useContext, useMemo } from 'react';
import { PALETTES, PlayerPaletteStyle, DEFAULT_PALETTE_STYLE } from '@/lib/player-colors';

interface PlayerColorContextType {
  getPlayerColor: (playerId: string | undefined | null) => string;
}

export const PlayerColorContext = createContext<PlayerColorContextType | undefined>(undefined);

interface PlayerColorProviderProps {
  children: React.ReactNode;
  players: { id: string; battlegroup: number | null; ingameName: string }[];
  paletteStyle?: PlayerPaletteStyle;
}

export function PlayerColorProvider({ children, players, paletteStyle = DEFAULT_PALETTE_STYLE }: PlayerColorProviderProps) {
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const resolved = PALETTES[paletteStyle] ?? PALETTES[DEFAULT_PALETTE_STYLE];
    const palette = resolved.length > 0 ? resolved : PALETTES[DEFAULT_PALETTE_STYLE];

    // Sort players globally: By Battlegroup (1, 2, 3, null), then by Name
    const sortedPlayers = [...players].sort((a, b) => {
        const bgA = a.battlegroup || 999;
        const bgB = b.battlegroup || 999;
        if (bgA !== bgB) return bgA - bgB;
        return a.ingameName.localeCompare(b.ingameName);
    });

    sortedPlayers.forEach((player, index) => {
        map.set(player.id, palette[index % palette.length]);
    });

    return map;
  }, [players, paletteStyle]);

  const getPlayerColor = (playerId: string | undefined | null) => {
    if (!playerId) return '#94a3b8'; // Slate 400
    return colorMap.get(playerId) || '#94a3b8';
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
