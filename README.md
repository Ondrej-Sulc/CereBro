# CereBro

*This bot is an unofficial fan-made tool and is not affiliated with, endorsed, or sponsored by Marvel or Kabam. All game content and materials are trademarks and copyrights of their respective owners.*

A modular Discord bot built with TypeScript, designed for Marvel Contest of Champions (MCOC) related tasks. This bot integrates with Google Sheets for data logging and OpenRouter for AI capabilities, all running on Discord.js v14.

## Key Features

- **Web Interface:** A modern, visually appealing web interface built with Next.js, Tailwind CSS, and shadcn/ui. It serves as a landing page for the bot, showcasing its features, commands, and providing an FAQ section.
    - **War Archive:** A searchable database of uploaded Alliance War videos and fight logs. Features Discord OAuth2 authentication to allow users to upload videos and view alliance-restricted content. The search interface includes interactive filters for attacker, defender (with champion image display and clear functionality), player, node, and supports multi-season selection.
    - **Profile Management:** Users can view their profile summary (Prestige, Alliance, Roster stats) and update their roster by uploading screenshots directly from the web interface, leveraging the same powerful OCR technology as the bot.
- **Dynamic Command Loading:** Commands in the `src/commands` directory are automatically registered on startup.
- **Tiered Command Access:** The bot now implements a granular command access system, categorizing commands into different tiers:
    - **Public:** Accessible to all users by default (e.g., `/champion`, `/glossary`, `/search all`).
    - **User:** Requires users to be registered with the bot (via `/register` or `/alliance join`) to access (e.g., `/roster`, `/prestige`, `/search roster`).
    - **Alliance Admin:** Commands for managing server-specific bot settings, accessible by Discord administrators within an alliance (e.g., `/alliance toggle-feature`, `/alliance name`).
    - **Bot Admin:** Restricted to designated bot administrators for managing global bot data and configurations (e.g., `/admin`, `/debug`).
    - **Feature:** Commands that are disabled by default and must be explicitly enabled by an Alliance Admin for their server (e.g., `/aw`).

- **Champion Administration:** A powerful admin command to add or update champions, abilities, attacks, and glossary entries in the database. The champion creation process is handled through a user-friendly, two-part interactive modal, and the image update command features autocomplete for champion names. This command automates the entire process, including:
    - **Image Processing:** Downloads champion images, resizes them to multiple dimensions (256, 128, 64, 32), and applies a subtle blur to smaller sizes.
    - **Cloud Storage:** Uploads the processed images to a Google Cloud Storage bucket.
    - **AI Tag Extraction:** Uses an AI model (via OpenRouter) to analyze a provided image and extract a champion's tags.
    - **AI Ability Drafting:** Leverages AI to draft abilities and immunities for champions based on their full abilities JSON.
    - **Application Emoji Creation:** Automatically creates a new application emoji for the champion.
    - **Database Integration:** Upserts the champion data into the PostgreSQL database, ensuring no duplicates are created.
