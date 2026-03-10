# Features & Domain Context

## Discord Bot Features

### Champion Information & Management
*   **Info Queries:** Users can query for detailed champion info (abilities, attacks, immunities).
*   **Administration:** Powerful admin commands to add or update champions in the database.
*   **Duel Targets:** Community-sourced duel target list with an admin review workflow (`/admin duel review`) and status tracking (`ACTIVE`, `SUGGESTED`, `OUTDATED`, `ARCHIVED`).

### AI-Powered Translation
*   **Trigger:** Users react to messages with country flag emojis (e.g., 🇺🇸, 🇫🇷).
*   **Engine:** Uses OpenRouter (LLMs) with MCOC-specific context awareness to preserve game terminology (e.g., "Parry", "Dex").
*   **Conversational:** Fetches referenced messages (replies) to provide context for short strings.
*   **Output:** Rich embeds with original/translated text, deep links, and user attribution.

### Alliance & Roster Management
*   **Multi-Alliance Support:** Multiple `Alliance` records can be hosted within a single Discord server. Users can choose which alliance to join or configure via interactive UI menus.
*   **Prestige Tracking:** Users can update/view prestige; system supports hypothetical simulations.
*   **AQ Management:** Tools for managing Alliance Quest assignments and schedules.
*   **Scheduling:** General purpose reminders and event scheduling.
*   **Automatic Guild Init:** Auto-initializes `Alliance` records when joining new servers.
*   **Role Sync:**
    *   `/setup`: Interactive wizard for configuring roles.
    *   Background jobs sync Discord roles to the database hourly.
    *   **Hybrid Support:** Optional `removeMissingMembers` flag (configurable via `/alliance config-roles`) allows hybrid alliances to keep members who are added via the web but don't have specific Discord roles.
    *   `/alliance manage`: Officer tools to remove/list members.

---

## Web Application Features

### War Planning System (The "War Room")
A unified suite of tools for managing Alliance War.

#### 1. Interactive Canvas Map
*   **Tech:** `react-konva` (HTML5 Canvas) for 60fps performance on all devices.
*   **Capabilities:** Native pinch-to-zoom, two-finger panning, layered architecture (static background vs. interactive nodes).
*   **Layouts:** Supports multiple map types (e.g., `STANDARD`, `BIG_THING`).
*   **Visuals:**
    *   **Class Rings:** Nodes glow with champion class colors.
    *   **Tactics:** Active season tactics (Sword/Shield icons) are visualized on nodes.
    *   **Player Colors:** Assignments are color-coded by player for easy differentiation.

#### 2. Strategy & Editing
*   **Unified Editor:** `EditWarDialog` allows editing metadata (Tier, Season, Opponent) and locking Map Types.
*   **Node Inspector:**
    *   **Virtualization:** Dropdowns (`ChampionCombobox`) use `react-virtuoso` for performance.
    *   **Smart Select:** Defense editor cross-references the selected player's roster to show "Smart Select" buttons (e.g., "7★ R3") for accurate tracking.
    *   **Conflict Detection:** When planning attacks, the editor warns if the selected attacker is already placed on defense in the **Active Defense Plan**.
    *   **Historical Data:** Shows matchup history, solos, deaths, and links to sample videos.
*   **Enhanced Player Overview:**
    *   **Assignment Tracking:** Real-time visual tracking of assigned attackers per player.
    *   **Context-Aware:** Adapts to the map type:
        *   **Standard Map:** Shows logic-based "Section/Path" assignments (e.g., `P1 / P9`).
        *   **Big Thing:** Shows specific assigned node numbers (e.g., `Node 5`).
*   **Defense Planner:**
    *   **Active Status:** Set a specific plan as "Active" to enable conflict checking during attack planning.
    *   **Filtering:** Supports Tier-based filtering of **Node Modifiers** so planners only see relevant rules.
*   **Search Tools:** Find specific champions across the alliance or view a player's top roster options.

#### 3. Plan Distribution (`/aw plan` or Web "Share")
*   **Workflow:** Officer creates plan in Web UI -> Distributes via Discord command or Web "Share" button.
*   **Targeting:** 
    *   **Direct:** Send to specific Battlegroup (BG1-3) or the entire alliance (Private Threads/DMs).
    *   **Custom Channel:** Share the "Overview Map" to any text channel in the Discord server (e.g., `#war-room`, `#general`).
*   **Async Job:** Uses `DISTRIBUTE_WAR_PLAN` job to send personalized private threads (or DMs) to members.
*   **Message Content:**
    *   **Visual Map:** Dynamic PNG generation (Pill style fights, Prefight highlighting).
    *   **Text:** Assignments list, notes, and specific "Pre-fights to Place" instructions.
    *   **Upload Button:** Direct link to generate an upload session token.
