import { expect, it } from 'vitest'
import { loadCrystalPageRewards } from './crystal-page-rewards'
import { withCrystalChampionRateVisuals } from './crystal-champion-odds'
const id = 'vfh_ghostrider_reyes_all_rider_crystal'
const portrait = { gameId:'ghostrider_reyes', slug:'ghost-rider-robbie-reyes', portraitUrl:'/robbie.png' }
it('uses exact hero/cosmetic and native bonus bindings for named outcomes without changing overlapping source groups', () => {
 const page=loadCrystalPageRewards(id)!,before=JSON.stringify(page)
 const view=withCrystalChampionRateVisuals(page,[portrait])
 for(const key of ['0:0','0:1','0:2','1:4']) expect(view.oddsVisuals[key]).toMatchObject({imageUrl:'/robbie.png',href:'/champions/ghost-rider-robbie-reyes',kind:'champion'})
 expect(view.oddsVisuals['0:0'].rarity).toBe(7)
 expect(view.oddsVisuals['0:1'].rarity).toBe(6)
 expect(view.oddsVisuals['0:2'].rarity).toBe(5)
 expect(view.oddsVisuals['1:4'].rarity).toBe(7)
 expect(view.rewardPresentation.groups.find(g=>g.sourceIndex===1)!.rows.find(r=>r.key==='1:4')!.visual.imageUrl).toBe('/robbie.png')
 expect(view.oddsVisuals['1:0']).toMatchObject({imageUrl:null,href:null,kind:'champion',rarity:7})
 expect(view.oddsVisuals['1:1'].rarity).toBe(6)
 expect(view.oddsVisuals['1:2'].rarity).toBe(5)
 expect(view.oddsVisuals['1:3']).toMatchObject({imageUrl:null,href:null,rarity:7})
 expect(view.oddsVisuals['1:5']).toEqual(page.oddsVisuals['1:5'])
 expect(view.odds).toBe(page.odds)
 expect(view.rewardPresentation.championOdds).toBe(page.rewardPresentation.championOdds)
 expect(view.rewardPresentation.groups.flatMap(g=>g.rows.map(r=>r.rate))).toEqual(page.rewardPresentation.groups.flatMap(g=>g.rows.map(r=>r.rate)))
 expect(JSON.stringify(page)).toBe(before)
})
it('never borrows a portrait from an unrelated champion or ambiguous metadata', () => {
 const page=loadCrystalPageRewards(id)!
 const unrelated=withCrystalChampionRateVisuals(page,[{...portrait,gameId:'hulk'}])
 expect(unrelated.oddsVisuals['0:0']).toMatchObject({imageUrl:null,href:null,rarity:7})
 const ambiguous=withCrystalChampionRateVisuals(page,[portrait,{...portrait,portraitUrl:'/other.png'}])
 expect(ambiguous.oddsVisuals['0:0']).toMatchObject({imageUrl:null,href:null})
})
it('does not match partial cosmetic identities, missing bonuses or names alone', () => {
 const page=loadCrystalPageRewards(id)!
 const changed=structuredClone(page)
 const rows=changed.odds!.groups![0].rows
 rows[0].rewardData='ghostrider_reyes_t7|unreviewed_cosmetic'
 delete rows[1].rewardType;delete rows[1].rewardData
 changed.odds!.groups![1].rows[4].bonusRewardId='not-in-this-opening'
 const view=withCrystalChampionRateVisuals(changed,[portrait])
 for(const key of ['0:0','0:1','1:4']) expect(view.oddsVisuals[key].imageUrl).toBeNull()
})
