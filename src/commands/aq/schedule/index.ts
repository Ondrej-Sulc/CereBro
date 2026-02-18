import {
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../../services/prismaService";
import { parseDuration, convertUserToUtcTime } from "../../../utils/time";
import { buildOverviewContainer } from "./overview";
import { buildEditBgContainer } from "./edit";
import { buildReminderSettingsContainer } from "./reminder-settings";
import logger from "../../../services/loggerService";

export async function handleAqSchedule(
  interaction: ChatInputCommandInteraction
) {
  if (!interaction.guildId) return;
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const showOverview = async (i: ChatInputCommandInteraction | any) => {
    const container = await buildOverviewContainer(i);
    const method = i.deferred || i.replied ? "editReply" : "update";
    await i[method]({
      components: [container],
      flags: [MessageFlags.IsComponentsV2],
    });
  };

  const message = await interaction.editReply({
    components: [await buildOverviewContainer(interaction)],
    flags: [MessageFlags.IsComponentsV2],
  });

  const collector = message.createMessageComponentCollector({
    time: 300000, // 5 minutes
  });

  let editState: any = {};
  let reminderSettingsState: any = {};

  collector.on("collect", async (i: any) => {
    try {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "You cannot use this menu.",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      const customIdParts = i.customId.split(":");
      const action = customIdParts[2];

      if (action !== "edit-time" && action !== "skip") {
        await i.deferUpdate();
      }

      if (action === "edit-reminders") {
        const allianceData = await prisma.alliance.findUnique({
          where: { guildId: interaction.guildId! },
          include: { aqReminderSettings: true, aqSchedules: true },
        });
        const player = await prisma.player.findFirst({
          where: { discordId: i.user.id, isActive: true },
        });
        const timezone = player?.timezone || "UTC";
        const startTime = allianceData?.aqSchedules[0]?.time || "20:00";

        reminderSettingsState = allianceData?.aqReminderSettings || {};
        const container = buildReminderSettingsContainer(
          allianceData?.aqReminderSettings || null,
          timezone,
          startTime
        );
        await i.editReply({ components: [container] });
      } else if (i.customId.startsWith("interactive:aq-reminders")) {
        const reminderAction = customIdParts[2];

        const allianceSchedules = await prisma.aQSchedule.findMany({
          where: { alliance: { guildId: i.guildId! } },
        });
        const startTime = allianceSchedules[0]?.time || "20:00";

        if (reminderAction === "toggle") {
          let reminderKey = customIdParts[3]; // "s1", "s2", or "final"
          if (reminderKey === "s1") {
            reminderKey = "section1";
          } else if (reminderKey === "s2") {
            reminderKey = "section2";
          }
          const toggleTo = customIdParts[4] === "enable";
          reminderSettingsState[`${reminderKey}ReminderEnabled`] = toggleTo;

          const player = await prisma.player.findFirst({
            where: { discordId: i.user.id, isActive: true },
          });
          const timezone = player?.timezone || "UTC";

          const container = buildReminderSettingsContainer(
            reminderSettingsState,
            timezone,
            startTime
          );
          await i.editReply({ components: [container] });
        } else if (reminderAction === "select") {
          const setting = customIdParts[3];
          const value = i.values[0];
          const player = await prisma.player.findFirst({
            where: { discordId: i.user.id, isActive: true },
          });
          const timezone = player?.timezone || "UTC";
          const utcTime = convertUserToUtcTime(value, timezone);

          if (setting === "s1") {
            reminderSettingsState.section1PingTime = utcTime;
          } else if (setting === "s2") {
            reminderSettingsState.section2PingTime = utcTime;
          } else if (setting === "final") {
            reminderSettingsState.finalPingTime = utcTime;
          }

          const container = buildReminderSettingsContainer(
            reminderSettingsState,
            timezone,
            startTime
          );
          await i.editReply({ components: [container] });
        } else if (reminderAction === "save") {
          const allianceToSave = await prisma.alliance.findUnique({
            where: { guildId: interaction.guildId! },
          });
          if (!allianceToSave) return;

          const settingsToSave = {
            section1ReminderEnabled:
              reminderSettingsState.section1ReminderEnabled ?? true,
            section1PingTime: reminderSettingsState.section1PingTime || "11:00",
            section2ReminderEnabled:
              reminderSettingsState.section2ReminderEnabled ?? true,
            section2PingTime: reminderSettingsState.section2PingTime || "18:00",
            finalReminderEnabled:
              reminderSettingsState.finalReminderEnabled ?? true,
            finalPingTime: reminderSettingsState.finalPingTime || "11:00",
          };

          await prisma.aQReminderSettings.upsert({
            where: { allianceId: allianceToSave.id },
            create: {
              allianceId: allianceToSave.id,
              ...settingsToSave,
            },
            update: settingsToSave,
          });
          await showOverview(i);
        }
      } else if (action === "edit-bg") {
        const bg = parseInt(customIdParts[3], 10);
        const allianceData = await prisma.alliance.findUnique({
          where: { guildId: interaction.guildId! },
          include: { aqSchedules: { where: { battlegroup: bg } } },
        });
        editState = {
          role: allianceData?.aqSchedules[0]?.roleId,
          channel: allianceData?.aqSchedules[0]?.channelId,
          day1: allianceData?.aqSchedules.find((s) => s.aqDay === 1)?.dayOfWeek,
          day2: allianceData?.aqSchedules.find((s) => s.aqDay === 2)?.dayOfWeek,
          day3: allianceData?.aqSchedules.find((s) => s.aqDay === 3)?.dayOfWeek,
          day4: allianceData?.aqSchedules.find((s) => s.aqDay === 4)?.dayOfWeek,
        };
        const editContainer = await buildEditBgContainer(
          interaction,
          bg,
          editState
        );
        await i.editReply({ components: [editContainer] });
      } else if (action === "back") {
        await showOverview(i);
      } else if (action === "toggle-thread") {
        const allianceToUpdate = await prisma.alliance.findUnique({
          where: { guildId: interaction.guildId! },
        });
        if (allianceToUpdate) {
          await prisma.alliance.update({
            where: { id: allianceToUpdate.id },
            data: { createAqThread: !allianceToUpdate.createAqThread },
          });
        }
        await showOverview(i);
      } else if (action === "save") {
        const bg = parseInt(customIdParts[3], 10);
        const allianceToSave = await prisma.alliance.findUnique({
          where: { guildId: interaction.guildId! },
        });
        if (!allianceToSave) return;

        const { role, channel } = editState;
        const time =
          (
            await prisma.aQSchedule.findFirst({
              where: { allianceId: allianceToSave.id },
            })
          )?.time || "15:00";

        for (const dayKey of ["day1", "day2", "day3", "day4"]) {
          const aqDay = parseInt(dayKey.replace("day", ""), 10);
          const dayOfWeek = editState[dayKey];
          const existing = await prisma.aQSchedule.findFirst({
            where: { allianceId: allianceToSave.id, battlegroup: bg, aqDay },
          });

          if (
            dayOfWeek !== undefined &&
            dayOfWeek !== null &&
            dayOfWeek != -1
          ) {
            if (existing) {
              await prisma.aQSchedule.update({
                where: { id: existing.id },
                data: {
                  dayOfWeek: parseInt(dayOfWeek),
                  roleId: role,
                  channelId: channel,
                },
              });
            } else {
              await prisma.aQSchedule.create({
                data: {
                  allianceId: allianceToSave.id,
                  battlegroup: bg,
                  aqDay,
                  dayOfWeek: parseInt(dayOfWeek),
                  roleId: role,
                  channelId: channel,
                  time,
                },
              });
            }
          } else {
            if (existing) {
              await prisma.aQSchedule.delete({ where: { id: existing.id } });
            }
          }
        }
        await showOverview(i);
      } else if (i.isStringSelectMenu()) {
        const selectAction = customIdParts[2];
        const entity = customIdParts[3];
        const bg = parseInt(customIdParts[4], 10);
        editState[entity] = i.values[0];
        const editContainer = await buildEditBgContainer(
          interaction,
          bg,
          editState
        );
        await i.editReply({ components: [editContainer] });
      } else if (i.isButton()) {
        if (action === "edit-time") {
          const player = await prisma.player.findFirst({
            where: { discordId: i.user.id, isActive: true },
          });
          const timezone = player?.timezone || "UTC";

          const modal = new ModalBuilder()
            .setCustomId("interactive:aq-schedule:modal-time")
            .setTitle("Set AQ Start Time")
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId("time")
                  .setLabel(`Start Time (HH:mm in ${timezone})`)
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setPlaceholder("e.g., 15:00")
              )
            );
          await i.showModal(modal);
          try {
            const submitted = await i.awaitModalSubmit({ time: 60000 });
            if (submitted) {
              await submitted.deferUpdate();
              const timeInput = submitted.fields.getTextInputValue("time");
              const time = convertUserToUtcTime(timeInput, timezone);
              const allianceForTime = await prisma.alliance.findUnique({
                where: { guildId: i.guildId! },
              });
              if (allianceForTime) {
                await prisma.aQSchedule.updateMany({
                  where: { allianceId: allianceForTime.id },
                  data: { time },
                });
              }
              await showOverview(submitted);
            }
          } catch (err) {
            // Modal timed out
          }
        } else if (action === "skip") {
          const modal = new ModalBuilder()
            .setCustomId("interactive:aq-schedule:modal-skip")
            .setTitle("Skip AQ Schedule")
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId("duration")
                  .setLabel("Duration to skip for")
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setPlaceholder("e.g., 7d, 1w, 24h")
              )
            );
          await i.showModal(modal);
          try {
            const submitted = await i.awaitModalSubmit({ time: 60000 });
            if (submitted) {
              await submitted.deferUpdate();
              const durationString =
                submitted.fields.getTextInputValue("duration");
              const durationMs = parseDuration(durationString);
              if (!durationMs) {
                await submitted.followUp({
                  content: "Invalid duration format.",
                  flags: [MessageFlags.Ephemeral],
                });
                return;
              }
              const skipUntil = new Date(Date.now() + durationMs);
              const allianceForSkip = await prisma.alliance.findUnique({
                where: { guildId: interaction.guildId! },
              });
              if (allianceForSkip) {
                await prisma.aQSkip.upsert({
                  where: { allianceId: allianceForSkip.id },
                  update: { skipUntil },
                  create: { allianceId: allianceForSkip.id, skipUntil },
                });
              }
              await showOverview(submitted);
            }
          } catch (err) {
            // Modal timed out
          }
        }
      }
    } catch (err) {
      logger.error(err, "Error in AQ schedule interaction collector");
    }
  });

  collector.on("end", async () => {
    try {
      const container = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Menu has expired.")
      );
      await interaction.editReply({ components: [container] });
    } catch (err) {
      // Ignore if interaction expired or message was deleted
    }
  });
}