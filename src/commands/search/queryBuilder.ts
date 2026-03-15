import { Prisma, ChampionClass, AttackType as AttackTypeEnum } from "@prisma/client";
import { SearchCoreParams } from "../../types/search";

export const ATTACK_PROPERTIES = [
  "Contact",
  "Projectile",
  "Physical",
  "Energy",
  "Non-Contact",
];
export const ATTACK_TYPE_KEYWORDS = Object.values(AttackTypeEnum);
export const ATTACK_GROUP_KEYWORDS = ["basic", "special"];
export const MODIFIER_KEYWORDS = ["all", "any"];

export function parseAndOrConditions(input: string | null | undefined): {
  conditions: string[];
  useAnd: boolean;
} {
  if (!input) {
    return { conditions: [], useAnd: true };
  }
  const lowercasedInput = input.toLowerCase();
  if (lowercasedInput.includes(" or ")) {
    return {
      conditions: input
        .split(/\s+or\s+/i)
        .map((c) => c.trim())
        .filter(Boolean),
      useAnd: false,
    };
  }
  return {
    conditions: input
      .split(/\s+and\s+/i)
      .map((c) => c.trim())
      .filter(Boolean),
    useAnd: true,
  };
}

export function getAutocompletePrefixAndCurrent(current: string): {
  prefix: string;
  search: string;
} {
  let prefix = "";
  let search = current;
  const lastAnd = current.toLowerCase().lastIndexOf(" and ");
  const lastOr = current.toLowerCase().lastIndexOf(" or ");

  if (lastAnd > lastOr) {
    prefix = current.substring(0, lastAnd + 5);
    search = current.substring(lastAnd + 5);
  } else if (lastOr > lastAnd) {
    prefix = current.substring(0, lastOr + 4);
    search = current.substring(lastOr + 4);
  }
  return { prefix, search };
}

export function isAttackType(value: string): value is AttackTypeEnum {
  return Object.values(AttackTypeEnum).includes(value as AttackTypeEnum);
}

export async function buildSearchWhereClause(
  params: Omit<SearchCoreParams, "userId" | "page" | "searchId">
): Promise<Prisma.ChampionWhereInput> {
  const where: Prisma.ChampionWhereInput = { AND: [{ isPlayable: true }] };
  const {
    abilities,
    immunities,
    tags,
    championClass,
    abilityCategory,
    attackType,
  } = params;

  if (championClass) {
    const { conditions, useAnd } = parseAndOrConditions(championClass);
    const classEnums = conditions
      .map((c) => c.toUpperCase())
      .filter((c) => Object.keys(ChampionClass).includes(c)) as ChampionClass[];

    if (classEnums.length > 0) {
      if (useAnd) {
        classEnums.forEach((c) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({ class: c });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          class: { in: classEnums },
        });
      }
    }
  }

  if (tags) {
    const { conditions, useAnd } = parseAndOrConditions(tags);
    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((tagName) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            tags: {
              some: { name: { equals: tagName, mode: "insensitive" } },
            },
          });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          tags: {
            some: { name: { in: conditions, mode: "insensitive" } },
          },
        });
      }
    }
  }

  if (abilities) {
    const { conditions, useAnd } = parseAndOrConditions(abilities);
    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((abilityName) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            abilities: {
              some: {
                type: "ABILITY",
                ability: {
                  name: { equals: abilityName, mode: "insensitive" },
                },
              },
            },
          });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          abilities: {
            some: {
              type: "ABILITY",
              ability: { name: { in: conditions, mode: "insensitive" } },
            },
          },
        });
      }
    }
  }

  if (immunities) {
    const { conditions, useAnd } = parseAndOrConditions(immunities);
    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((immunityName) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            abilities: {
              some: {
                type: "IMMUNITY",
                ability: {
                  name: { equals: immunityName, mode: "insensitive" },
                },
              },
            },
          });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          abilities: {
            some: {
              type: "IMMUNITY",
              ability: { name: { in: conditions, mode: "insensitive" } },
            },
          },
        });
      }
    }
  }

  if (abilityCategory) {
    const { conditions, useAnd } = parseAndOrConditions(abilityCategory);
    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((categoryName) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            abilities: {
              some: {
                type: "ABILITY",
                ability: {
                  categories: {
                    some: {
                      name: {
                        equals: categoryName,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
            },
          });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          abilities: {
            some: {
              type: "ABILITY",
              ability: {
                categories: {
                  some: {
                    name: {
                      in: conditions,
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
          },
        });
      }
    }
  }

  if (attackType) {
    const { conditions, useAnd } = parseAndOrConditions(attackType);

    const createAttackCondition = (
      condition: string
    ): Prisma.ChampionWhereInput => {
      const parts = condition.toLowerCase().split(/\s+/).filter(Boolean);
      let attackTypes: AttackTypeEnum[] = [];
      const properties: Prisma.HitWhereInput[] = [];
      let modifier: "all" | "any" = "any";

      for (const part of parts) {
        if (part === "all" || part === "any") {
          modifier = part;
          break;
        }
      }

      parts.forEach((part) => {
        const upperPart = part.toUpperCase();
        if (isAttackType(upperPart)) {
          attackTypes.push(upperPart);
        } else if (part === "basic") {
          attackTypes.push(
            ...(["L1", "L2", "L3", "L4", "M1", "M2", "H"] as AttackTypeEnum[])
          );
        } else if (part === "special") {
          attackTypes.push(...(["S1", "S2"] as AttackTypeEnum[]));
        } else if (part === "non-contact") {
          properties.push({
            AND: [
              { properties: { isEmpty: false } },
              { NOT: { properties: { has: "Contact" } } },
            ],
          });
        } else if (part !== "all" && part !== "any") {
          const normalizedProp = part.charAt(0).toUpperCase() + part.slice(1);
          if (ATTACK_PROPERTIES.includes(normalizedProp)) {
            properties.push({ properties: { has: normalizedProp } });
          }
        }
      });

      const hitCondition: Prisma.HitWhereInput = { AND: properties };

      const attackWhere: Prisma.AttackWhereInput = {};
      if (attackTypes.length > 0) {
        attackWhere.type = { in: attackTypes };
      }
      if (properties.length > 0) {
        attackWhere.hits = { some: hitCondition };
      }

      if (modifier === "all" && attackTypes.length > 0) {
        return {
          AND: [
            {
              attacks: {
                every: {
                  OR: [
                    { NOT: { type: { in: attackTypes } } },
                    { hits: { some: hitCondition } },
                  ],
                },
              },
            },
            { attacks: { some: { type: { in: attackTypes } } } },
          ],
        };
      } else {
        return { attacks: { some: attackWhere } };
      }
    };

    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((condition) => {
          (where.AND as Prisma.ChampionWhereInput[]).push(
            createAttackCondition(condition)
          );
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          OR: conditions.map(createAttackCondition),
        });
      }
    }
  }

  return where;
}
