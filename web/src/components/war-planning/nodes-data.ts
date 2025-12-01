export interface WarNodePosition {
  id: number | string;
  x: number;
  y: number;
  paths: (number | string)[];
  isPortal?: boolean;
  label?: string;
}

// --- Layout Configuration ---

export const LAYOUT = {
  WIDTH: 2800, // Doubled from 1400
  HEIGHT: 3200, // Doubled from 1600
  Y_START: 2300, // Adjusted to center vertically (1500 + 800)
  Y_STEP: 120,
  SPACING_NODE: 120,  
  SPACING_GROUP: 420, 
  OFFSET_PORTAL: 60,
};

const CENTER_X = LAYOUT.WIDTH / 2;
const GROUP_X = {
  LEFT: CENTER_X - LAYOUT.SPACING_GROUP,
  CENTER: CENTER_X,
  RIGHT: CENTER_X + LAYOUT.SPACING_GROUP,
};

// Y-Levels derived from base configuration
const Y = {
  ROW_1: LAYOUT.Y_START,
  ROW_2: LAYOUT.Y_START - LAYOUT.Y_STEP,
  ROW_3: LAYOUT.Y_START - (LAYOUT.Y_STEP * 2.5),
  ROW_4: LAYOUT.Y_START - (LAYOUT.Y_STEP * 3.5),
  
  // Islands have distinct Y levels
  ISLAND_LEFT:   LAYOUT.Y_START - (LAYOUT.Y_STEP * 5.5),
  ISLAND_CENTER: LAYOUT.Y_START - (LAYOUT.Y_STEP * 6.0),
  ISLAND_RIGHT:  LAYOUT.Y_START - (LAYOUT.Y_STEP * 5.0),

  FINAL_JUNCTION: LAYOUT.Y_START - (LAYOUT.Y_STEP * 7.0),
  MINI_BOSS:      LAYOUT.Y_START - (LAYOUT.Y_STEP * 7.5),
  PRE_BOSS:       LAYOUT.Y_START - (LAYOUT.Y_STEP * 8.5),
  BOSS:           LAYOUT.Y_START - (LAYOUT.Y_STEP * 9.0),
};

// --- Helper Functions ---

const createPortal = (
  id: string, 
  x: number, 
  y: number, 
  paths: (number | string)[] = []
): WarNodePosition => ({
  id, x, y, paths, isPortal: true, label: ""
});

/**
 * Creates a group of 3 nodes (Left, Center, Right) centered at groupX.
 * @param ids Array of 3 IDs for the nodes.
 * @param groupX X-coordinate of the group's center.
 * @param y Y-coordinate of the nodes.
 * @param targets Either a single target (string/number) for all, or an array of 3 targets.
 */
const createNodeTrio = (
  ids: [number, number, number],
  groupX: number,
  y: number,
  targets: (number | string)[] | (number | string)
): WarNodePosition[] => {
  return ids.map((id, i) => ({
    id,
    x: groupX + (i - 1) * LAYOUT.SPACING_NODE, // Offsets: -120, 0, +120
    y,
    paths: Array.isArray(targets) ? [targets[i]] : [targets]
  }));
};

// --- Data Definitions ---