*   **Channel Config:** Admins can route plans to specific BG channels (`/alliance config-channels`).

#### 4. Defense Plan Distribution (`/aw defense-plan` or Web "Share")
*   **Workflow:** Officer creates defense placement in Web UI -> Distributes via Discord command or Web "Share" button.
*   **Targeting:** Share specific Battlegroup layouts or all at once to configured channels, or share an "Overview Map" to any **Custom Channel**.
*   **Output:** Sends a high-quality "Overview Map" image to the respective Battlegroup channels or the selected custom channel.
*   **Content:**
    *   **Visual Map:** Full defense map with champion avatars, assigned player colors, and Tactic indicators.
    *   **Links:** Direct link back to the full interactive plan on the website.

### War Video Archive
*   **Data Model:** `War` -> `WarFight` -> `WarVideo`.
*   **Plan-to-Upload:**
    1.  User clicks "Upload Video" in Discord DM.
    2.  Receives temporary session token.
    3.  Web UI pre-fills the upload form with their assigned fights.
    4.  Uploads (or YouTube links) are linked to specific fights.
*   **Search:** Advanced filters for Attacker, Defender, Node, Season, and "Has Video".
*   **Notifications:** Uploads trigger `NOTIFY_WAR_VIDEO` jobs to post rich embeds in the alliance's video channel.

### Season Overview & Analytics
*   **Dashboard:** `/analysis/season-overview` tracks performance across the season.
*   **Unified Roster Table:** A compact, high-density view ranking all players across the alliance by performance (Deaths ascending, Fights descending).
*   **Detailed Breakdown:**
    *   **Categorization:** Tracks "Fights / Deaths" separately for **Path**, **Mini-Boss**, and **Boss** nodes.
    *   **Battlegroup Intelligence:** Integrated dashboard header for each BG showing Efficiency, Total Deaths, and Player counts.
    *   **Death Distribution:** Visual breakdown of Path/Mini-Boss/Boss deaths integrated into the Global Performance card.
*   **Mobile Experience:** Fully responsive layout that switches to detailed "Player Cards" on mobile devices, ensuring all stats are accessible without scrolling.
*   **Deep Dive:**
    *   **Defense:** Analyze performance by Node (lethality) or Defender (placement history).
    *   **Matchups:** Analyze Attacker success rates and find "Best Counters".

### Quest Planning & Roster Integration
A dedicated system for planning fights across complex quests (e.g., Story content, Everest runs).
*   **Data Model:** `QuestCategory` -> `QuestPlan` -> `QuestEncounter` -> `QuestEncounterNode`.
*   **Admin Builder (`/admin/quests`):**
    *   **Quest Creation:** Define paths, add sequence steps, and specify defenders via `ChampionCombobox`.
    *   **Visibility System:** Supports `DRAFT` (hidden), `VISIBLE` (alliance-wide), and `ARCHIVED` states.
    *   **Creator Attribution:** Support for multiple creators per quest, displaying real Discord names and avatars via `AsyncBotUserCombobox`.
    *   **Cinematic Banners:** Support for GCS-backed banner assets with Fit/Position controls and automated dark text overlays.
    *   **Restrictions:** Configure quest-wide or encounter-specific restrictions like Min/Max Star levels, Class, and Tag requirements using interactive UI tools (`MultiTagCombobox`).
    *   **Recommendations & Tips:** Provide Markdown-supported tips, recommend specific champions, and map active `NodeModifier`s to encounters.
    *   **At-a-Glance Metrics:** Admin dashboard overhauls showing encounter counts, team limits, and star requirements per plan.
*   **Player Timeline (`/planning/quests/[id]`):**
    *   **Tactical Path:** A high-end vertical timeline with cinematic "VS" indicators, thematic color-coding (Defender Red vs. Counter Sky), and dedicated "Quest Start" and "Boss" nodes.
    *   **Advanced Roster Filtering:** Integrated Ability, Category, and Immunity filters within the timeline selection grid to find perfect counters.
    *   **Requirement Transparency:** Explicitly displays Quest and Fight requirements as read-only badges in the filter list.
    *   **Team Limit Enforcement:** Automatic enforcement of quest-specific team limits with real-time feedback and an expandable "Current Team Plan" overview showing assigned defenders.
    *   **Counter Selection:** Players simply click a valid champion from their roster to assign them to an encounter, saving their plan dynamically across sessions via `PlayerQuestEncounter`.
    *   **Highlights:** Automatically highlights champions matching the administrative "Recommended Tags" or "Recommended Champions" for quick, intelligent selection.

