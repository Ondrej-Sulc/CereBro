import { describe, expect, it } from 'vitest';
import { groupRelicReviewVariants, selectRelicReviewBuild, sharedRelicReviewBuild, summarizeRelicReview, type RelicReviewRow } from './relic-screenshot-review';

function row(id: string, change: Partial<RelicReviewRow> = {}): RelicReviewRow {
  return { id, name:'Ant-Man', rating:1962, stars:6, awakened:true, className:'SCIENCE',
    bounds:{x:0,y:0,width:.1,height:.3}, imageUrl:'blob:example', fileName:'screenshot.png',
    matches:[{relicId:'ant',name:'Ant-Man',stars:6,rank:3,sigLevel:187,secondaryAttribute:null},
      {relicId:'ant',name:'Ant-Man',stars:6,rank:4,sigLevel:87,secondaryAttribute:null}],
    choice:null, included:false, skipped:false, ...change };
}
describe('screenshot review decisions', () => {
  const owned = {relicId:'ant',stars:6,rank:4,sigLevel:87,current:true,prestige:1962};
  it('reuses an exact owned build to resolve a rank/signature collision', () => {
    expect(selectRelicReviewBuild(row('ant'), [owned])).toEqual({choice:1,selectionSource:'collection'});
    expect(selectRelicReviewBuild(row('ant'), [])).toEqual({choice:null,selectionSource:null});
  });
  it.each([
    {relicId:'other'}, {stars:5}, {rank:5}, {sigLevel:88}, {current:false}, {prestige:null}, {prestige:1963},
  ])('does not reuse a different or stale saved build (%j)', change => {
    expect(selectRelicReviewBuild(row('ant'), [{...owned,...change}]).choice).toBeNull();
  });
  it('does not infer an unclear variant from which relics the player owns', () => {
    const base = row('unclear', {attributeStatus:'unclear'});
    const other = base.matches.map(m => ({...m,relicId:'other',secondaryAttribute:'Armor'}));
    const unclear = {...base,matches:[...base.matches,...other]};
    expect(selectRelicReviewBuild(unclear,[owned]).choice).toBeNull();
    expect(selectRelicReviewBuild(unclear,[owned],'ant')).toEqual({choice:1,selectionSource:'collection'});
    expect(selectRelicReviewBuild(unclear,[owned],'other').choice).toBeNull();
    expect(selectRelicReviewBuild({...unclear,attributeStatus:'conflict'},[owned],'ant').choice).toBeNull();
  });
  it('keeps rarity decisions open and does not assume a saved rank after progression changes', () => {
    const base = row('ant');
    expect(selectRelicReviewBuild({...base,stars:null,matches:[...base.matches,{...base.matches[1],stars:5}]},[owned]).choice).toBeNull();
    expect(selectRelicReviewBuild({...base,rating:2000,matches:base.matches.map(m=>({...m,sigLevel:m.sigLevel+1}))},[owned]).choice).toBeNull();
    expect(selectRelicReviewBuild({...base,matches:[]},[owned]).choice).toBeNull();
  });
  it('retains normal single-match selection and uses saved values only for one unambiguous owned build', () => {
    const single=row('single',{matches:[row('ant').matches[1]]});
    expect(selectRelicReviewBuild(single,[])).toEqual({choice:0,selectionSource:'screenshot'});
    expect(selectRelicReviewBuild({...single,attributeStatus:'unclear'},[owned]).choice).toBeNull();
    expect(selectRelicReviewBuild(row('ant'),[owned,{...owned,rank:3,sigLevel:187}]).choice).toBeNull();
  });
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
