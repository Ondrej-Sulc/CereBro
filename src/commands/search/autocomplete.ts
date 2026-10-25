import { AutocompleteInteraction } from "discord.js";
import {
  getAutocompletePrefixAndCurrent,
  ATTACK_PROPERTIES,
  ATTACK_TYPE_KEYWORDS,
  ATTACK_GROUP_KEYWORDS,
  MODIFIER_KEYWORDS,
} from "./queryBuilder";
import { ChampionClass } from "@prisma/client";
import { getSearchEffectNames } from "./data";
import type { EffectForm, EffectDirection } from "../../domain/ability-source";

export async function handleAutocomplete(interaction: AutocompleteInteraction) {
    const { prisma } = await import("../../services/prismaService.js");
    const focusedOption = interaction.options.getFocused(true);
    const focusedValue = focusedOption.value;

    const { prefix, search } = getAutocompletePrefixAndCurrent(focusedValue);

    if (focusedOption.name === "abilities" || focusedOption.name === "immunities") {
      const names = await getSearchEffectNames(focusedOption.name, search, {
        effectForm: interaction.options.getString("effect-form") as EffectForm | null,
        effectDirection: interaction.options.getString("effect-direction") as EffectDirection | null,
        includeResistances: interaction.options.getBoolean("include-resistances"),
        minResistance: interaction.options.getNumber("min-resistance"),
      });
      await interaction.respond(names.map(name => ({ name: `${prefix}${name}`, value: `${prefix}${name}` }))
        .filter(choice => choice.value.length <= 100));
    } else if (focusedOption.name === "tags") {
      let tags;
      if (search) {
        tags = await prisma.tag.findMany({
          where: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          distinct: ["name"],
          take: 25,
          orderBy: { name: "asc" },
        });
      } else {
        tags = await prisma.tag.findMany({
          distinct: ["name"],
          take: 25,
          orderBy: {
            champions: {
              _count: "desc",
            },
          },
        });
      }

      await interaction.respond(
        tags.map((tag: { name: string }) => ({
          name: `${prefix}${tag.name}`,
          value: `${prefix}${tag.name}`,
        }))
      );
    } else if (focusedOption.name === "class") {
      const classes = Object.values(ChampionClass).filter((c) =>
        c.toLowerCase().includes(search.toLowerCase())
      );
      await interaction.respond(
        classes.map((c) => ({ name: `${prefix}${c}`, value: `${prefix}${c}` }))
      );
    } else if (focusedOption.name === "ability-category") {
      const categories = await prisma.abilityCategory.findMany({
        where: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        take: 25,
        orderBy: { name: "asc" },
      });
      await interaction.respond(
        categories.map((category: { name: string }) => ({
          name: `${prefix}${category.name}`,
          value: `${prefix}${category.name}`,
        }))
      );
    } else if (focusedOption.name === "attack-type") {
      const searchParts = search.toLowerCase().split(/\s+/);
      const lastWord = searchParts.pop() || "";

      const suggestions = [
        ...MODIFIER_KEYWORDS,
        ...ATTACK_PROPERTIES,
        ...ATTACK_TYPE_KEYWORDS,
        ...ATTACK_GROUP_KEYWORDS,
      ];

      const filtered = suggestions.filter(
        (s) =>
          s.toLowerCase().startsWith(lastWord) &&
          !searchParts.includes(s.toLowerCase())
      );

      const baseQuery = search.substring(0, search.lastIndexOf(lastWord));

      await interaction.respond(
        filtered.map((type) => {
          const newQuery = `${baseQuery}${type}`;
          return {
            name: `${prefix}${newQuery}`,
            value: `${prefix}${newQuery}`,
          };
        })
      );
    }
}
