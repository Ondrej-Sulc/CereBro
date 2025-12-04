import { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../../services/prismaService";
import { AbilityLinkType } from "@prisma/client";

export async function autocompleteChampionAbility(interaction: AutocompleteInteraction) {
    const championName = interaction.options.getString("champion");
    const type = interaction.options.getString("type") as AbilityLinkType;
    const focusedValue = interaction.options.getFocused();

    if (!championName || !type) {
      await interaction.respond([]);
      return;
    }

    const links = await prisma.championAbilityLink.findMany({
      where: {
        champion: { name: championName },
        type: type,
        ability: { name: { contains: focusedValue, mode: "insensitive" } },
      },
      include: {
        ability: true,
      },
      distinct: ["abilityId"],
      take: 25,
    });

    const abilities = links.map((link) => link.ability);
    await interaction.respond(
      abilities.map((ability) => ({ name: ability.name, value: ability.name }))
    );
}

export async function autocompleteAllAbilities(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const abilities = await prisma.ability.findMany({
      where: { name: { contains: focusedValue, mode: "insensitive" } },
      take: 25,
    });
    await interaction.respond(
      abilities.map((ability) => ({ name: ability.name, value: ability.name }))
    );
}

export async function autocompleteSource(interaction: AutocompleteInteraction) {
    const championName = interaction.options.getString("champion");
    const type = interaction.options.getString("type") as AbilityLinkType;
    const abilityName = interaction.options.getString("ability");
    const focusedValue = interaction.options.getFocused();

    if (!championName || !abilityName || !type) {
      await interaction.respond([]);
      return;
    }

    const links = await prisma.championAbilityLink.findMany({
      where: {
        champion: { name: championName },
        ability: { name: abilityName },
        type: type,
        OR: [
          { source: { contains: focusedValue, mode: "insensitive" } },
          { synergyChampions: { some: { champion: { name: { contains: focusedValue, mode: "insensitive" } } } } }
        ]
      },
      include: {
        synergyChampions: {
          include: {
            champion: true,
          },
        },
      },
      take: 25,
    });

    const sources = new Set<string>();
    for (const link of links) {
        let source = (link.source || "").trim();
        if (link.synergyChampions && link.synergyChampions.length > 0) {
            const synergyPart = link.synergyChampions
                .map(synergy => synergy.champion.shortName)
                .join(' & ');
            source = `Synergy [${synergyPart}]${source && source !== 'Synergy' ? ` & ${source}` : ''}`;
        }
        if(source) {
          sources.add(source);
        }
    }

    const sourcesArray = Array.from(sources);
    await interaction.respond(
      sourcesArray.map((source) => {
        const sourceValue = source === null ? "<None>" : source;
        return { name: sourceValue, value: sourceValue };
      })
    );
}

export async function autocompleteSynergyChampions(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    
    const lastCommaIndex = focusedValue.lastIndexOf(',');
    let prefix = '';
    let currentTerm = focusedValue;

    if (lastCommaIndex !== -1) {
        prefix = focusedValue.substring(0, lastCommaIndex + 1);
        currentTerm = focusedValue.substring(lastCommaIndex + 1).trim();
    }

    const champions = await prisma.champion.findMany({
      where: { name: { contains: currentTerm, mode: "insensitive" } },
      take: 25,
    });
    
    await interaction.respond(
      champions.map((champion) => {
        let suggestion = champion.name;
        if (prefix) {
             suggestion = prefix + (prefix.endsWith(' ') ? '' : ' ') + champion.name;
        }
        return { name: suggestion, value: suggestion };
      })
    );
}