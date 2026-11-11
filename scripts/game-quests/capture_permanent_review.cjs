const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve(process.env.REVIEW_OUT || 'temp/quest-explorer-review/permanent-20261109/review');
const origin = 'http://localhost:3011';
// Real viewport captures. Optional focused sections scroll the real page; no DOM restyling.
const captures = [
 ['catalog-desktop','Quest catalog - Desktop','/quests',1440,''],
 ['catalog-phone','Quest catalog - Phone','/quests',390,''],
 ['legacy-act','Legacy artwork - Desktop','/quests?category=Story&act=p_act1',1440,'[aria-label="Story chapters"]'],
 ['panorama-desktop','Chapter panorama - Desktop','/quests?category=Story&act=act_06',1440,'[aria-label="Story chapters"]'],
 ['panorama-phone','Chapter panorama - Phone','/quests?category=Story&act=act_06',390,'[aria-label="Story chapters"]'],
 ['panorama-tablet','Chapter panorama - Tablet','/quests?category=Story&act=act_06',768,'[aria-label="Story chapters"]'],
 ['boss-desktop','Chapter bosses - Desktop','/quests?category=Story&act=act_06&chapter=a06_ch02',1440,''],
 ['boss-phone','Chapter bosses - Phone','/quests?category=Story&act=act_06&chapter=a06_ch02',390,''],
 ['multiple-bosses','Multiple bosses - Phone','/quests?category=Story&act=act_07&chapter=a07_ch01',390,''],
 ['multiple-bosses320','Multiple bosses - Small phone','/quests?category=Story&act=act_07&chapter=a07_ch01',320,''],
 ['quest-header','Quest artwork - Desktop','/quests/a04_ch04_q06',1440,''],
 ['quest-header-phone','Quest artwork - Phone','/quests/a04_ch04_q06',390,''],
 ['rewards-phone','Rewards - Phone','/quests/a05_ch01_q01',390,'#quest-rewards'],
 ['defender-phone','Defender - Phone','/quests/a04_ch04_q06?node=24,1',390,'[aria-labelledby="coordinate-heading"]'],
 ['defender-desktop','Defender - Desktop','/quests/a04_ch04_q06?node=24,1',1440,'[aria-labelledby="coordinate-heading"]'],
 ['special-desktop','Special quests - Desktop','/quests?category=Special',1440,''],
 ['special-phone','Special quests - Phone','/quests?category=Special',390,''],
 ['road-map','Road map - Desktop','/quests/roadtolabyrinth_ch1_quest_1',1440,'[aria-labelledby="quest-map-heading"]'],
 ['mausoleum-map','Mausoleum - Phone','/quests/me_mausoleum_ch01_q01',390,'[aria-labelledby="quest-map-heading"]'],
 ['realm-map','Realm - Desktop','/quests/eq_legends_e',1440,'[aria-labelledby="quest-map-heading"]'],
 ['node-desktop','Node application - Desktop','/quests/a05_ch01_q01?node=10,21&application=10,21:defender:0',1440,'[aria-labelledby="coordinate-heading"]'],
 ['node-phone','Node application - Phone','/quests/a05_ch01_q01?node=10,21&application=10,21:defender:0',390,'[aria-labelledby="coordinate-heading"]'],
 ['towers-desktop','Permanent Towers - Desktop','/quests/towers',1440,''],
 ['towers-phone','Permanent Towers - Phone','/quests/towers',390,''],
 ['tower-detail','Tower definition - Phone','/quests/towers/class_skill',390,''],
 ['npc-bosses','Native NPC bosses - Phone','/quests?category=Story&act=act4&chapter=a04_ch04',390,'article:has(a[href="/quests/a04_ch04_q06"])'],
 ['archive-phone','Archived link - Phone','/quests/pve_nov2026_1_prg4',390,''],
 ['portal-phone','Portal map - Phone','/quests/a05_ch01_q01?node=10,21',320,'[aria-labelledby="quest-map-heading"]'],
 ['summary-phone','Summary - Phone','/quests/epilogue_ch01_q01',390,''],
 ['expanded-catalog-desktop','Quest catalog - Desktop','/quests?category=Special',1280,'main section:has(h2)'],
 ['expanded-catalog-phone','Quest catalog - Phone','/quests?category=Special',390,'main section:has(h2)'],
 ['expanded-chapters-desktop','Story chapters - Desktop','/quests?category=Story&act=act_08',1280,'[aria-label="Story chapters"]'],
 ['expanded-chapters-phone','Story chapters - Phone','/quests?category=Story&act=act_08',390,'[aria-label="Story chapters"]'],
 ['epoch-header-desktop','Quest artwork - Desktop','/quests/me_pain2024_fin_quest',1280,''],
 ['epoch-header-phone','Quest artwork - Phone','/quests/me_pain2024_fin_quest',390,''],
 ['epoch-map-desktop','Map and route - Desktop','/quests/me_pain2024_fin_quest',1280,'[aria-labelledby="quest-map-heading"]','fit'],
 ['epoch-map-phone','Map and route - Phone','/quests/me_pain2024_fin_quest',390,'[aria-labelledby="quest-map-heading"]'],
 ['ares-desktop','Native defender - Desktop','/quests/me_pain2024_fin_quest?node=27,5',1280,'[aria-labelledby="quest-map-heading"]','fit'],
 ['ares-phone','Native defender - Phone','/quests/me_pain2024_fin_quest?node=27,5',390,'[aria-labelledby="coordinate-heading"]'],
 ['crucible-desktop','Crucible map - Desktop','/quests/me_crucible_ch02_q02',1280,'[aria-labelledby="quest-map-heading"]','fit'],
 ['crucible-phone','Crucible map - Phone','/quests/me_crucible_ch02_q02',390,'[aria-labelledby="quest-map-heading"]'],
 ['shooting-bosses-desktop','Quest bosses - Desktop','/quests?category=Special&collection=pve_may2023_shootingstars&chapter=pve_may2023_shootingstar_ch1',1280,'article'],
 ['shooting-bosses-phone','Quest bosses - Phone','/quests?category=Special&collection=pve_may2023_shootingstars&chapter=pve_may2023_shootingstar_ch1',390,'article'],
 ['shooting-bosses320','Quest bosses - Small phone','/quests?category=Special&collection=pve_may2023_shootingstars&chapter=pve_may2023_shootingstar_ch1',320,'article'],
 ['road-final-phone','Road final round - Phone','/quests/roadtolabyrinth_ch4_quest_6',390,'[aria-labelledby="quest-map-heading"]'],
 ['story9-phone','Story Act 9 - Phone','/quests/a09_ch04_q06',390,'[aria-labelledby="quest-map-heading"]'],
 ['abyss-desktop','Abyss saved preview - Desktop','/quests/realm3',1280,'[data-encounter-coverage]','fit'],
 ['abyss-phone','Abyss saved preview - Phone','/quests/realm3',390,'[data-encounter-coverage]'],

];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const records=[],errors=[];
 const selected=process.env.CAPTURE_NAMES?.split(',');
 try {
  const context=await browser.newContext(); const page=await context.newPage();
  page.on('pageerror',e=>errors.push({message:e.message,stack:e.stack,url:page.url()}));
  for(const [name,label,route,width,selector,mode] of captures){
   if(selected&&!selected.includes(name))continue;
   await page.setViewportSize({width,height:1000});
   const response=await page.goto(origin+route,{waitUntil:'networkidle',timeout:120000}); assert.equal(response.status(),200,route);if(selector)assert(await page.locator(selector).count(),name+': missing focused section');if(await page.locator('[data-board-ready]').count())await page.waitForSelector('[data-board-ready="true"]');if(mode==='fit')await page.getByRole('button',{name:'Fit map',exact:true}).click();
   await page.evaluate(async selector=>{await document.fonts.ready;const target=selector?document.querySelector(selector):null;window.scrollTo({top:target?Math.max(0,target.getBoundingClientRect().top+scrollY-82):0,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all([...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).map(i=>i.decode().catch(()=>{})));},selector);
   const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollY,images:[...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).map(i=>({src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0}))}));
   assert(metrics.scrollWidth<=width,`${name}: overflow`);assert(metrics.images.every(i=>i.loaded),`${name}: image failed`);
   const mapStats=await page.evaluate(async()=>({placements:document.querySelectorAll('[data-map-encounter]').length,portraits:document.querySelectorAll('[data-map-portrait]').length,zoom:document.querySelector('[data-zoom]')?.getAttribute('data-zoom'),portraitImages:await Promise.all([...new Set([...document.querySelectorAll('[data-map-portrait]')].map(i=>i.getAttribute('href')))].map(src=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve({src,loaded:i.naturalWidth>0});i.onerror=()=>resolve({src,loaded:false});i.src=src;})))}));assert(mapStats.portraitImages.every(i=>i.loaded),`${name}: map portrait failed`);const image=path.join(out,name+'.png');await page.screenshot({path:image,fullPage:false});records.push({name,label,route,image,...metrics,...mapStats});console.log(name);
  }
  const checks=[];
  await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/quests?category=Story&act=act_06',{waitUntil:'networkidle'});
  const rail=page.getByLabel('Story chapters');assert.equal(await rail.locator('a').count(),4);
  const panels=await rail.locator('a').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect(),i=e.querySelector('img'),r=i.getBoundingClientRect(),css=getComputedStyle(i);return {left:b.left,right:b.right,top:r.top,height:r.height,fit:css.objectFit,position:css.objectPosition,index:e.dataset.chapterIndex}}));
  assert.deepEqual(panels.map(p=>p.index),['1','2','3','4']);panels.forEach((p,i)=>{assert(p.height<=340);assert.equal(p.fit,'cover');assert.equal(p.position,panels[0].position);assert(Math.abs(p.top-panels[0].top)<1);if(i){const gap=p.left-panels[i-1].right;assert(gap>=0&&gap<=9)}});await page.setViewportSize({width:1024,height:1000});assert(await rail.evaluate(e=>e.scrollWidth<=e.clientWidth));assert(await rail.locator('a').last().evaluate(e=>e.getBoundingClientRect().right<=innerWidth));checks.push('native chapter order, ordered panel gutters, consistent crop and all desktop choices visible');await page.setViewportSize({width:1440,height:1000});
  await page.goto(origin+'/quests?category=Story&act=p_act1',{waitUntil:'networkidle'});assert((await page.getByLabel('Story chapters').locator('a').boundingBox()).width<=580);await page.goto(origin+'/quests?category=Story&act=act_06',{waitUntil:'networkidle'});checks.push('single early-act chapter choice stays compact');
  await rail.locator('a').nth(1).focus();await page.keyboard.press('Enter');await page.waitForURL(u=>u.searchParams.get('chapter')==='a06_ch02');await page.waitForFunction(()=>document.querySelectorAll('main article').length===6);assert.equal(await page.locator('main article').count(),6);assert((await page.locator('main article figure').count())>=6);checks.push('keyboard chapter drill-down and explicit boss cards');
  await page.getByRole('searchbox').fill('Mistrust');await page.getByRole('button',{name:'Search',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('q')==='Mistrust');await page.waitForFunction(()=>document.querySelectorAll('main article').length===1);assert.equal(await page.locator('main article').count(),1);await page.goBack({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('main article').length===6);assert.equal(await page.locator('main article').count(),6);checks.push('scope-preserving GET search and browser history');
  await page.goto(origin+'/quests?category=Special',{waitUntil:'networkidle'});assert.equal(await page.getByRole('link',{name:/Permanent Special quest/}).count(),13);assert.equal(await page.getByRole('link',{name:'Daily',exact:true}).count(),0);checks.push('exact permanent Special collections without transient categories');
  await page.goto(origin+'/quests/a05_ch01_q01?node=10,21&application=10,21:defender:0',{waitUntil:'networkidle'});const app=page.locator('[data-quest-application="10,21:defender:0"]');assert(await app.getAttribute('open')!==null);const icon=app.locator('[data-native-modifier-icon]');assert.equal(await icon.count(),1);const mask=await icon.evaluate(e=>getComputedStyle(e).maskImage);assert(mask.includes('/node-modifiers/icons/'));const src=mask.slice(5,-2);assert.equal((await page.request.get(src)).status(),200);await app.getByRole('link',{name:'Link to this application'}).click();await page.waitForURL(u=>u.searchParams.has('sourceHash'));assert.equal(new URL(page.url()).searchParams.get('application'),'10,21:defender:0');assert(await page.locator('[data-quest-application="10,21:defender:0"]').getAttribute('open')!==null);checks.push('verified native mask and exact source/application deep link');
  await page.goto(origin+'/quests/a05_ch01_q01?node=10,21&application=10,21:defender:0&sourceHash=stale',{waitUntil:'networkidle'});assert((await page.locator('main').innerText()).includes('another saved source version'));checks.push('stale source link is explicit');
  await page.goto(origin+'/quests/pve_nov2026_1_prg4',{waitUntil:'networkidle'});assert((await page.locator('main').innerText()).includes('Outside the permanent collection'));assert.equal(await page.locator('[data-map-encounter]').count(),0);checks.push('archived direct URL has truthful scope handling');
  await page.goto(origin+'/quests/towers',{waitUntil:'networkidle'});assert.equal(await page.locator('main a[href^="/quests/towers/"]').count(),6);assert(!(await page.locator('main').innerText()).includes('1606'));checks.push('six permanent Towers, no inferred per-Tower totals');
  await page.goto(origin+'/quests/roadtolabyrinth_ch1_quest_1',{waitUntil:'networkidle'});await page.waitForSelector('[data-board-ready="true"]');assert.equal(await page.locator('[data-map-encounter]').count(),JSON.parse(fs.readFileSync('src/data/game-quests/permanent.json','utf8')).maps.roadtolabyrinth_ch1_quest_1.placedEncounters);checks.push('new Special map renders exact placed references');
  await page.setViewportSize({width:320,height:1000});await page.goto(origin+'/quests?category=Story&act=act_06',{waitUntil:'networkidle'});
  const phoneRail=page.getByLabel('Story chapters');await phoneRail.locator('a').last().focus();await phoneRail.locator('a').last().scrollIntoViewIfNeeded();assert(await phoneRail.evaluate(e=>e.scrollLeft)>0);await page.keyboard.press('Enter');await page.waitForURL(u=>u.searchParams.get('chapter')==='a06_ch04');checks.push('phone chapter rail scroll and keyboard destination');
  await page.goto(origin+'/quests?category=Story&act=act_07&chapter=a07_ch01',{waitUntil:'networkidle'});const multiple=page.locator('main article').first();assert.equal(await multiple.locator('figure').count(),3);const portraitBoxes=await multiple.locator('figure').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert(Math.max(...portraitBoxes)-Math.min(...portraitBoxes)<1);assert((await multiple.locator('h3').boundingBox()).height<70);checks.push('three exact bosses share one readable small-phone card');
  await page.goto(origin+'/quests?category=Story&act=act4&chapter=a04_ch04',{waitUntil:'networkidle'});const npc=page.locator('article:has(a[href="/quests/a04_ch04_q06"])');assert((await npc.innerText()).includes('MAESTRO'));assert.equal(await npc.locator('img[src*="permanent-art"]').count(),1);assert.equal(await npc.locator('a[href^="/champions/"]').count(),0);checks.push('native NPC portrait retains exact identity without a playable alias');
  const prior=selected&&fs.existsSync(path.join(out,'review.json'))?JSON.parse(fs.readFileSync(path.join(out,'review.json'),'utf8')):null;
  await page.goto(origin+'/quests/a04_ch04_q06?node=24,1',{waitUntil:'networkidle'});await page.waitForSelector('[data-board-ready="true"]');assert.equal(await page.locator('[data-map-portrait="maestro"]').count(),1);assert.equal(await page.locator('a[href="/champions/maestro"]').count(),0);assert.equal(await page.locator('[aria-labelledby="coordinate-heading"] [data-quest-portrait="resolved"]').count(),1);checks.push('source-bound NPC art renders on map and inspector without a playable link');
  await page.setViewportSize({width:1280,height:1000});await page.goto(origin+'/quests/me_pain2024_fin_quest',{waitUntil:'networkidle'});await page.waitForSelector('[data-board-ready="true"]');assert.equal(await page.locator('[data-map-encounter]').count(),25);assert.equal(await page.locator('[data-map-portrait]').count(),25);await page.getByRole('button',{name:'Fit map',exact:true}).click();const ares=page.locator('[data-map-encounter]:has([data-map-portrait="ares"])');await ares.focus();await page.keyboard.press('Enter');assert((await page.locator('[aria-labelledby="coordinate-heading"]').innerText()).includes('ARES'));assert((await page.locator('[aria-labelledby="coordinate-heading"]').innerText()).includes('Shared by paths 1, 2, 3, 4, 5, 6'));assert.equal(await page.locator('[aria-labelledby="coordinate-heading"] a[href^="/champions/"]').count(),0);await page.getByLabel('Authored path').selectOption('1');assert.equal(await page.locator('[role="group"][aria-label="Quest map, path 2 highlighted"]').count(),1);await page.getByRole('button',{name:'Zoom in',exact:true}).click();const viewport=page.getByRole('region',{name:'Scrollable quest coordinate map',exact:true});await viewport.focus();await page.keyboard.press('ArrowDown');assert(await viewport.evaluate(e=>e.scrollTop)>0);checks.push('new Special keyboard selection, exact Ares art/shared paths, route change and keyboard pan');
  await page.goto(origin+'/quests/me_crucible_ch02_q02',{waitUntil:'networkidle'});await page.waitForSelector('[data-board-ready="true"]');assert.equal(await page.locator('[data-map-encounter]').count(),64);assert.equal(await page.locator('[data-map-portrait]').count(),64);checks.push('dense Crucible map displays every exact placement portrait');
  await page.goto(origin+'/quests/me_pain2024_fin_quest?node=12,32',{waitUntil:'networkidle'});const superiority=page.locator('[data-quest-application] > summary').filter({hasText:'Superiority: Paragon'});assert.equal(await superiority.count(),1);assert(!(await superiority.innerText()).includes('[fcf000]'));checks.push('native application color markup is presentation-only and absent from visible titles');
  await page.goto(origin+'/quests/epilogue_ch01_q01',{waitUntil:'networkidle'});assert((await page.locator('main').innerText()).includes('Summary only'));assert.equal(await page.locator('[data-map-encounter]').count(),0);checks.push('Act 10 summary remains useful without invented geometry or encounters');
  await page.goto(origin+'/quests/realm3',{waitUntil:'networkidle'});assert((await page.locator('[data-encounter-coverage]').innerText()).includes('only the final-boss placement'));assert.equal(await page.locator('[data-map-encounter]').count(),1);checks.push('Abyss saved-layout coverage explicitly retains the final-boss-only placement observation');
  const combined=prior?[...prior.captures.map(c=>records.find(n=>n.name===c.name)||c),...records.filter(n=>!prior.captures.some(c=>c.name===n.name))]:records;
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({captures:combined,errors,checks,panels},null,2));assert.deepEqual(errors,[]);
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