- **Alliance Management:** A comprehensive suite of commands to manage all aspects of the alliance within the bot.
    - **Role-Based Permissions:** Introduces a new "Officer" role, configurable per alliance. Officers and Discord Administrators gain access to management commands.
    - **Automatic Guild Initialization:** When CereBro joins a new server, it automatically initializes an `Alliance` record and sends a welcome message with a "Start Setup" button to guide administrators.
    - **Streamlined Setup Wizard:** The new `/setup` command provides an interactive, step-by-step wizard for administrators to configure essential alliance roles (Officer, Battlegroups).
    - **Battlegroup & Officer Sync:** The bot can automatically sync Battlegroup and Officer roles from Discord to the database, keeping the alliance structure up-to-date. This happens automatically during setup or can be triggered manually with `/alliance sync-roles`.
    - **Automatic Player Registration:** During role synchronization, members with configured alliance roles are automatically registered with the bot, creating their `Player` profile (if it doesn't exist) using their Discord display name and linking them to the alliance.
    - **Role Configuration:** `/alliance config-roles` allows admins to map their server's Discord roles to the bot's Officer and Battlegroup (1, 2, 3) functions.
    - **Member Management:** A new `/alliance manage` command group for officers to:
        - `remove`: Remove a player from the alliance roster.
        - `list`: View a simple, admin-focused list of all members.
    - **Alliance Overview:** The `/alliance view` command provides a rich, detailed overview of the alliance roster, neatly organized by Battlegroup and clearly indicating who the officers are.
    - **Joining:** `/alliance join` allows new members to join the alliance on Discord and register with the bot in one step.
    - **Settings:** `/alliance name` and `/alliance toggle-feature` allow admins to manage basic alliance settings.
- **Profile Management:** The `/profile` command allows users to manage their in-game profiles. It supports multiple accounts, allowing you to switch between them easily. The main `/profile view` command provides an interactive dashboard for managing all aspects of your profile, including prestige, roster summary, and alliance info. From this view, you can switch between profiles, rename or delete the active profile, and set your timezone.
- **Roster Management:** A comprehensive `/roster` command that allows users to manage their personal champion rosters. It includes subcommands to `update` (via OCR from screenshots), `view`, `delete`, `summary`, and `export` champions, providing a full suite of tools for roster maintenance.
- **Interactive Champion Command:** The `/champion` command has been enhanced with a fully interactive UI. Each subcommand provides a main view with buttons to dynamically switch between a champion's overview, abilities, attacks, tags, and more. The detailed `info` view is now fully paginated with "Previous" and "Next" buttons, allowing for easy navigation of long ability descriptions.
- **Community-Sourced Duels:** The `/champion duel` command is now interactive, allowing users to suggest new duel targets and report outdated ones. Submissions are sent to an admin queue for review, ensuring the duel data stays fresh and accurate.
- **Advanced Search:** A powerful `/search` command with two main subcommands:
    - `/search all`: Performs a global search across all champions in the database based on a wide range of criteria, including abilities, immunities, tags, classes, ability categories, and attack types.
    - `/search roster`: Allows users to search within their own personal roster, making it easy to find specific champions they own.
- **AQ Management:** An interactive `/aq` command to manage Alliance Quest (AQ) trackers. Users can `start` and `end` trackers, and progress is updated through interactive buttons, providing a real-time view of the AQ status. It also includes a comprehensive, interactive `/aq schedule` command for Alliance Admins to manage the automated AQ schedule for their alliance.
- **Alliance War & Video Archive:** A fully integrated system for war planning, video uploading, and fight analysis.
    - **Search:** The `/aw search` command allows users to search for past fights and videos by attacker, defender, node, player, tier, and season. It features smart autocomplete for all search fields.
    - **Plan & Upload:** The `/aw plan` command reads war assignments from a Google Sheet, creates persistent records, and sends assignments to players. Each assignment includes an "Upload Video" button, providing a seamless link to the web UI with pre-filled fight data.
    - **Web Archive:** The web interface features a comprehensive "War Archive" where users can browse and filter all logged fights and videos with an advanced search interface.
- **PostgreSQL Database:** Uses a robust PostgreSQL database managed with Prisma for persistent data storage.
- **Google Sheets Integration:** Utilizes Google Sheets for data storage and retrieval (e.g., for scheduling).
- **Advanced Scheduling:** Schedule commands or custom messages with flexible timing (e.g., daily, weekly, monthly) via `/schedule`.
- **Centralized Error Handling:** A robust system that provides users with a unique error ID while logging detailed context for debugging.
- **Dockerized Environment:** Fully containerized with Docker Compose for consistent development and easy deployment, including a PostgreSQL database service.
- **AI Capabilities:** Integration with OpenRouter for advanced AI features, including champion ability drafting and tag extraction.
- **Dynamic Thumbnail Generation:** A sophisticated service (`src/utils/thumbnailGenerator.ts`) that generates custom, visually rich thumbnails for champion-related commands. It uses a champion's class to theme the image with unique colors and intricate SVG background patterns. These patterns are highly configurable, allowing for easy adjustments to their scale and opacity to fine-tune the final look.
    - **Product Analytics:** Deep integration with PostHog for detailed, user-centric analytics. Captures events for all command executions, button clicks, and modal submissions to provide insights into feature usage and user engagement.

- **Single Source of Truth for Documentation:** Command documentation (descriptions, usage, examples) is now defined directly within each command's source code. A build script automatically generates a master `commands.json` file, which is used to power both the in-bot `/help` command and the website's command reference, ensuring documentation is always in sync with the code.
## Technology Stack

- **Language:** TypeScript (Strict Mode)
- **Framework:** Discord.js v14
- **Database:** PostgreSQL with Prisma ORM
- **APIs:** Google Sheets, OpenRouter, Google Cloud Storage, PostHog
- **Scheduling:** `node-cron`
- **Authentication:** NextAuth.js (v5 beta) with Discord Provider
- **Containerization:** Docker & Docker Compose

## Hosting

The production instance of the bot and its PostgreSQL database are hosted on [Railway](https://railway.app/).

### Web Application Deployment

The Next.js web application, located in the `/web` directory, is deployed as a separate service on Railway. Its deployment is handled by a dedicated, multi-stage `web.Dockerfile`.

The build process was updated to a more robust and standard pattern after issues were discovered with `pnpm deploy` and `pnpm prune` in a monorepo context. The new process ensures reliability by installing all dependencies, building the application, and generating all necessary code in a single stage. To ensure stability, `devDependencies` are not pruned, resulting in a slightly larger but more reliable production image.

Currently, the Next.js configuration has `typescript: { ignoreBuildErrors: true }` enabled. This is a temporary workaround for a persistent type-checking error related to the new Next.js 16 release, which allows the deployment to succeed while the underlying type issue is investigated.

## Commands

| Command | Description | Access |
| --- | --- | --- |
| `/admin` | Administrative commands for managing champions, abilities, attacks, and the glossary. These commands are typically restricted to bot administrators and are used for data management and bot configuration. | Bot Admin |
| `/alliance` | A comprehensive suite of commands to view and manage your alliance, its members, roles, and features. | User |
| `/aq` | Alliance Quest (AQ) utilities. These commands help alliances coordinate and track their progress in Alliance Quests. | User |
| `/aw` | Commands for Alliance War planning, details, searching fights/videos, and generating upload links. | Feature |
| `/champion` | Get detailed, interactive information about any champion. Features buttons to switch between views (abilities, attacks, etc.), pagination for long descriptions, and community-sourced duel targets. | Public |
| `/debug` | Debugging commands, restricted to bot administrators. These commands are used for testing and troubleshooting bot features. | Bot Admin |
| `/glossary` | Look up MCOC effects, buffs, and debuffs. This acts as an in-game dictionary for various terms. | Public |
| `/prestige` | Extract prestige values from an MCOC screenshot or view the leaderboard. | User |
| `/profile` | Manage your in-game profiles. Supports multiple accounts, allowing you to switch between them easily. The main `/profile view` command provides an interactive dashboard for managing all aspects of your profile. | User |
| `/register` | For individual users to create their profile or update their in-game name. Alliance members are automatically registered during role synchronization. | User |
| `/roster` | Manage your MCOC roster. Keep track of your champions, their ranks, awakened status, and ascension levels. | User |
| `/schedule` | Manage scheduled tasks. You can add, list, and remove scheduled messages or command executions. | Public |
| `/search` | Powerful search for champions based on various criteria, acting as a comprehensive in-game wiki. Filters are case-insensitive. | Public |
| `/summarize` | Summarizes recent messages in a channel or thread using AI. You can specify a timeframe, target channel, language, and even a custom prompt for the summarization. | Public |
| `/help` | Displays an interactive help guide for all bot commands. | Public |


---

## Emoji Handling (Application Emojis)

This bot uses application-owned emojis to ensure consistent rendering across production and development bots, even when emoji IDs differ.

- **How it works**: Emojis are referenced by name in stored strings (e.g., `<:Blade:12345>`). At runtime, the bot resolves the name to the current application’s emoji ID and rewrites the markup automatically. Animated vs static is preserved.
- **No guild dependency**: Resolution uses application emojis attached to the bot application (managed in the Dev Portal or via API), not guild emojis. A fallback to guild/client emoji caches exists for legacy cases, but the intended source is application emojis.
- **Name matching required**: Ensure the same emoji NAMES exist in both your prod and dev applications. IDs can differ; names must match.
- **Load timing**: Application emojis are loaded on startup. If you add/remove emojis, restart the bot (or add a reload command later).
- **Troubleshooting**:
  - If emojis don’t render, verify that the application has emojis with the expected names and that the bot has permission to use them.
  - Startup will log a warning if the application emoji list is empty or the response shape is unrecognized.

Manage emojis in: Discord Developer Portal → Your Application → Emojis.

---

## Migration from Legacy Bot

This project is a complete rewrite of a legacy Python-based MCOC bot. The migration is now complete, with all relevant commands having been transitioned to a modern, TypeScript-based slash command architecture utilizing modern Discord UI components, a robust PostgreSQL database, and improved code quality.

## Getting Started (Local Development)

The project is fully containerized for a consistent and easy-to-use local development experience. The `docker-compose.yaml` file is configured to run both the bot and the web services with hot-reloading enabled.

To get started, simply run:
```bash
docker-compose up --build
```
This command will build the development images and start the containers. The Docker setup handles all dependencies and file permissions, including the use of a dedicated entrypoint script for the web service to manage volume ownership, ensuring a smooth developer workflow.

---

## Project Structure

```
CereBro/
├── prisma/ # Prisma schema and migration files
│ └── schema.prisma
├── src/
│ ├── commands/ # Each directory is a slash command with subcommands
│ │ ├── roster/ # Example of a command with subcommands
│ │ │   ├── index.ts # Main command logic and subcommand router
│ │ │   ├── add.ts # Logic for the 'add' subcommand
│ │ │   └── ... # Other subcommand files
│ │ ├── search/
│ │ └── aq/
│ ├── services/ # Modules for external APIs and business logic
│ ├── types/ # Shared TypeScript interfaces and types
│ ├── utils/ # Generic helpers and internal logic handlers
│ ├── config.ts # Environment variable loading and validation
│ └── index.ts # Bot entry point, client setup, event handlers
├── Dockerfile # Multi-stage build for lean production images
├── docker-compose.yaml # Development environment setup
└── README.md # You are here
```

### Directory Distinction

To maintain a clean and scalable architecture, the project distinguishes between `services` and `utils`:

-   **`src/services`**: This directory is for modules that connect to external APIs or manage a specific, stateful, or long-running part of the application's business logic. They act as specialized providers of functionality.
    -   *Examples*: `openRouterService.ts`, `sheetsService.ts`, `schedulerService.ts`, `aqReminderService.ts`.

-   **`src/utils`**: This directory contains more generic, often stateless helper functions, formatters, type guards, or internal application logic handlers (like command and error handling). They are broadly reusable across different parts of the application.
    -   *Examples*: `errorHandler.ts`, `emojiResolver.ts`, `commandHandler.ts`.