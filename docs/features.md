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
*   **Prestige Tracking:** Users can update/view prestige; system supports hypothetical simulations.
*   **AQ Management:** Tools for managing Alliance Quest assignments and schedules.
*   **Scheduling:** General purpose reminders and event scheduling.
*   **Automatic Guild Init:** Auto-initializes `Alliance` records when joining new servers.
*   **Role Sync:**
    *   `/setup`: Interactive wizard for configuring roles.
    *   Background jobs sync Discord roles to the database hourly.
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
    *   **Historical Data:** Shows matchup history, solos, deaths, and links to sample videos.
*   **Defense Planner:** Supports Tier-based filtering of **Node Modifiers** so planners only see relevant rules.
*   **Search Tools:** Find specific champions across the alliance or view a player's top roster options.

#### 3. Plan Distribution (`/aw plan`)
*   **Workflow:** Officer creates plan in Web UI -> Distributes via Discord command.
*   **Async Job:** Uses `DISTRIBUTE_WAR_PLAN` job to send personalized DMs to all members.
*   **Message Content:**
    *   **Visual Map:** Dynamic PNG generation (Pill style fights, Prefight highlighting).
    *   **Text:** Assignments list, notes, and specific "Pre-fights to Place" instructions.
    *   **Upload Button:** Direct link to generate an upload session token.
*   **Channel Config:** Admins can route plans to specific BG channels (`/alliance config-channels`).

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
*   **Metrics:**
    *   **Solo %:** Success rate calculation (vital for limited-fight maps).
    *   **Deaths:** Tracked per player and alliance-wide (including manual "Enemy Deaths" tracking).
*   **Deep Dive:**
    *   **Defense:** Analyze performance by Node (lethality) or Defender (placement history).
    *   **Matchups:** Analyze Attacker success rates and find "Best Counters".
*   **Visuals:** "Combat Report" aesthetic with class-colored rings and animated progress bars.

### Profile & Roster Manager
*   **Profile:** Switch/create/delete multiple MCOC accounts per user.
*   **Roster Grid:** High-performance virtualized list of champions.
*   **Advanced Filters:**
    *   Filter by Ability, Immunity, Tag, Category.
    *   **Logic:** Toggle between **AND** (match all) and **OR** (match any).
*   **Prestige:**
    *   **Auto-Sync:** Updates profile prestige if calculated roster average > stored value.
    *   **Insights:** "Rank-up Opportunities" and "Sig Stone Budget" simulations.
*   **OCR:** Updates roster via screenshot processing (shared logic with bot).

### Alliance Management (Web)
*   **Roster Overview:** Spreadsheet-like view of the entire alliance's champions (`/alliance/roster`).
*   **Battlegroup Colors:** Customize BG identity colors (used in Discord maps and Web headers).
*   **Discord Linking:**
    *   Officers generate `CB-XXXXXX` code on web.
    *   Redeem via `/alliance link` in Discord to bridge the two platforms.