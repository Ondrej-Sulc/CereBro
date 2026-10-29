import { describe, expect, it, vi } from 'vitest';
import { submitRecordingGroups, createRecordingUploadState } from './war-recording-upload';

describe('recording batch uploads', () => {
  it('resolves a new fight once and attaches later recordings to the same fight IDs', async () => {
    const submit = vi.fn().mockResolvedValueOnce({ fightIds: ['saved-fight'], videoIds: ['one'] })
      .mockResolvedValueOnce({ fightIds: ['saved-fight'], videoIds: ['two'] });
    await submitRecordingGroups([{ id: 'fight', recordings: [{ id: 'first' }, { id: 'second' }] }], createRecordingUploadState(), submit);
    expect(submit.mock.calls.map(call => call[2])).toEqual([undefined, ['saved-fight']]);
  });

  it('retries only unfinished recordings after a partial failure', async () => {
    const groups = [{ id: 'fight', recordings: [{ id: 'first' }, { id: 'second' }] }];
    const state = createRecordingUploadState();
    const submit = vi.fn().mockResolvedValueOnce({ fightIds: ['saved-fight'], videoIds: ['one'] })
      .mockRejectedValueOnce(new Error('Quota exceeded'))
      .mockResolvedValueOnce({ fightIds: ['saved-fight'], videoIds: ['two'] });
    await expect(submitRecordingGroups(groups, state, submit)).rejects.toThrow('Quota exceeded');
    expect(await submitRecordingGroups(groups, state, submit)).toEqual(['one', 'two']);
    expect(submit).toHaveBeenCalledTimes(3);
    expect(submit.mock.calls[2][2]).toEqual(['saved-fight']);
  });
});
