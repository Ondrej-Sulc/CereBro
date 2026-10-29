'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowUp, ArrowDown, Plus, X } from 'lucide-react';
import type { RecordingDraft } from '@/lib/war-recording-upload';

export function RecordingInputs({ recordings, onChange, sourceMode, allowMultiple = true, savedIds = [] }: {
  recordings: RecordingDraft[];
  onChange: (recordings: RecordingDraft[]) => void;
  sourceMode: 'upload' | 'link';
  allowMultiple?: boolean;
  savedIds?: string[];
}) {
  const update = (index: number, changes: Partial<RecordingDraft>) =>
    onChange(recordings.map((recording, i) => i === index ? { ...recording, ...changes } : recording));
  const move = (index: number, offset: number) => {
    const next = [...recordings];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return <div className="space-y-3">
    {recordings.map((recording, index) => <div key={recording.id} className="space-y-2 rounded-lg border border-slate-700/50 bg-slate-950/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`recording-${recording.id}`} className="text-sm text-slate-300">
          {allowMultiple ? `Video ${index + 1}` : 'Video source'}{savedIds.includes(recording.id) && ' · Saved'}
        </Label>
        {allowMultiple && <div className="flex shrink-0">
          <Button type="button" size="icon" variant="ghost" aria-label={`Move video ${index + 1} up`} disabled={index === 0 || savedIds.length > 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Move video ${index + 1} down`} disabled={index === recordings.length - 1 || savedIds.length > 0} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Remove video ${index + 1}`} disabled={recordings.length === 1 || savedIds.includes(recording.id)} onClick={() => onChange(recordings.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button>
        </div>}
      </div>
      {sourceMode === 'upload' ? <Input key="file" id={`recording-${recording.id}`} type="file" accept="video/*" multiple={allowMultiple}
        disabled={savedIds.includes(recording.id)}
        onChange={event => {
          const files = Array.from(event.target.files || []);
          if (!files.length) return;
          const next = recordings.map((item, i) => i === index ? { ...item, file: files[0] || null } : item);
          next.splice(index + 1, 0, ...files.slice(1).map(file => ({ id: crypto.randomUUID(), file, url: '' })));
          onChange(next);
        }} /> : <Input key="url" id={`recording-${recording.id}`} type="url" value={recording.url}
          disabled={savedIds.includes(recording.id)} placeholder="https://www.youtube.com/watch?v=..."
          onChange={event => update(index, { url: event.target.value })} required />}
      {sourceMode === 'upload' && recording.file && <p className="break-all text-xs text-sky-300">{recording.file.name}</p>}
      {allowMultiple && <Textarea aria-label={`Video ${index + 1} description`} value={recording.description || ''}
        disabled={savedIds.includes(recording.id)} placeholder="Video description (optional)" rows={2}
        onChange={event => update(index, { description: event.target.value })} />}
    </div>)}
    {allowMultiple && <Button type="button" variant="outline" className="w-full" onClick={() => onChange([...recordings, { id: crypto.randomUUID(), file: null, url: '' }])}>
      <Plus className="mr-2 h-4 w-4" /> Add another video
    </Button>}
  </div>;
}
