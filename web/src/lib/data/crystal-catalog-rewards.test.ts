import { beforeEach, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ relics: vi.fn(), champions: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { gameRelic: { findMany: db.relics }, champion: { findMany: db.champions } } }))
import { clearCache } from '@/lib/cache'
import { getCrystalPageRewards } from './crystal-catalog-rewards'
const portraits = 'https://storage.googleapis.com/champion-images/relics/'
const relics = [
 { id: 'relic_statcast_hulkling_crat', name: 'Piercing Cosmic Relic of Finesse', slug: 'hulkling-crat', portraitPath: portraits+'hulkling.png', class: 'COSMIC', rarities: [{ sourceRarityId: 't7', stars: 7 }] },
 { id: 'relic_statcast_hulkling_spdm', name: 'Piercing Cosmic Relic of Talent', slug: 'hulkling-spdm', portraitPath: portraits+'hulkling.png', class: 'COSMIC', rarities: [{ sourceRarityId: 't7', stars: 7 }] },
 { id: 'relic_statcast_hulkling_rese', name: 'Piercing Cosmic Relic of Insulation', slug: 'hulkling-rese', portraitPath: portraits+'hulkling.png', class: 'COSMIC', rarities: [{ sourceRarityId: 't7', stars: 7 }] },
]
beforeEach(() => { vi.clearAllMocks(); clearCache('', true); db.relics.mockResolvedValue(relics); db.champions.mockResolvedValue([]) })
it('resolves Statcast variants by exact relic ID and native rarity, binding them to their original category rate', async () => {
 const page = (await getCrystalPageRewards('7_star_relic_statcast_nexus_crystal'))!
 expect(page.selection).toEqual({draw:3,pick:1})
 expect(page.otherRewards.slice(0,3).map(r=>r.displayName)).toEqual(relics.map(r=>'7-Star '+r.name))
 expect(page.otherRewards.slice(0,3).map(r=>r.href)).toEqual(relics.map(r=>'/relics/'+r.slug+'?rarity=7'))
 expect(page.otherRewards.slice(0,3).every(r=>r.imageUrl===portraits+'hulkling.png' && r.quantity===1 && r.context?.rarity==='t7')).toBe(true)
 const rows = page.rewardPresentation.groups.flatMap(g=>g.rows)
 expect(rows).toHaveLength(1)
 expect(rows[0].rate.percentValue).toBe('100')
 expect(rows[0].variants).toHaveLength(3)
 expect(page.rewardPresentation.unrated).toHaveLength(117) // missing catalog rows stay unassigned
 expect(page.otherRewards.every(r=>!r.displayName?.startsWith('relic_'))).toBe(true)
 expect(db.relics).toHaveBeenCalledTimes(1)
 const query = db.relics.mock.calls[0][0]
 expect(query.where.isCurrent).toBe(true)
 expect(query.where.id.in).toHaveLength(120)
 expect(query.select.rarities.where).toEqual({isCurrent:true,selectable:true})
 expect(db.champions).not.toHaveBeenCalled()
})
it('does not invent rarity or a rate binding when the recorded rarity is absent from the relic catalog', async () => {
 db.relics.mockResolvedValue([{...relics[0],rarities:[{sourceRarityId:'t6',stars:6}]}])
 const page = (await getCrystalPageRewards('7_star_relic_statcast_nexus_crystal'))!
 expect(page.otherRewards[0]).toMatchObject({displayName:relics[0].name,href:'/relics/hulkling-crat'})
 expect(page.otherRewards[0].itemRarity).toBeUndefined()
 expect(page.rewardPresentation.groups[0].rows[0].variants).toEqual([])
})
it('reuses only an explicit blueprint-to-champion identity without promoting blueprints to champion drops', async () => {
 db.champions.mockResolvedValue([{gameId:'spidergwen',name:'Spider-Gwen',slug:'spider-gwen',class:'SCIENCE',images:{p_64:'https://storage.googleapis.com/champion-images/spidergwen.png'}}])
 const page = (await getCrystalPageRewards('2star_basichero_unified_meta_crystal'))!
 const blueprint = page.otherRewards.find(r=>r.type==='bp'&&r.gameId==='spidergwen')!
 expect(blueprint).toMatchObject({href:'/champions/spider-gwen',imageUrl:'https://storage.googleapis.com/champion-images/spidergwen.png',rarity:2,type:'bp'})
 expect(page.champions).toEqual([])
 expect(db.relics).not.toHaveBeenCalled()
})
it('does not query the catalogs for ordinary material crystals or unknown openings', async () => {
 expect(await getCrystalPageRewards('not-a-crystal')).toBeNull()
 expect((await getCrystalPageRewards('7star_rankup_gem_crystal_r4'))!.otherRewards).toHaveLength(6)
 expect(db.relics).not.toHaveBeenCalled();expect(db.champions).not.toHaveBeenCalled()
})
it('degrades to readable labels if the public catalog query is unavailable', async () => {
 db.relics.mockRejectedValue(new Error('catalog unavailable'))
 const page = (await getCrystalPageRewards('7_star_relic_statcast_nexus_crystal'))!
 expect(page.otherRewards[0]).toMatchObject({displayName:'Relic',href:null,imageUrl:null})
 expect(page.otherRewards[0].data).toBe('relic_statcast_hulkling_crat')
 expect(page.otherRewards).toHaveLength(120)
 expect(page.rewardPresentation.unrated).toHaveLength(120)
 expect(page.rewardPresentation.groups[0].rows[0].rate.percentValue).toBe('100')
})
