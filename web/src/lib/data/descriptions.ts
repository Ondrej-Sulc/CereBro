export enum CommandAccess {
  PUBLIC,
  USER,
  ADMIN,
  FEATURE,
  BOT_ADMIN,
}

export interface SubcommandInfo {
  description: string;
  usage?: string;
  filters?: Map<string, string>;
  andOrLogic?: string;
  examples?: string[];
  image?: string;
}

export interface CommandInfo {
  description: string;
  access: CommandAccess;
  group?:
    | "Information & Search"
    | "User Management"
    | "Alliance Tools"
    | "Utilities";
  subcommands: Map<string, SubcommandInfo>;
}

export const commandDescriptions = new Map<string, CommandInfo>([
  [
    "admin",
    {
      description:
        "Administrative commands for managing champions, abilities, attacks, and the glossary. These commands are typically restricted to bot administrators and are used for data management and bot configuration.",
      access: CommandAccess.BOT_ADMIN,
      subcommands: new Map([
        [
          "champion",
          {
            description:
              "Admin commands for managing champions, including adding new champions, updating their images and tags, and syncing data from external sources.",
            usage: "/admin champion <subcommand>",
          },
        ],
        [
          "ability",
          {
            description:
              "Admin commands for managing champion abilities and immunities, including adding, removing, and drafting them using AI.",
            usage: "/admin ability <subcommand>",
          },
        ],
        [
          "attack",
          {
            description: "Admin commands for managing champion attack data.",
            usage: "/admin attack add <champion>",
          },
        ],
        [
          "glossary",
          {
            description:
              "Admin commands for managing glossary entries, including linking abilities to categories, unlinking them, and updating descriptions for abilities and categories.",
            usage: "/admin glossary <subcommand>",
          },
        ],
        [
          "duel",
          {
            description: "Admin commands for managing duel data.",
            usage: "/admin duel upload",
          },
        ],
      ]),
    },
  ],
  [
    "alliance",
    {
      description: "Manage your alliance, its features, and AQ schedule.",
      access: CommandAccess.USER,
      group: "Alliance Tools",
      subcommands: new Map([
        [
          "join",
          {
            description: "Officer/admin command for assigning a player to an alliance role in Discord. Regular members should join via Discord role sync or the website join-request flow.",
            usage: "/alliance join <role> [name]",
            examples: [
              "/alliance join role:@BG1 MyIGN - Assigns player MyIGN to the BG1 role and alliance mapping.",
              "/alliance join role:@Member - Assigns a registered player to the Member role/alliance.",
            ],
          },
        ],
        [
          "toggle-feature",
          {
            description: "Enable or disable a feature for your alliance (Alliance Admin only).",
            usage: "/alliance toggle-feature <feature> <enabled>",
            examples: [
              "/alliance toggle-feature feature:AW_PLANNING enabled:true - Enables the Alliance War planning feature.",
            ],
          },
        ],

        [
          "name",
          {
            description: "Update your alliance's name (Alliance Admin only).",
            usage: "/alliance name <name>",
            examples: [
              "/alliance name name:My Awesome Alliance",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "aq",
    {
      description:
        "Alliance Quest (AQ) utilities. These commands help alliances coordinate and track their progress in Alliance Quests.",
      access: CommandAccess.USER,
      group: "Alliance Tools",
      subcommands: new Map([
        [
          "start",
          {
            description:
              "Start a new AQ tracker. This initializes the AQ state, sets up the map, and allows members to update their progress.",
            usage: "/aq start <day> <role> [channel] [create_thread]",
            examples: [
              "/aq start day:1 role:BattleGroup1 - Starts an AQ tracker for Day 1, assigning BattleGroup1 role members.",
              "/aq start day:2 role:BattleGroup2 channel:#aq-discussion create_thread:true - Starts an AQ tracker for Day 2 in #aq-discussion, creating a thread for updates.",
            ],
          },
        ],
        [
          "end",
          {
            description:
              "End the active AQ tracker in a channel. This finalizes the AQ state and stops tracking.",
            usage: "/aq end [channel]",
            examples: [
              "/aq end - Ends the active AQ tracker in the current channel.",
              "/aq end channel:#aq-discussion - Ends the active AQ tracker in #aq-discussion.",
            ],
          },
        ],
        [
          "schedule",
          {
            description: "Manage the automated AQ schedule for your alliance through an interactive menu (Alliance Admin only). This includes setting up schedules for each battlegroup, defining AQ day-to-weekday mappings, setting a global start time, configuring reminders, and skipping AQ for a specified duration.",
            usage: "/aq schedule",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/aq_schedule.png"
          },
        ],
      ]),
    },
  ],
  [
    "aw",
    {
      description: "Commands for Alliance War planning and details.",
      access: CommandAccess.FEATURE,
      group: "Alliance Tools",
      subcommands: new Map([
        [
          "plan",
          {
            description:
              "Sends Alliance War plan details from a Google Sheet to player threads. You can specify a battlegroup, a target player, and an optional image to include with the plan.",
            usage: "/aw plan <battlegroup> [player] [image]",
          },
        ],
        [
          "details",
          {
            description:
              "Get detailed information about your Alliance War assignments. This command should be used within a player's war thread.",
            usage: "/aw details [node]",
            examples: [
              "/aw details - Shows all your AW assignments in the current war thread.",
              "/aw details node:5 - Shows details for your assignment on Node 5.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "champion",
    {
      description:
        "Get detailed information about any champion in the game. This acts as a comprehensive in-game encyclopedia for all champions.",
      access: CommandAccess.PUBLIC,
      group: "Information & Search",
      subcommands: new Map([
        [
          "info",
          {
            description:
              "Display a champion's core details and full abilities, including their signature ability and detailed ability breakdowns.",
            usage: "/champion info <champion>",
          },
        ],
        [
          "attacks",
          {
            description:
              "Display a champion's attack types and properties, showing details for basic, special, and heavy attacks.",
            usage: "/champion attacks <champion>",
          },
        ],
        [
          "abilities",
          {
            description:
              "List all of a champion's abilities, including their sources (e.g., Signature Ability, SP1, Synergy).",
            usage: "/champion abilities <champion>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/abilities_hulkling.png",
          },
        ],
        [
          "immunities",
          {
            description:
              "List all of a champion's immunities to various debuffs and effects (e.g., Bleed, Incinerate, Poison), including their sources.",
            usage: "/champion immunities <champion>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/immunities_onslaught.png",
          },
        ],
        [
          "tags",
          {
            description:
              "List all of a champion's tags (e.g., #Metal, #Villain, #Tech, #Hero, #Mystic). Tags are used for synergies and specific quest nodes.",
            usage: "/champion tags <champion>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/tags_dracula.png",
          },
        ],
        [
          "overview",
          {
            description:
              "Display a comprehensive overview of a champion, combining their abilities, immunities, attacks, and tags in a single view.",
            usage: "/champion overview <champion>",
          },
        ],
        [
          "duel",
          {
            description:
              "Get duel targets for a champion. This provides a list of players to duel against for practice.",
            usage: "/champion duel <champion>",
          },
        ],
      ]),
    },
  ],
  [
    "debug",
    {
      description:
        "Debugging commands, restricted to bot administrators. These commands are used for testing and troubleshooting bot features.",
      access: CommandAccess.BOT_ADMIN,
      subcommands: new Map([
        [
          "roster",
          {
            description:
              "Debugs the roster processing from one or more screenshots. This command will attempt to extract champion data from the provided images and display the debug output.",
            usage: "/debug roster <image1> [image2] [image3] [image4] [image5]",
          },
        ],
        [
          "prestige",
          {
            description:
              "Debugs prestige extraction from a screenshot. This command will attempt to extract prestige values from the provided image and display detailed OCR debug information.",
            usage: "/debug prestige <image> [player]",
          },
        ],
      ]),
    },
  ],
  [
    "glossary",
    {
      description:
        "Look up MCOC effects, buffs, and debuffs. This acts as an in-game dictionary for various terms.",
      access: CommandAccess.PUBLIC,
      group: "Information & Search",
      subcommands: new Map([
        [
          "effect",
          {
            description:
              "Look up a specific effect by name to see its description, associated categories, and a list of champions that have or are immune to this effect. You can also search for champions with the effect in your own roster. Provides detailed information about the effect's mechanics.",
            usage: "/glossary effect <effect>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/glossary_effect_crush.png",
          },
        ],
        [
          "category",
          {
            description:
              "List all effects within a specific category (e.g., Buffs, Debuffs, Immunities). You can also search for all champions in the category, including within your own roster. This helps in exploring related effects and their descriptions.",
            usage: "/glossary category <category>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/glossary_category_auto-block.png",
          },
        ],
        [
          "list",
          {
            description:
              "List all available effect categories in the glossary. This provides an overview of the types of effects tracked by the bot, with interactive buttons to view effects within each category.",
            usage: "/glossary list",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/glossary_list.png",
          },
        ],
      ]),
    },
  ],
  [
    "prestige",
    {
      description:
        "Extract prestige values from an MCOC screenshot or view the leaderboard.",
      access: CommandAccess.USER,
      group: "User Management",
      subcommands: new Map([
        [
          "update",
          {
            description:
              "Update your prestige values by uploading a screenshot of your in-game profile. The bot will use OCR to extract Summoner, Champion, and Relic prestige. You can optionally specify a player to update for (admin/moderator only).",
            usage: "/prestige update <image> [player]",
          },
        ],
        [
          "leaderboard",
          {
            description:
              "View the server prestige leaderboard. You can switch between Summoner, Champion, and Relic prestige leaderboards using interactive buttons.",
            usage: "/prestige leaderboard",
          },
        ],
      ]),
    },
  ],
  [
    "profile",
    {
      description: "Manage your in-game profiles. Supports multiple accounts, allowing you to switch between them easily. The main `/profile view` command provides an interactive dashboard for managing all aspects of your profile.",
      access: CommandAccess.USER,
      group: "User Management",
      subcommands: new Map([
        [
          "view",
          {
            description: "Displays an interactive dashboard of your active profile, including prestige, roster summary, and alliance info. From this view, you can switch between profiles, rename or delete the active profile, and set your timezone.",
            usage: "/profile view [user]",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/profile_view.png"
          },
        ],
        [
          "add",
          {
            description: "Adds a new in-game profile to your Discord account. You can switch to this profile using `/profile switch`.",
            usage: "/profile add <name>",
          },
        ],
        [
          "switch",
          {
            description: "Switches your active in-game profile to another one you have registered.",
            usage: "/profile switch <name>",
          },
        ],
        [
          "list",
          {
            description: "Lists all of your registered in-game profiles, indicating which one is currently active.",
            usage: "/profile list",
          },
        ],
        [
          "remove",
          {
            description: "Removes one of your registered in-game profiles.",
            usage: "/profile remove <name>",
          },
        ],
        [
          "rename",
          {
            description: "Renames one of your registered in-game profiles.",
            usage: "/profile rename <current_name> <new_name>",
          },
        ],
        [
          "timezone",
          {
            description: "Sets the local timezone for your active profile, ensuring all times are displayed correctly for you.",
            usage: "/profile timezone <timezone>",
          },
        ],
      ]),
    },
  ],
  [
    "register",
    {
      description:
        "Registers your in-game name with the bot and unlocks features like roster management and prestige tracking. Alliance membership is managed through Discord role sync or website join requests approved by officers.",
      access: CommandAccess.USER,
      group: "User Management",
      subcommands: new Map([
        [
          "default",
          {
            description:
              "Registers your in-game name, which is required for most features.",
            usage: "/register <name>",
            examples: [
              '/register name:MyIGN - Registers your in-game name as "MyIGN".',
            ],
          },
        ],
      ]),
    },
  ],
  [
    "roster",
    {
      description:
        "Manage your MCOC roster. Keep track of your champions, their ranks, awakened status, and ascension levels.",
      access: CommandAccess.USER,
      group: "User Management",
      subcommands: new Map([
        [
          "update",
          {
            description:
              "Update your roster by uploading one or more screenshots of your champion list. The bot will use OCR to detect champions, their star level, and awakened status. You must specify the star level and rank of the champions in the screenshot(s).",
            usage:
              "/roster update <stars> <rank> <image1> [is_ascended] [image2] [image3] [image4] [image5] [player]",
          },
        ],
        [
          "view",
          {
            description:
              "View a player's roster. You can filter by star level, rank, ascended status, and specify a player whose roster to view.",
            usage: "/roster view [stars] [rank] [is_ascended] [player]",
            examples: [
              "/roster view - Shows your entire roster.",
              "/roster view stars:6 rank:5 - Shows your 6-star, Rank 5 champions.",
              "/roster view is_ascended:true player:@Ally - Shows @Ally's ascended champions.",
            ],
          },
        ],
        [
          "delete",
          {
            description:
              "Delete champions from a player's roster. You can delete specific champions by name, or filter by star level, rank, or ascended status. If no options are provided, it will prompt to delete the entire roster.",
            usage:
              "/roster delete [champion] [stars] [rank] [is_ascended] [player]",
          },
        ],
        [
          "summary",
          {
            description:
              "Display a summary of a player's roster, grouped by star level, rank, and class. You can specify a player whose roster to summarize.",
            usage: "/roster summary [player]",
            examples: [
              "/roster summary - Shows a summary of your roster.",
              "/roster summary player:@Ally - Shows a summary of @Ally's roster.",
            ],
          },
        ],
        [
          "export",
          {
            description:
              "Export a player's roster to a CSV file. The CSV file will be sent as an attachment.",
            usage: "/roster export [player]",
            examples: [
              "/roster export - Exports your roster to a CSV file.",
              "/roster export player:@Ally - Exports @Ally's roster to a CSV file.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "schedule",
    {
      description:
        "Manage scheduled tasks. You can add, list, and remove scheduled messages or command executions.",
      access: CommandAccess.PUBLIC,
      group: "Utilities",
      subcommands: new Map([
        [
          "add",
          {
            description:
              "Add a new scheduled task. You can schedule a custom message or a bot command to be sent to a specific channel or user at a defined frequency and time. Supports daily, weekly, and monthly frequencies.",
            usage:
              "/schedule add <name> <frequency> <time> [command] [message] [target_channel_id] [target_user_id] [day] [interval] [unit]",
            examples: [
              "/schedule add name:DailyAQ frequency:daily time:08:00 message:AQ starts soon! target_channel_id:#alliance-chat - Schedules a daily reminder in #alliance-chat.",
              "/schedule add name:AWReminder frequency:weekly time:19:00 day:monday command:/aw plan battlegroup:1 - Schedules a weekly AW plan command on Mondays.",
            ],
          },
        ],
        [
          "list",
          {
            description:
              "List all active scheduled tasks. Displays the name, frequency, time, and content of each scheduled task, along with an ID for removal.",
            usage: "/schedule list",
            examples: [
              "/schedule list - Shows all your active scheduled tasks.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "search",
    {
      description:
        "Powerful search for champions based on various criteria, acting as a comprehensive in-game wiki. Filters are case-insensitive.",
      access: CommandAccess.PUBLIC,
      group: "Information & Search",
      subcommands: new Map([
        [
          "all",
          {
            description:
              "Search the entire champion database using a wide range of filters. This is your go-to command for finding champions based on abilities, immunities, tags, classes, ability categories, and attack types.",
            usage:
              "/search all [abilities] [immunities] [tags] [class] [ability-category] [attack-type]",
            filters: new Map([
              [
                "abilities",
                "Filter by champion abilities (e.g., \`abilities:poison\` to find champions with poison abilities).",
              ],
              [
                "immunities",
                "Filter by champion immunities (e.g., \`immunities:bleed\` to find bleed-immune champions).",
              ],
              [
                "tags",
                "Filter by champion tags (e.g., \`tags:#2025\` to find champions with the 2025 tag).",
              ],
              [
                "class",
                "Filter by champion class (e.g., \`class:skill\`).",
              ],
              [
                "ability-category",
                "Filter by ability category (e.g., \`ability-category:buffs\`).",
              ],
              [
                "attack-type",
                "Filter by attack type and properties. Syntax: \`[all|any] [group] [props...]\`. E.g., \`all basic energy\` or \`s1 non-contact\`.",
              ],
            ]),
            andOrLogic:
              "Filters can be combined using \`AND\` or \`OR\`. For example: \`abilities:poison and shock\` or \`class:skill or mutant\`. This logic applies to all filter types.",
            examples: [
              "/search all immunities:poison abilities:fury",
              "/search all immunities:bleed and incinerate",
              "/search all attack-type:all basic energy - Finds champions with all basic attacks having energy properties.",
            ],
            image: "https://storage.googleapis.com/champion-images/feature-showcase/search_crush.png",
          },
        ],
        [
          "roster",
          {
            description:
              "Search within a player's personal champion roster using the same powerful filters as `/search all`. This helps you quickly find specific champions you own based on their attributes.",
            usage:
              "/search roster [abilities] [immunities] [tags] [class] [ability-category] [attack-type] [player]",
            filters: new Map([
              ["abilities", "Filter by champion abilities."],
              ["immunities", "Filter by champion immunities."],
              ["tags", "Filter by champion tags."],
              ["class", "Filter by champion class."],
              ["ability-category", "Filter by ability category."],
              ["attack-type", "Filter by attack type and properties."],
              [
                "player",
                "The player whose roster to search (defaults to you).",
              ],
            ]),
            andOrLogic:
              "The \`AND/OR\` logic works identically to \`/search all\`. All filters listed above can be combined.",
            examples: [
              "/search roster class:tech",
              "/search roster immunities:incinerate and poison",
              "/search roster attack-type:m1 non-contact - Finds champions in your roster with non-contact M1 attacks.",
            ],
            image: "https://storage.googleapis.com/champion-images/feature-showcase/search_roster_complex.png",
          },
        ],
      ]),
    },
  ],
  [
    "summarize",
    {
      description:
        "Summarizes recent messages in a channel or thread using AI. You can specify a timeframe, target channel, language, and even a custom prompt for the summarization.",
      access: CommandAccess.PUBLIC,
      group: "Utilities",
      subcommands: new Map([
        [
          "default",
          {
            description:
              "Summarizes recent messages in a channel or thread using AI.",
            usage:
              "/summarize <timeframe> [channel] [language] [custom_prompt]",
            examples: [
              "/summarize timeframe:24h",
              "/summarize timeframe:today channel:#general language:Spanish",
              "/summarize timeframe:lastweek",
            ],
          },
        ],
      ]),
    },
  ],
]);
