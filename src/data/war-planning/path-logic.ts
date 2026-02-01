
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
 * Returns a human-readable label for a node's logical assignment.
 * e.g., "S1 P5", "Mini-Boss", "Boss"
 */
export function getPathLabel(nodeNumber: number): string {
  const category = getNodeCategory(nodeNumber);
  
  if (category === 'boss') return 'Boss';
  if (category === 'mini-boss') return 'Mini-Boss';
  
  const info = getPathInfo(nodeNumber);
  if (!info) return 'Unknown'; // Should not happen given category check
  
  return `S${info.section} P${info.path}`;
}
