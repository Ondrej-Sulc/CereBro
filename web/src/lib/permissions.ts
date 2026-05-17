export const AVAILABLE_PERMISSIONS = [
  { id: "MANAGE_CHAMPIONS", label: "Manage Champions", description: "Can add/edit/delete champions." },
  { id: "MANAGE_QUESTS", label: "Manage Quests", description: "Can create and edit quest plans." },
  { id: "MANAGE_ALLIANCES", label: "Manage Alliances", description: "Can manage and cleanup alliance data." },
  { id: "MANAGE_WAR_CONFIG", label: "Manage War Config", description: "Can edit bans, nodes, tactics, and review war videos." },
  { id: "MANAGE_USERS", label: "Manage Users", description: "Can edit user profiles and permissions." },
  { id: "MANAGE_SYSTEM", label: "Manage System", description: "Can access debug tools and system tokens." },
  { id: "VIEW_INSIGHTS", label: "View Insights", description: "Can view global statistics and metrics." },
] as const;

export type Permission = typeof AVAILABLE_PERMISSIONS[number]["id"];
