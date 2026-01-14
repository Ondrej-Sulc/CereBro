import { Duel, DuelStatus, DuelSource } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { ChampionWithAllRelations } from "../../services/championService";

export function getDuelContent(
  duels: Duel[],
  resolveEmoji: (text: string) => string
): string {
  let content = "";
  if (!duels || duels.length === 0) {
    content = "No active or outdated duel targets found for this champion.";
  } else {
    // Sort duels to show ACTIVE ones first
    const sortedDuels = [...duels].sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
      if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
      return 0;
    });

    content = sortedDuels
      .map((duel) => {
        let duelString = `### \`${duel.playerName}\``;
        if (duel.rank) {
          duelString += ` (${duel.rank})`;
        }

        // Add source indicator
        if (duel.source === DuelSource.USER_SUGGESTION) {
          duelString += " 👤";
        } else if (duel.source === DuelSource.GUIA_MTC) {
          duelString += " <:GuiaMTC:0>";
        } else if (duel.source === DuelSource.COCPIT) {
          duelString += " <:CoCPit:0>";
        } else if (duel.source === DuelSource.MCOCHUB) {
          duelString += " <:MCOCHUB:0>";
        }

        // Add status indicator for outdated duels
        if (duel.status === "OUTDATED") {
          duelString += " ⚠️ (Outdated)";
        }

        return duelString;
      })
      .join("\n");
  }

  return resolveEmoji(content);
}

export function addDuelComponents(
  container: ContainerBuilder,
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
) {
  // Conditionally add GuiaMTC credit after buttons
  const duelsToShow = champion.duels.filter(
    (d) => d.status === DuelStatus.ACTIVE || d.status === DuelStatus.OUTDATED
  );
  const hasGuiaMTCSourcedDuels = duelsToShow.some(
    (duel) => duel.source === DuelSource.GUIA_MTC
  );
  const hasCoCPitSourcedDuels = duelsToShow.some(
    (duel) => duel.source === DuelSource.COCPIT
  );
  const hasMCHubSourcedDuels = duelsToShow.some(
    (duel) => duel.source === DuelSource.MCOCHUB
  );

  if (hasGuiaMTCSourcedDuels || hasCoCPitSourcedDuels || hasMCHubSourcedDuels) {
    let sourceCredits = "\nSources: ";
    const sources: string[] = [];
    if (hasGuiaMTCSourcedDuels) {
      sources.push("<:GuiaMTC:0> *[GuiaMTC](https://www.guiamtc.com/)*");
    }
    if (hasCoCPitSourcedDuels) {
      sources.push("<:CoCPit:0> *[CoCPit](https://cocpit.org)*");
    }
    if (hasMCHubSourcedDuels) {
      sources.push(
        "<:MCOCHUB:0> *[MCOCHUB](https://mcochub.insaneskull.com)*"
      );
    }
    sourceCredits += sources.join(", ");
    
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        resolveEmoji(sourceCredits)
      )
    );
  }
  
  // Help text for duel buttons
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "*Have a suggestion or see an outdated target? Use the buttons below!*"
    )
  );

  const duelActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`champion-duel-suggest_${champion.id}`)
      .setLabel("Suggest New Target")
      .setStyle(ButtonStyle.Success)
      .setEmoji("➕"),
    new ButtonBuilder()
      .setCustomId(`champion-duel-report_${champion.id}`)
      .setLabel("Report Outdated Target")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🚨")
  );
  container.addActionRowComponents(duelActionRow);
}
