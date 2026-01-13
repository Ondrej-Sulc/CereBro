# CereBro

> **The Operating System for Marvel Contest of Champions (MCOC) Alliances.**

CereBro is a full-stack platform designed to manage the complex logistics of top-tier MCOC alliances. It combines a sophisticated **Discord Bot** for daily interactions with a high-performance **Next.js Web Application** for deep planning and visual management.

*Disclaimer: This project is an unofficial tool and is not affiliated with Kabam or Marvel.*

---

## 🏗️ System Architecture

The project is structured as a **TypeScript Monorepo** managing two primary services backed by a shared PostgreSQL database.

### 1. The Web Application (`/web`)
A modern interface built for complex visualization and management tasks.
*   **Framework:** Next.js (App Router), React, Tailwind CSS, shadcn/ui.
*   **Authentication:** NextAuth.js (Discord OAuth2) with role-based access control linked to in-game alliance hierarchy.
*   **Key Engineering Features:**
    *   **Interactive War Planner:** A **Canvas-based map (react-konva)** capable of rendering 60fps animations on mobile devices. **Features role-based access control where all alliance members can view live plans, while editing is restricted to Officers and Bot Admins.**
    *   **Performance:** Implements **virtualized lists (react-virtuoso)** to handle heavy roster rendering without DOM thrashing. **Utilizes server-side in-memory caching for static data (like champions) to significantly reduce database load and improve response times.**
    *   **Real-time Collab:** Optimistic UI updates with polling synchronization to allow multiple officers to plan wars simultaneously.
    *   **Video Archive:** A searchable media library for Alliance War videos, linked directly to specific fights and nodes.
    *   **Resilient Deployment:** Features an automated version-checking system that proactively alerts connected clients when a new server version is deployed, preventing Server Action mismatches.
    *   **Optimized Visuals:** Features an interactive **Lightbox Gallery** for screenshots and performance-tuned background animations (`IntersectionObserver`-controlled canvas) to maintain high frame rates on landing pages.

### 2. The Discord Bot (`/src`)
Handles high-frequency user interactions, notifications, and quick data lookups.
*   **Framework:** Discord.js v14.
*   **Architecture:**
    *   **Controller/View Pattern:** Interactive commands (like `/champion`) separate logic (Controllers) from presentation strings (Views) to support complex, multi-step "re-render" workflows.
    *   **Dynamic Command Loading:** Automated registration of tiered commands (Public, User, Admin, Feature).
    *   **Single Source of Truth:** Command documentation is defined in code and auto-generated into JSON for both the `/help` command and the Website's documentation.

### 3. Shared Services & Infrastructure
*   **Database:** PostgreSQL managed via **Prisma ORM**.
*   **Async Job Queue:** A database-backed task system (`BotJob`) that decouples the Web App from the Bot. This allows the Web App to trigger complex Discord actions (like notifications or distributing war plans) reliability without direct network coupling.
*   **Image Processing Pipeline:** Google Vision API integration for extracting champion data from user-uploaded screenshots.
*   **Smart Import:** Users can upload screenshots of their game roster. The system uses image processing to identify champions, star levels, ranks, and ascension status, syncing the data to the central DB.
*   **AI Integration:** OpenRouter (LLMs) used for drafting glossary terms and parsing complex abilities.
*   **Analytics:** Deep integration with **PostHog** for feature usage tracking and error analysis.

---

## 🚀 Key Feature Modules

### ⚔️ Alliance War Command Center
The flagship feature of the platform.
*   **Planning:** Supports multiple map layouts (`Standard` & `Big Thing`). Features pinch-to-zoom, node-specific tactic visualizers, and visual layout management.
*   **Defense Strategy:** Dedicated planner for managing season-long defense placements across multiple battlegroups. Features **Tier-aware Node Modifiers** and **Smart Roster Integration** that automatically suggests the correct champion version (Rank/Ascension) from the assigned player's profile.
*   **Execution:** Now database-driven. Plans generated in the Web UI or via the `/aw plan` command can be distributed to players' private Discord threads. Messages feature rich header context (Season, Tier, Opponent), **per-battlegroup Overview Maps**, and **dynamically generated high-fidelity player maps** that visually highlight assignments and active tactic badges (Sword/Shield).
*   **Analysis:** 
    *   **Season Overview:** A new dashboard (`/analysis/season-overview`) aggregating performance metrics across entire war seasons. Features "Deadliest Defenders", "Top Attackers", and "Hardest Nodes" leaderboards with class-aware highlighting.
    *   **Video Archive:** "Plan-to-Upload" workflow generates unique tokens for players to upload war videos, automatically linking them to their specific node assignment.
*   **Smart Notifications:** Automatically posts rich embeds to a configured Discord channel whenever a new war video is uploaded or linked, keeping the alliance in the loop.