### Profile & Roster Manager
*   **Profile:** Switch/create/delete multiple MCOC accounts per user.
*   **Roster Grid:** High-performance virtualized list of champions.
*   **Advanced Filters:**
    *   Filter by Ability, Immunity, Tag, Category.
    *   **Logic:** Toggle between **AND** (match all) and **OR** (match any).
*   **Prestige:**
    *   **Auto-Sync:** Updates profile prestige if calculated roster average > stored value.
    *   **Insights:** "Rank-up Opportunities" and "Sig Stone Budget" simulations.
*   **OCR:** Updates roster via screenshot processing.
    *   **BG View (New):** Supports "Battlegrounds Deck" screenshots (Attribute view).
        *   **Analysis:** Automatically detects **Stars, Rank, Ascension, Class, and Sig Level** using optimized pixel-level analysis.
        *   **Feedback:** Provides a grouped summary in Discord (e.g., "7★ R3: 4").
        *   **UX:** If many champions are detected (>40), the bot provides a direct link to the Web Roster for review instead of a long list, keeping the Discord channel clean.
    *   **Grid View:** Legacy support for "My Champions" grid screenshots.

### Alliance Management (Web)
*   **Roster Overview:** Spreadsheet-like view of the entire alliance's champions (`/alliance/roster`).
*   **Conflict Visuals:** Player lists show warning icons for champions that are currently placed on defense.
*   **Battlegroup Colors:** Customize BG identity colors (used in Discord maps and Web headers).
*   **Discord Linking:**
    *   Officers generate `CB-XXXXXX` code on web.
    *   Redeem via `/alliance link` in Discord to bridge the two platforms.

### Admin Portal & Data Management
A secure, web-based suite for managing core game data and system-wide alliance/player records.
*   **Access Control:** Strictly protected via RBAC. Only users with the `BotUser.isBotAdmin` flag can access the portal.
*   **Database Insights:** Real-time dashboard with key metrics (Total Players/Alliances, Affiliation rates) and high-performance visualizations of top-tier alliances and prestige leaders.
*   **Directory Management:**
    *   **Alliances:** Searchable, sortable, and paginated directory of all registered Discord servers.
    *   **Discord Servers:** Real-time monitoring of all servers the bot is connected to. Features include:
        *   **Member Tracking:** Displays approximate member counts to identify small/test servers.
        *   **Manual Leave:** Admins can trigger the bot to leave specific servers via the `LEAVE_GUILD` job queue.
        *   **Batch Cleanup:** One-click tool to leave all servers with 1 or fewer members, helping stay under the 100-server cap.
    *   **Players:** Comprehensive directory of all MCOC profiles with granular status and role indicators (Admin, Officer, Trusted).
*   **Enhanced Navigation:**
    *   **Collapsible Sidebar:** Admin sidebar can be collapsed to an icon-only view to maximize workspace area.
    *   **Logical Grouping:** Navigation items are organized into categories: Overview, Community, Game Data, War Config, and System.
    *   **Persistent State:** Sidebar state (collapsed/expanded) is persisted across sessions via `localStorage`.
*   **Alliance Maintenance:**
    *   **Automated Cleanup:** Background service `checkAndCleanupAlliance` automatically prunes "orphan" alliances (0 members) to prevent database bloat.
    *   **Manual Pruning:** Admin-only "Cleanup Orphans" tool for bulk removal of abandoned registrations.
    *   **Infrastructure Protection:** The `GLOBAL` mercenary alliance is exempt from all cleanup routines to support solo uploads and guest player infrastructure.
*   **System Debugging:**
    *   **Roster Debugger:** API-driven tool for troubleshooting OCR processing.
        Allows admins to upload screenshots and view the raw attribute extraction results and debug images in real-time with strict resource limits (max 10 files, 10 MB per file).

*   **Champion Management:**
    *   **Visual Grid:** Compact, high-density grid view of all champions with Class Filters and real-time search.
    *   **Unified Editor:** A powerful modal editor for managing all aspects of a champion:
        *   **Overview:** Edit metadata (Release Date, Obtainable Source) and verify asset integrity (Primary/Hero images).
        *   **Abilities:** Drag-and-drop style management of Ability/Immunity links. Features alphabetical sorting, grouping by name, and granular control over sources and synergies.
        *   **Attacks:** Visual editor for configuring hit counts and properties (Contact, Physical, Energy, Projectile). Grouped by Basic vs. Special attacks.
    *   **Synergy Mapping:** Deep linking of champions to specific abilities (e.g., "Havok" enhances "Plasma Buildup").