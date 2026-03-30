
export interface PathInfo {
  section: number;
  path: number;
}

export type NodeCategory = 'path' | 'mini-boss' | 'boss';

/**
 * Determines the Section and Path for a given node number on the Standard War Map.
 * 
 * Logic:
 * - Section 1: Nodes 1-18 (Rows 1 & 2). 9 Paths.
 * - Section 2: Nodes 19-36 (Rows 3 & 4). 9 Paths.
 * 
 * Path is calculated by column (1-9).
 */
export function getPathInfo(nodeNumber: number): PathInfo | null {
  // Section 1: Nodes 1-18
  if (nodeNumber >= 1 && nodeNumber <= 18) {
    return {
      section: 1,
      path: (nodeNumber - 1) % 9 + 1
    };
  }

  // Section 2: Nodes 19-36
  if (nodeNumber >= 19 && nodeNumber <= 36) {
    return {
      section: 2,
      path: (nodeNumber - 19) % 9 + 1
    };
  }

  return null;
}

/**
 * Categorizes a node based on the Standard War Map structure.
 * 
 * - Path: Nodes 1-36 (Section 1 & 2)
 * - Boss: Node 50
 * - Mini-Boss: All others (37-49, includes Section 3 Islands, Mini-Bosses, Pre-Bosses)
 */
export function getNodeCategory(nodeNumber: number): NodeCategory {
  if (nodeNumber === 50) return 'boss';
  if (nodeNumber >= 1 && nodeNumber <= 36) return 'path';
  return 'mini-boss';
}

/**
 * Returns a prestige multiplier for rating calculations based on node type.
 * Rewards players for taking on higher-stakes fights.
 *
 * - Path (1-36): 1.0
 * - Island (37-45): 1.15
 * - Pre-boss (46-49): 1.3
 * - Boss (50): 1.5
 */
export function getNodeTypeMultiplier(nodeNumber: number): number {
  if (nodeNumber === 50) return 1.5;
  if (nodeNumber >= 46 && nodeNumber <= 49) return 1.3;
  if (nodeNumber >= 37 && nodeNumber <= 45) return 1.15;
  return 1.0;
}

/**
 * Returns a human-readable label for a node's logical assignment.
 * e.g., "S1 P5", "Mini-Boss", "Boss"
 */
export function getPathLabel(nodeNumber: number): string {
  const category = getNodeCategory(nodeNumber);
  
  if (category === 'boss') return 'Boss';
  
  const info = getPathInfo(nodeNumber);
  if (info) return `S${info.section} P${info.path}`;

  // Mini-boss islands
  if (nodeNumber >= 40 && nodeNumber <= 42) return 'Island L';
  if (nodeNumber >= 43 && nodeNumber <= 45) return 'Island C';
  if (nodeNumber >= 37 && nodeNumber <= 39) return 'Island R';
  
  // Final section
  if (nodeNumber === 46 || nodeNumber === 48) return 'Final L';
  if (nodeNumber === 47 || nodeNumber === 49) return 'Final R';

  return 'Mini-Boss';
}

/**
 * Defines the restriction groups for the Standard War Map.
 */
export const MAP_RESTRICTIONS = {
  SECTION_1: {
    exclusive: true,
    groups: Array.from({ length: 9 }, (_, i) => [i + 1, i + 10])
  },
  SECTION_2: {
    exclusive: true,
    groups: Array.from({ length: 9 }, (_, i) => [i + 19, i + 28])
  },
  SECTION_3_ISLANDS: {
    maxPerGroup: 1,
    groups: [
      [40, 41, 42], // Left
      [43, 44, 45], // Center
      [37, 38, 39]  // Right
    ]
  },
  FINAL_SECTION: {
    exclusive: true,
    groups: [
      [46, 48], // Left
      [47, 49]  // Right
    ]
  }
};

/**
 * Checks if adding a node to a player's current assignments violates any map restrictions.
 * @returns { valid: boolean, message?: string }
 */
export function validateNodeAssignment(nodeNumber: number, existingNodes: number[]): { valid: boolean, message?: string } {
  // 1. Check Section 1 (Exclusive Path)
  const s1Groups = MAP_RESTRICTIONS.SECTION_1.groups;
  const newNodeS1GroupIndex = s1Groups.findIndex(g => g.includes(nodeNumber));
  if (newNodeS1GroupIndex !== -1) {
    for (const existingNode of existingNodes) {
      const existingGroupIndex = s1Groups.findIndex(g => g.includes(existingNode));
      if (existingGroupIndex !== -1 && existingGroupIndex !== newNodeS1GroupIndex) {
        return { 
          valid: false, 
          message: `Player is already assigned to Path ${existingGroupIndex + 1} in Section 1 (Node ${existingNode}), and cannot take Node ${nodeNumber} on Path ${newNodeS1GroupIndex + 1}.` 
        };
      }
    }
  }

  // 2. Check Section 2 (Exclusive Path)
  const s2Groups = MAP_RESTRICTIONS.SECTION_2.groups;
  const newNodeS2GroupIndex = s2Groups.findIndex(g => g.includes(nodeNumber));
  if (newNodeS2GroupIndex !== -1) {
    for (const existingNode of existingNodes) {
      const existingGroupIndex = s2Groups.findIndex(g => g.includes(existingNode));
      if (existingGroupIndex !== -1 && existingGroupIndex !== newNodeS2GroupIndex) {
        return { 
          valid: false, 
          message: `Player is already assigned to Path ${existingGroupIndex + 1} in Section 2 (Node ${existingNode}), and cannot take Node ${nodeNumber} on Path ${newNodeS2GroupIndex + 1}.` 
        };
      }
    }
  }

  // 3. Check Section 3 Islands (Max 1 per group)
  for (const group of MAP_RESTRICTIONS.SECTION_3_ISLANDS.groups) {
    if (group.includes(nodeNumber)) {
      const conflictingIslandNode = existingNodes.find(n => group.includes(n));
      if (conflictingIslandNode) {
        return { 
          valid: false, 
          message: `Player can only take ONE fight in this island group. They are already assigned to Node ${conflictingIslandNode}.` 
        };
      }
    }
  }

  // 4. Check Final Section (Exclusive Side)
  const finalGroups = MAP_RESTRICTIONS.FINAL_SECTION.groups;
  const newNodeFinalGroupIndex = finalGroups.findIndex(g => g.includes(nodeNumber));
  if (newNodeFinalGroupIndex !== -1) {
    for (const existingNode of existingNodes) {
      const existingGroupIndex = finalGroups.findIndex(g => g.includes(existingNode));
      if (existingGroupIndex !== -1 && existingGroupIndex !== newNodeFinalGroupIndex) {
        const existingSide = existingGroupIndex === 0 ? "Left" : "Right";
        const newSide = newNodeFinalGroupIndex === 0 ? "Left" : "Right";
        return { 
          valid: false, 
          message: `Player is already assigned to the ${existingSide} side of the Final Island (Node ${existingNode}), and cannot take Node ${nodeNumber} on the ${newSide} side.` 
        };
      }
    }
  }

  return { valid: true };
}
