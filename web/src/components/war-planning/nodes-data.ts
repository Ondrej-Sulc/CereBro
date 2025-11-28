export interface WarNodePosition {
  id: number | string; // Changed to string | number to allow 'portal-1' etc.
  x: number;
  y: number;
  paths: (number | string)[];
  isPortal?: boolean; // Flag for visual distinction
  label?: string; // Optional label if different from ID
}

// Helper to create portals
const createPortal = (id: string, x: number, y: number, paths: (number | string)[]): WarNodePosition => ({
  id, x, y, paths, isPortal: true, label: ""
});

// CONSTANTS for Dynamic Layout
const CANVAS_WIDTH = 1200; // Increased canvas width
const CANVAS_HEIGHT = 900; // Increased canvas height
const CENTER_X = CANVAS_WIDTH / 2;
const Y_START = CANVAS_HEIGHT - 100; // Start higher up
const Y_STEP = 120; // Vertical spacing between node rows
const Y_PORTAL_OFFSET = 60; // Vertical offset for portals
const NODE_H_SPACING = 120; // Horizontal spacing within a group of 3 nodes
const GROUP_H_SPACING = 420; // Horizontal spacing between Left-Center-Right groups

// Base Y coordinates for rows
const Y_ROW1 = Y_START;
const Y_ROW2 = Y_START - Y_STEP;
const Y_ROW3 = Y_START - (Y_STEP * 2.5);
const Y_ROW4 = Y_START - (Y_STEP * 3.5);

// Y coordinates for Islands
const Y_ISLANDS_LEFT   = Y_START - (Y_STEP * 5.5);
const Y_ISLANDS_CENTER = Y_START - (Y_STEP * 6);
const Y_ISLANDS_RIGHT  = Y_START - (Y_STEP * 5.0);

const Y_FINAL_JUNCTION_PORTAL = Y_START - (Y_STEP * 7);
const Y_MINI_BOSSES = Y_START - (Y_STEP * 7.5); // 46, 47
const Y_PRE_BOSSES = Y_START - (Y_STEP * 8.5); // 48, 49
const Y_BOSS_NODE = Y_START - (Y_STEP * 9.0); // 50

