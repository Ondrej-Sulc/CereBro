import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../../services/prismaService";
import { DAY_OPTIONS } from "./utils";
import { convertUtcToUserTime } from "../../../utils/time";
import { getActivePlayer } from "../../../utils/playerHelper";

export async function buildOverviewContainer(
  interaction: ChatInputCommandInteraction | any
) {
  const { guildId, user } = interaction;
  const container = new ContainerBuilder();

  const player = await getActivePlayer(user.id);

  const allianceWhere =
    player?.allianceId && player.alliance?.guildId === guildId
      ? { id: player.allianceId }
      : { guildId };

  const alliance = await prisma.alliance.findFirst({
    where: allianceWhere,
    include: {
      aqSchedules: true,
      aqSkip: true,
      aqReminderSettings: true,
    },
  });

  if (!alliance) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "This server is not registered as an alliance."
      )
    );
    return container;
  }

  const timezone = player?.timezone || "UTC";
  const { aqSchedules, aqSkip, aqReminderSettings } = alliance;

  let time = "Not Set";
  let timeSuffix = "";
  if (aqSchedules.length > 0) {
    const firstTime = aqSchedules[0].time;
    if (aqSchedules.every((s) => s.time === firstTime)) {
      time = convertUtcToUserTime(firstTime, timezone);
      timeSuffix = timezone;
    } else {
      time = "Mixed";
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# 🗓️ AQ Schedule Overview for ${alliance.name}`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
  );

  // Battlegroup Sections first
  for (const bg of [1, 2, 3]) {
    const bgSchedules = aqSchedules.filter((s) => s.battlegroup === bg);
    let content = `## ⚔️ Battlegroup ${bg}\n`;
    if (bgSchedules.length === 0) {
      content += "No schedule set.";
    } else {
      const roleId = bgSchedules[0].roleId;
      const channelId = bgSchedules[0].channelId;
      content += `### Role: <@&${roleId}>  |  Channel: <#${channelId}>\n`;
      const days = DAY_OPTIONS.slice(0, 7)
        .map(({ label, value }) => {
          const sched = bgSchedules.find(
            (s) => s.dayOfWeek === parseInt(value)
          );
          return sched ? `**${label.slice(0, 3)}** *(D${sched.aqDay})*` : null;
        })
        .filter(Boolean)
        .join(", ");
      content += `### **Days:** ${days || "None"}`;
    }
    const bgSection = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`interactive:aq-schedule:edit-bg:${bg}`)
          .setLabel(`Edit BG ${bg}`)
          .setStyle(ButtonStyle.Secondary)
      );
    container.addSectionComponents(bgSection);
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
    );
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ⚙️ Settings`)
  );
  const timeSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### Start Time: 🕒 \`${time} ${timeSuffix}\``
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("interactive:aq-schedule:edit-time")
        .setLabel("Set Time")
        .setStyle(ButtonStyle.Secondary)
    );

  if (timezone === "UTC" && !player?.timezone) {
    timeSection.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "_Set your timezone with `/profile timezone` to see this in your local time._"
      )
    );
  }

  container.addSectionComponents(timeSection);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  let skipSection: SectionBuilder;
  if (aqSkip && aqSkip.skipUntil > new Date()) {
    const skipEnd = Math.floor(aqSkip.skipUntil.getTime() / 1000);
    skipSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### AQ Tracker is skipped until: ⏩ <t:${skipEnd}:F>`
        )
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId("interactive:aq-schedule:skip")
          .setLabel("Update Skip")
          .setStyle(ButtonStyle.Secondary)
      );
  } else {
    skipSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("### AQ Tracker is active. ✅")
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId("interactive:aq-schedule:skip")
          .setLabel("Skip Until...")
          .setStyle(ButtonStyle.Primary)
      );
  }
  skipSection.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "_Temporarily disable AQ tracker feature for a period of time, e.g., for Raids._"
    )
  );

  container.addSectionComponents(skipSection);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const createThreadSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Create AQ Thread:** ${
          alliance.createAqThread ? "✅ Enabled" : "❌ Disabled"
        }`
      ),
      new TextDisplayBuilder().setContent(
        "_Automatically create a thread for each AQ day's tracker._"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("interactive:aq-schedule:toggle-thread")
        .setLabel("Toggle")
        .setStyle(ButtonStyle.Secondary)
    );

  container.addSectionComponents(createThreadSection);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const reminderSettingsSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("**Reminders**"),
      new TextDisplayBuilder().setContent(
        "_Configure when and if reminders are sent for each section of Alliance Quest._"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("interactive:aq-schedule:edit-reminders")
        .setLabel("Reminder Settings")
        .setStyle(ButtonStyle.Success)
    );

  container.addSectionComponents(reminderSettingsSection);

  return container;
}
