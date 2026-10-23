import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EffectSources } from './effect-sources';
import type { ChampionKitEffect, ChampionKitSourceGroup } from '@/lib/champion-kit';

describe('recorded resistance values', () => {
  it('renders numeric context beside the preserved condition in the shared source component', () => {
    const effect: ChampionKitEffect = { name: 'Bleed', type: 'RESISTANCE', iconUrl: null, color: '#fff', secondaryColor: '#000', description: null, sources: [] };
    const groups: ChampionKitSourceGroup[] = [{ key: 'UNKNOWN:GAIN', effectForm: 'UNKNOWN', effectDirection: 'GAIN', synergies: [],
      nativeSources: [{ key: 'signature', label: 'Signature ability', condition: 'Incoming Bleed effects have reduced duration with his signature.', target: null,
        resistance: { mechanism: 'DURATION', percent: null }, values: [{ label: 'Sig 1', text: 'Incoming Bleed effects suffer -10.8% duration.' }] }] }];
    const html = renderToStaticMarkup(createElement(EffectSources, { effect, groups }));
    expect(html).toContain('data-resistance-values');
    expect(html).toContain('Sig 1');
    expect(html).toContain('-10.8% duration');
    expect(html).toContain('with his signature');
    expect(html).not.toContain('Immunity');
  });
});