### 👤 Roster & Identity
*   **Web Roster Manager:** A dedicated, high-performance interface (`/profile/roster`) for viewing and managing champion rosters. Features a **virtualized grid** capable of rendering hundreds of champions smoothly, advanced class/rank filtering, and a modern card-based design with class-specific tinting.
*   **Interactive Editor:** Users can manually edit champion details (**Signature Level**, Rank, Awakening, Ascension, Power Rating) or delete entries directly from the web grid via a modal editor.
*   **Prestige & Simulation:** Calculates **Top 30 Prestige** averages and provides **Rank-up Recommendations** with real-time prestige simulation.
    *   **Budget Optimizer:** A "Stone Budget" tool uses a greedy algorithm to simulate the optimal allocation of signature stones to maximize account prestige.
    *   **Efficiency Metrics:** Displays the "Champion Prestige Gain per Sig Stone" to help users identify the most efficient investments.
    *   **Interactive Visualizations:** Clicking on a recommendation opens a detailed **Prestige Curve Chart**, visualizing the champion's prestige growth across all signature levels.
*   **Smart Import:** Users can upload screenshots of their game roster. The system uses image processing to identify champions, star levels, ranks, and ascension status, syncing the data to the central DB.
*   **Profile Analysis:** The main profile view now includes a detailed, table-based breakdown of the roster by Rank and Class for each Star level, alongside Prestige history and timezone management.

### 🧠 Knowledge Base
*   **Champion Search:** Powerful filtering by immunities, tags, and ability mechanics. Supported by a comprehensive glossary for deep effect lookups.
*   **Champion Prestige Data:** Maintains a normalized, high-performance database of prestige values across all rarities, ranks, and signature levels.
*   **Community Data:** Crowdsourced Duel Targets with an admin review queue system.

### 🌐 AI & Utilities
*   **AI Translation:** React with a flag emoji to translate any message. Uses LLMs to maintain game-specific context and terminology.

### 🛡️ Alliance Operations
*   **Web Management:** A dedicated dashboard (`/alliance`) for Officers to manage member rosters and battlegroup assignments.
    *   **Auto-Sync:** Changes made on the web automatically update Discord roles via a background job queue.
    *   **Custom Identity:** Customize Battlegroup colors to theming Web UI maps and Discord plan messages.
    *   **Roster Explorer:** A dense, spreadsheet-style view (`/alliance/roster`) for filtering the entire alliance's champions. Now features **Advanced Logic Filters (AND/OR)** for Tags, Abilities, and Immunities. Clicking a champion reveals detailed source information, including specific synergies and ability origins.
*   **Role Sync:** Automatically maps Discord Roles to Database permissions (Officer, Battlegroup 1-3).
*   **Channel Configuration:** Customizable Discord channels for specific battlegroup plans and general war video notifications.
*   **AQ Management:** Scheduling and tracking for Alliance Quest timers.

---

## 🛠️ Technology Stack

| Category | Technologies |
| :--- | :--- |
| **Core** | TypeScript (Strict), Node.js v18+ |
| **Frontend** | Next.js 15, React, Tailwind CSS, Konva (Canvas) |
| **Bot Framework** | Discord.js v14 |
| **Data** | PostgreSQL, Prisma, Redis (Caching) |
| **Cloud/API** | Google Cloud Storage, Google Vision API, OpenRouter |
| **DevOps** | Docker, Docker Compose, Railway (Hosting) |

---

## 🚀 Deployment

CereBro is fully hosted on [Railway](https://railway.app/). This includes the PostgreSQL database, the Discord Bot service, and the Next.js Web Application. A continuous deployment pipeline is configured to automatically deploy updates to the `main` branch.

---

## 💻 Local Development

The project is fully containerized. You can spin up the entire stack (Bot + Web + DB) with a single command.

### Prerequisites
*   Docker & Docker Compose
*   Node.js v18+ (for local tooling)
*   Discord Bot Token & Client Secret



### Directory Structure

```
CereBro/
├── prisma/             # Database Schema & Migrations
├── src/                # Discord Bot Application
│   ├── commands/       # Slash Command modules
│   ├── services/       # External API integrations (OpenAI, Google, etc.)
│   └── utils/          # Shared helpers
├── web/                # Next.js Web Application
│   ├── src/app/        # App Router pages
│   └── src/components/ # UI Components (shadcn/ui)
└── docker-compose.yaml # Orchestration
```

---

## 📄 Documentation

Documentation for individual commands is auto-generated from the source code.
*   **In-Discord:** Run `/help` to see an interactive guide.
*   **Web:** Visit the `/commands` page on the deployed web interface.

---

*Built with ❤️ for the MCOC Community.*