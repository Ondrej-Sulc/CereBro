import {
  ContainerBuilder,
  GuildBasedChannel,
  MessageFlags,
  TextDisplayBuilder,
  User,
} from "discord.js";
import { CommandResult } from "../../types/command";
import { getState, setState } from "./state";

interface AQCoreEndParams {
  channel: GuildBasedChannel;
  user: User;
}

export async function handleEnd(
  params: AQCoreEndParams
): Promise<CommandResult> {
  const { channel, user } = params;
  const channelId = channel.id;
  const state = await getState(channelId);
  if (!state || state.status !== "active") {
    return {
      content: "No active AQ tracker in that channel.",
      flags: MessageFlags.Ephemeral,
    };
  }
  state.status = "ended_manual";
  await setState(channelId, state);
  const message = await (channel as any).messages.fetch(state.messageId);
  const endedContainer = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`AQ tracker manually ended by ${user}.`)
  );
  await message.edit({
    components: [endedContainer],
    flags: [MessageFlags.IsComponentsV2],
  });
  if (state.threadId) {
    const thread = await (channel as any).threads.fetch(state.threadId);
    if (thread) {
      await thread.setLocked(true);
    }
  }
  await setState(channelId, undefined);
  return { content: "AQ tracker ended.", flags: MessageFlags.Ephemeral };
}
