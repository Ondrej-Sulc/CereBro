export type RecordingDraft = { id: string; file: File | null; url: string; description?: string };
export type RecordingUploadResult = { videoIds: string[]; fightIds: string[] };

export function createRecordingUploadState() {
  return { fights: new Map<string, string[]>(), recordings: new Map<string, RecordingUploadResult>() };
}

/** Resolve each fight group once, then append subsequent recordings without creating fights again. */
export async function submitRecordingGroups<G extends { id: string; recordings: { id: string }[] }>(
  groups: G[],
  state: ReturnType<typeof createRecordingUploadState>,
  submit: (recording: G['recordings'][number], group: G, fightIds: string[] | undefined, index: number, total: number) => Promise<RecordingUploadResult>,
) {
  const videoIds: string[] = [];
  const total = groups.reduce((sum, group) => sum + group.recordings.length, 0);
  let index = 0;
  for (const group of groups) {
    for (const recording of group.recordings) {
      index++;
      let result = state.recordings.get(recording.id);
      if (!result) {
        result = await submit(recording, group, state.fights.get(group.id), index, total);
        if (!result.fightIds?.length || !result.videoIds?.length) throw new Error('The server did not confirm the saved recording');
        state.fights.set(group.id, result.fightIds);
        state.recordings.set(recording.id, result);
      }
      videoIds.push(...result.videoIds);
    }
  }
  return [...new Set(videoIds)];
}