export const warNodesData: WarNodePosition[] = [
  // === Section 1 ===
  
  // Start Portals
  createPortal("portal-s1-start-left",   GROUP_X.LEFT,   Y.ROW_1 + LAYOUT.OFFSET_PORTAL, [1, 2, 3]),
  createPortal("portal-s1-start-center", GROUP_X.CENTER, Y.ROW_1 + LAYOUT.OFFSET_PORTAL, [4, 5, 6]),
  createPortal("portal-s1-start-right",  GROUP_X.RIGHT,  Y.ROW_1 + LAYOUT.OFFSET_PORTAL, [7, 8, 9]),

  // Row 1 (Nodes 1-9)
  ...createNodeTrio([1, 2, 3], GROUP_X.LEFT,   Y.ROW_1, [10, 11, 12]),
  ...createNodeTrio([4, 5, 6], GROUP_X.CENTER, Y.ROW_1, [13, 14, 15]),
  ...createNodeTrio([7, 8, 9], GROUP_X.RIGHT,  Y.ROW_1, [16, 17, 18]),

  // Row 2 (Nodes 10-18) -> Connect to End Portals
  ...createNodeTrio([10, 11, 12], GROUP_X.LEFT,   Y.ROW_2, "portal-s1-end-left"),
  ...createNodeTrio([13, 14, 15], GROUP_X.CENTER, Y.ROW_2, "portal-s1-end-center"),
  ...createNodeTrio([16, 17, 18], GROUP_X.RIGHT,  Y.ROW_2, "portal-s1-end-right"),

  // End Portals
  createPortal("portal-s1-end-left",   GROUP_X.LEFT,   Y.ROW_2 - LAYOUT.OFFSET_PORTAL),
  createPortal("portal-s1-end-center", GROUP_X.CENTER, Y.ROW_2 - LAYOUT.OFFSET_PORTAL),
  createPortal("portal-s1-end-right",  GROUP_X.RIGHT,  Y.ROW_2 - LAYOUT.OFFSET_PORTAL),


  // === Section 2 ===

  // Start Portals
  createPortal("portal-s2-start-left",   GROUP_X.LEFT,   Y.ROW_3 + LAYOUT.OFFSET_PORTAL, [19, 20, 21]),
  createPortal("portal-s2-start-center", GROUP_X.CENTER, Y.ROW_3 + LAYOUT.OFFSET_PORTAL, [22, 23, 24]),
  createPortal("portal-s2-start-right",  GROUP_X.RIGHT,  Y.ROW_3 + LAYOUT.OFFSET_PORTAL, [25, 26, 27]),

  // Row 3 (Nodes 19-27)
  ...createNodeTrio([19, 20, 21], GROUP_X.LEFT,   Y.ROW_3, [28, 29, 30]),
  ...createNodeTrio([22, 23, 24], GROUP_X.CENTER, Y.ROW_3, [31, 32, 33]),
  ...createNodeTrio([25, 26, 27], GROUP_X.RIGHT,  Y.ROW_3, [34, 35, 36]),

  // Row 4 (Nodes 28-36) -> Connect to End Portals
  ...createNodeTrio([28, 29, 30], GROUP_X.LEFT,   Y.ROW_4, "portal-s2-end-left"),
  ...createNodeTrio([31, 32, 33], GROUP_X.CENTER, Y.ROW_4, "portal-s2-end-center"),
  ...createNodeTrio([34, 35, 36], GROUP_X.RIGHT,  Y.ROW_4, "portal-s2-end-right"),

  // End Portals
  createPortal("portal-s2-end-left",   GROUP_X.LEFT,   Y.ROW_4 - LAYOUT.OFFSET_PORTAL),
  createPortal("portal-s2-end-center", GROUP_X.CENTER, Y.ROW_4 - LAYOUT.OFFSET_PORTAL),
  createPortal("portal-s2-end-right",  GROUP_X.RIGHT,  Y.ROW_4 - LAYOUT.OFFSET_PORTAL),


  // === Section 3 (Islands) ===

  // Start Portals (Bottom of Islands)
  createPortal("portal-island-bottom-left",   GROUP_X.LEFT,   Y.ISLAND_LEFT   + LAYOUT.OFFSET_PORTAL, [40, 41, 42]),
  createPortal("portal-island-bottom-center", GROUP_X.CENTER, Y.ISLAND_CENTER + LAYOUT.OFFSET_PORTAL, [43, 44, 45]),
  createPortal("portal-island-bottom-right",  GROUP_X.RIGHT,  Y.ISLAND_RIGHT  + LAYOUT.OFFSET_PORTAL, [37, 38, 39]),

  // Island Nodes
  // Note: IDs and Targets are specific to each island
  ...createNodeTrio([40, 41, 42], GROUP_X.LEFT,   Y.ISLAND_LEFT,   "portal-island-top-left"),
  ...createNodeTrio([43, 44, 45], GROUP_X.CENTER, Y.ISLAND_CENTER, "portal-island-top-center"),
  ...createNodeTrio([37, 38, 39], GROUP_X.RIGHT,  Y.ISLAND_RIGHT,  "portal-island-top-right"),

  // End Portals (Top of Islands)
  createPortal("portal-island-top-left",   GROUP_X.LEFT,   Y.ISLAND_LEFT   - LAYOUT.OFFSET_PORTAL),
  createPortal("portal-island-top-center", GROUP_X.CENTER, Y.ISLAND_CENTER - LAYOUT.OFFSET_PORTAL),
  createPortal("portal-island-top-right",  GROUP_X.RIGHT,  Y.ISLAND_RIGHT  - LAYOUT.OFFSET_PORTAL),


  // === Boss Section ===

  // Final Junction Portal
  createPortal("portal-final-junction", CENTER_X, Y.FINAL_JUNCTION, [46, 47]),

  // Mini-Bosses (46, 47)
  { id: 46, x: CENTER_X - LAYOUT.SPACING_NODE, y: Y.MINI_BOSS, paths: [48] },
  { id: 47, x: CENTER_X + LAYOUT.SPACING_NODE, y: Y.MINI_BOSS, paths: [49] },

  // Pre-Bosses (48, 49)
  { id: 48, x: CENTER_X - LAYOUT.SPACING_NODE, y: Y.PRE_BOSS, paths: [50] },
  { id: 49, x: CENTER_X + LAYOUT.SPACING_NODE, y: Y.PRE_BOSS, paths: [50] },

  // Boss (50)
  { id: 50, x: CENTER_X, y: Y.BOSS, paths: [] },
];