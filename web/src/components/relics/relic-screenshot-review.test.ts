import { describe, expect, it } from 'vitest';
import { groupRelicReviewVariants, sharedRelicReviewBuild, summarizeRelicReview, type RelicReviewRow } from './relic-screenshot-review';

function row(id: string, change: Partial<RelicReviewRow> = {}): RelicReviewRow {
  return { id, name:'Ant-Man', rating:1962, stars:6, awakened:true, className:'SCIENCE',
    bounds:{x:0,y:0,width:.1,height:.3}, imageUrl:'blob:example', fileName:'screenshot.png',
    matches:[{relicId:'ant',name:'Ant-Man',stars:6,rank:3,sigLevel:187,secondaryAttribute:null},
      {relicId:'ant',name:'Ant-Man',stars:6,rank:4,sigLevel:87,secondaryAttribute:null}],
    choice:null, included:false, skipped:false, ...change };
}
describe('screenshot review decisions', () => {
  it('offers one variant choice across rarities while preserving exact match indices for saving', () => {
    const base = row('sample').matches[0];
    const matches = [
      {...base, relicId:'armor', stars:7, rank:1, sigLevel:0, secondaryAttribute:'Armor'},
      {...base, relicId:'energy', stars:7, rank:1, sigLevel:0, secondaryAttribute:'Energy Resistance'},
      {...base, relicId:'armor', stars:6, rank:4, sigLevel:100, secondaryAttribute:'Armor'},
    ];
    const variants = groupRelicReviewVariants(matches);
    expect(variants.map(v => [v.relicId, v.choices.map(c => c.index)])).toEqual([['armor',[0,2]],['energy',[1]]]);
    expect(variants[1].choices[0].match).toEqual(matches[1]);
    expect(sharedRelicReviewBuild(matches)).toBeNull();
  });
  it('shows a shared build once when only the variant needs a decision', () => {
    const base = {...row('sample').matches[0], stars:7, rank:1, sigLevel:0};
    const matches = ['Armor','Physical Penetration','Energy Resistance'].map(attribute => ({...base, relicId:attribute, secondaryAttribute:attribute}));
    expect(sharedRelicReviewBuild(matches)).toEqual({stars:7,rank:1,sigLevel:0});
    expect(sharedRelicReviewBuild([])).toBeNull();
    expect(sharedRelicReviewBuild([...matches,{...base, sigLevel:1}])).toBeNull();
  });
  it('separates choices, unmatched, ready and explicitly skipped cards without losing their order', () => {
    const summary = summarizeRelicReview([row('ready',{choice:1,included:true}),row('pick'),row('missing',{matches:[]}),row('skip',{skipped:true})]);
    expect(summary.decisions.map(r=>r.id)).toEqual(['pick']);
    expect(summary.unmatched.map(r=>r.id)).toEqual(['missing']);
    expect(summary.ready.map(r=>r.id)).toEqual(['ready']);
    expect(summary.skipped.map(r=>r.id)).toEqual(['skip']);
    expect(summary.uniqueCount).toBe(1);
  });
  it('counts overlapping identical cards once for saving, while keeping both source cards visible', () => {
    const summary = summarizeRelicReview([row('a',{choice:1,included:true}),row('b',{choice:1,included:true})]);
    expect(summary.ready).toHaveLength(2);
    expect(summary.uniqueCount).toBe(1);
    expect(summary.conflictIds.size).toBe(0);
  });
  it('moves conflicting selected builds into decisions and clears the conflict when one is left out', () => {
    const a=row('a',{choice:0,included:true}),b=row('b',{choice:1,included:true});
    const summary=summarizeRelicReview([a,b]);
    expect([...summary.conflictIds]).toEqual(['a','b']);
    expect(summary.decisions).toHaveLength(2);
    expect(summary.ready).toHaveLength(0);
    const resolved=summarizeRelicReview([a,{...b,skipped:true,included:false}]);
    expect(resolved.conflictIds.size).toBe(0);
    expect(resolved.ready).toHaveLength(1);
    expect(resolved.selected).toHaveLength(1);
  });
  it('does not conflate different Statcast variants or rarities', () => {
    const a=row('a',{choice:0,included:true});
    const b=row('b',{choice:0,included:true,matches:[{...a.matches[0],relicId:'other'}]});
    const c=row('c',{choice:0,included:true,matches:[{...a.matches[0],stars:5}]});
    expect(summarizeRelicReview([a,b,c]).uniqueCount).toBe(3);
  });
});
