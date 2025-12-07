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
    *   **Interactive War Planner:** A **Canvas-based map (react-konva)** capable of rendering 60fps animations on mobile devices.
    *   **Performance:** Implements **virtualized lists (react-virtuoso)** to handle heavy roster rendering without DOM thrashing. **Utilizes server-side in-memory caching for static data (like champions) to significantly reduce database load and improve response times.**
    *   **Real-time Collab:** Optimistic UI updates with polling synchronization to allow multiple officers to plan wars simultaneously.
    *   **Video Archive:** A searchable media library for Alliance War videos, linked directly to specific fights and nodes.

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
*   **OCR Pipeline:** Google Vision API integration for extracting champion data from user-uploaded screenshots.
*   **AI Integration:** OpenRouter (LLMs) used for drafting glossary terms and parsing complex abilities.
*   **Analytics:** Deep integration with **PostHog** for feature usage tracking and error analysis.

---

## 🚀 Key Feature Modules

### ⚔️ Alliance War Command Center
The flagship feature of the platform.
*   **Planning:** Supports multiple map layouts (`Standard` & `Big Thing`). Features pinch-to-zoom, node-specific tactic visualizers, and drag-and-drop assignments.
*   **Execution:** Now database-driven. Plans generated in the Web UI or via the `/aw plan` command can be distributed to players' private Discord threads. Messages feature rich header context (Season, Tier, Opponent) and **dynamically generated high-fidelity maps** that visually highlight player assignments (Attacks & Prefights) using specific champion portraits.
*   **Analysis:** "Plan-to-Upload" workflow generates unique tokens for players to upload war videos, automatically linking them to their specific node assignment.
*   **Smart Notifications:** Automatically posts rich embeds to a configured Discord channel whenever a new war video is uploaded or linked, keeping the alliance in the loop.

### 👤 Roster & Identity
*   **Smart Import:** Users can upload screenshots of their game roster. The system uses OCR to identify champions, star levels, ranks, and ascension status, syncing the data to the central DB.
*   **Profile:** Tracks Prestige history, multi-account support, and timezone management.

### 🧠 Knowledge Base
*   **Champion Search:** Powerful filtering by immunities, tags, and ability mechanics.
*   **Community Data:** Crowdsourced Duel Targets with an admin review queue system.

### 🛡️ Alliance Operations
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