export const warNodesData: WarNodePosition[] = [
  // --- Section 1 (Bottom) ---
  
  // Start Portals
  createPortal("portal-s1-start-left", CENTER_X - GROUP_H_SPACING, Y_ROW1 + Y_PORTAL_OFFSET, [1, 2, 3]),
  createPortal("portal-s1-start-center", CENTER_X, Y_ROW1 + Y_PORTAL_OFFSET, [4, 5, 6]),
  createPortal("portal-s1-start-right", CENTER_X + GROUP_H_SPACING, Y_ROW1 + Y_PORTAL_OFFSET, [7, 8, 9]),

  // Row 1 (Nodes 1-9) - Horizontal layout within groups, spaced by GROUP_H_SPACING
  { id: 1, x: CENTER_X - GROUP_H_SPACING - NODE_H_SPACING, y: Y_ROW1, paths: [10] },
  { id: 2, x: CENTER_X - GROUP_H_SPACING,                  y: Y_ROW1, paths: [11] },
  { id: 3, x: CENTER_X - GROUP_H_SPACING + NODE_H_SPACING, y: Y_ROW1, paths: [12] },
  
  { id: 4, x: CENTER_X - NODE_H_SPACING, y: Y_ROW1, paths: [13] },
  { id: 5, x: CENTER_X,                  y: Y_ROW1, paths: [14] },
  { id: 6, x: CENTER_X + NODE_H_SPACING, y: Y_ROW1, paths: [15] },

  { id: 7, x: CENTER_X + GROUP_H_SPACING - NODE_H_SPACING, y: Y_ROW1, paths: [16] },
  { id: 8, x: CENTER_X + GROUP_H_SPACING,                  y: Y_ROW1, paths: [17] },
  { id: 9, x: CENTER_X + GROUP_H_SPACING + NODE_H_SPACING, y: Y_ROW1, paths: [18] },

  // Row 2 (Nodes 10-18)
  { id: 10, x: CENTER_X - GROUP_H_SPACING - NODE_H_SPACING, y: Y_ROW2, paths: ["portal-s1-end-left"] },
  { id: 11, x: CENTER_X - GROUP_H_SPACING,                  y: Y_ROW2, paths: ["portal-s1-end-left"] },
  { id: 12, x: CENTER_X - GROUP_H_SPACING + NODE_H_SPACING, y: Y_ROW2, paths: ["portal-s1-end-left"] },

  { id: 13, x: CENTER_X - NODE_H_SPACING, y: Y_ROW2, paths: ["portal-s1-end-center"] },
  { id: 14, x: CENTER_X,                  y: Y_ROW2, paths: ["portal-s1-end-center"] },
  { id: 15, x: CENTER_X + NODE_H_SPACING, y: Y_ROW2, paths: ["portal-s1-end-center"] },

  { id: 16, x: CENTER_X + GROUP_H_SPACING - NODE_H_SPACING, y: Y_ROW2, paths: ["portal-s1-end-right"] },
  { id: 17, x: CENTER_X + GROUP_H_SPACING,                  y: Y_ROW2, paths: ["portal-s1-end-right"] },
  { id: 18, x: CENTER_X + GROUP_H_SPACING + NODE_H_SPACING, y: Y_ROW2, paths: ["portal-s1-end-right"] },

  // S1 End Portals
  createPortal("portal-s1-end-left", CENTER_X - GROUP_H_SPACING, Y_ROW2 - Y_PORTAL_OFFSET, []), 
  createPortal("portal-s1-end-center", CENTER_X, Y_ROW2 - Y_PORTAL_OFFSET, []),
  createPortal("portal-s1-end-right", CENTER_X + GROUP_H_SPACING, Y_ROW2 - Y_PORTAL_OFFSET, []),

  // --- Section 2 ---
  // S2 Start Portals
  createPortal("portal-s2-start-left", CENTER_X - GROUP_H_SPACING, Y_ROW3 + Y_PORTAL_OFFSET, [19, 20, 21]),
  createPortal("portal-s2-start-center", CENTER_X, Y_ROW3 + Y_PORTAL_OFFSET, [22, 23, 24]),
  createPortal("portal-s2-start-right", CENTER_X + GROUP_H_SPACING, Y_ROW3 + Y_PORTAL_OFFSET, [25, 26, 27]), 

  // Row 3 (Nodes 19-27)
  { id: 19, x: CENTER_X - GROUP_H_SPACING - NODE_H_SPACING, y: Y_ROW3, paths: [28] },
  { id: 20, x: CENTER_X - GROUP_H_SPACING,                  y: Y_ROW3, paths: [29] },
  { id: 21, x: CENTER_X - GROUP_H_SPACING + NODE_H_SPACING, y: Y_ROW3, paths: [30] },

  { id: 22, x: CENTER_X - NODE_H_SPACING, y: Y_ROW3, paths: [31] },
  { id: 23, x: CENTER_X,                  y: Y_ROW3, paths: [32] },
  { id: 24, x: CENTER_X + NODE_H_SPACING, y: Y_ROW3, paths: [33] },

  { id: 25, x: CENTER_X + GROUP_H_SPACING - NODE_H_SPACING, y: Y_ROW3, paths: [34] },
  { id: 26, x: CENTER_X + GROUP_H_SPACING,                  y: Y_ROW3, paths: [35] },
  { id: 27, x: CENTER_X + GROUP_H_SPACING + NODE_H_SPACING, y: Y_ROW3, paths: [36] },

  // Row 4 (Nodes 28-36)
  { id: 28, x: CENTER_X - GROUP_H_SPACING - NODE_H_SPACING, y: Y_ROW4, paths: ["portal-s2-end-left"] },
  { id: 29, x: CENTER_X - GROUP_H_SPACING,                  y: Y_ROW4, paths: ["portal-s2-end-left"] },
  { id: 30, x: CENTER_X - GROUP_H_SPACING + NODE_H_SPACING, y: Y_ROW4, paths: ["portal-s2-end-left"] },

  { id: 31, x: CENTER_X - NODE_H_SPACING, y: Y_ROW4, paths: ["portal-s2-end-center"] },
  { id: 32, x: CENTER_X,                  y: Y_ROW4, paths: ["portal-s2-end-center"] },
  { id: 33, x: CENTER_X + NODE_H_SPACING, y: Y_ROW4, paths: ["portal-s2-end-center"] },

  { id: 34, x: CENTER_X + GROUP_H_SPACING - NODE_H_SPACING, y: Y_ROW4, paths: ["portal-s2-end-right"] },
  { id: 35, x: CENTER_X + GROUP_H_SPACING,                  y: Y_ROW4, paths: ["portal-s2-end-right"] },
  { id: 36, x: CENTER_X + GROUP_H_SPACING + NODE_H_SPACING, y: Y_ROW4, paths: ["portal-s2-end-right"] },

  // S2 End Portals
  createPortal("portal-s2-end-left", CENTER_X - GROUP_H_SPACING, Y_ROW4 - Y_PORTAL_OFFSET, []),
  createPortal("portal-s2-end-center", CENTER_X, Y_ROW4 - Y_PORTAL_OFFSET, []),
  createPortal("portal-s2-end-right", CENTER_X + GROUP_H_SPACING, Y_ROW4 - Y_PORTAL_OFFSET, []),

  // --- Section 3 (Islands) ---

  // Island portals and nodes
  createPortal("portal-island-bottom-left", CENTER_X - GROUP_H_SPACING, Y_ISLANDS_LEFT + Y_PORTAL_OFFSET, [40, 41, 42]),
  createPortal("portal-island-bottom-center", CENTER_X, Y_ISLANDS_CENTER + Y_PORTAL_OFFSET, [43, 44, 45]),
  createPortal("portal-island-bottom-right", CENTER_X + GROUP_H_SPACING, Y_ISLANDS_RIGHT + Y_PORTAL_OFFSET, [37, 38, 39]),

  // Left Island (40-42) - Highest (lowest Y)
  { id: 40, x: CENTER_X - GROUP_H_SPACING - NODE_H_SPACING, y: Y_ISLANDS_LEFT, paths: ["portal-island-top-left"] },
  { id: 41, x: CENTER_X - GROUP_H_SPACING,                  y: Y_ISLANDS_LEFT, paths: ["portal-island-top-left"] },
  { id: 42, x: CENTER_X - GROUP_H_SPACING + NODE_H_SPACING, y: Y_ISLANDS_LEFT, paths: ["portal-island-top-left"] },

  // Center Island (43-45) - Middle Y
  { id: 43, x: CENTER_X - NODE_H_SPACING, y: Y_ISLANDS_CENTER, paths: ["portal-island-top-center"] },
  { id: 44, x: CENTER_X,                  y: Y_ISLANDS_CENTER, paths: ["portal-island-top-center"] },
  { id: 45, x: CENTER_X + NODE_H_SPACING, y: Y_ISLANDS_CENTER, paths: ["portal-island-top-center"] },

  // Right Island (37-39) - Lowest (highest Y)
  { id: 37, x: CENTER_X + GROUP_H_SPACING - NODE_H_SPACING, y: Y_ISLANDS_RIGHT, paths: ["portal-island-top-right"] },
  { id: 38, x: CENTER_X + GROUP_H_SPACING,                  y: Y_ISLANDS_RIGHT, paths: ["portal-island-top-right"] },
  { id: 39, x: CENTER_X + GROUP_H_SPACING + NODE_H_SPACING, y: Y_ISLANDS_RIGHT, paths: ["portal-island-top-right"] },

  // Boss Portals (Converging to final junction)
  createPortal("portal-island-top-left",   CENTER_X - GROUP_H_SPACING, Y_ISLANDS_LEFT - Y_PORTAL_OFFSET, []),
  createPortal("portal-island-top-center", CENTER_X, Y_ISLANDS_CENTER - Y_PORTAL_OFFSET, []),
  createPortal("portal-island-top-right",  CENTER_X + GROUP_H_SPACING, Y_ISLANDS_RIGHT - Y_PORTAL_OFFSET, []),

  // Final Junction Portal
  createPortal("portal-final-junction", CENTER_X, Y_FINAL_JUNCTION_PORTAL, [46, 47]),

  // --- Top Section (Mini-Bosses & Boss) ---
  // Nodes 46, 47 (Mini-Bosses) - Directly under 48, 49 in X, but higher Y
  { id: 46, x: CENTER_X - NODE_H_SPACING, y: Y_MINI_BOSSES, paths: [48] },
  { id: 47, x: CENTER_X + NODE_H_SPACING, y: Y_MINI_BOSSES, paths: [49] },
  
  // Nodes 48, 49 (Pre-Bosses) - Directly under 50 in X, but higher Y
  { id: 48, x: CENTER_X - NODE_H_SPACING, y: Y_PRE_BOSSES, paths: [50] },
  { id: 49, x: CENTER_X + NODE_H_SPACING, y: Y_PRE_BOSSES, paths: [50] },

  // Node 50 (Final Boss)
  { id: 50, x: CENTER_X, y: Y_BOSS_NODE, paths: [] }
];