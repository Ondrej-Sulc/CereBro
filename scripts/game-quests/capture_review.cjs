const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve('temp/quest-explorer-review/authored-art/review');
const origin = 'http://localhost:3011';
// Real viewport captures. Optional focused sections scroll the real page; no DOM restyling.
const captures = [
 ['catalog-desktop','Quest catalog - Desktop','/quests',1440,''],
 ['catalog-phone','Quest catalog - Phone','/quests',390,''],
 ['chapters-desktop','Story chapters - Desktop','/quests?category=Story&act=act4',1440,''],
 ['quests-desktop','Quest selection - Desktop','/quests?category=Story&act=act4&chapter=a04_ch04',1440,''],
 ['quests-phone','Quest selection - Phone','/quests?category=Story&act=act4&chapter=a04_ch04',390,''],
 ['mixed-desktop','Event variants - Desktop','/quests?category=StoryEvent',1440,''],
 ['quest-header-desktop','Quest artwork - Desktop','/quests/a04_ch04_q06?node=24,1',1440,''],
 ['quest-header-phone','Quest artwork - Phone','/quests/a04_ch04_q06?node=24,1',390,''],
 ['event-variant-phone','Event variant artwork - Phone','/quests/pve_nov2026_1_prg2',390,''],
 ['event-header-phone','Event artwork - Phone','/quests/pve_nov2026_1_prg4',390,''],
 ['summary-desktop','Summary and artwork - Desktop','/quests/a05_ch01_q02',1440,''],
 ['simple-tablet','Simple map - Tablet','/quests/p01_ch01_q01?node=4,15',768,'[aria-labelledby="quest-map-heading"]'],
 ['map-desktop','Map and defenders - Desktop','/quests/a05_ch01_q01?node=10,21',1440,'[aria-labelledby="quest-map-heading"]'],
 ['map-phone','Map explorer - Phone','/quests/a05_ch01_q01?node=10,21',390,'[aria-labelledby="quest-map-heading"]'],
 ['map-phone-fit','Map overview - Phone','/quests/a05_ch01_q01?node=10,21',390,'[aria-labelledby="quest-map-heading"]','fit'],
 ['dense-desktop','Dense map - Desktop','/quests/a04_ch02_q06',1440,'[aria-labelledby="quest-map-heading"]'],
 ['dense-phone','Dense map - Phone','/quests/a04_ch02_q06',320,'[aria-labelledby="quest-map-heading"]'],
 ['boss-desktop','Shared boss - Desktop','/quests/a04_ch04_q01?node=24,16',1440,'[aria-labelledby="quest-map-heading"]'],
 ['npc-desktop','NPC defender - Desktop','/quests/a04_ch04_q06?node=24,1',1440,'[aria-labelledby="quest-map-heading"]'],
 ['npc-phone','NPC defender - Phone','/quests/a04_ch04_q06?node=24,1',390,'[aria-labelledby="coordinate-heading"]'],
 ['rewards-desktop','Rewards - Desktop','/quests/a05_ch01_q01?node=10,21',1440,'#quest-rewards'],
 ['rewards-phone','Rewards - Phone','/quests/a05_ch01_q01?node=10,21',390,'#quest-rewards'],
 ['summary-phone','Quest summary - Phone','/quests/a05_ch01_q02',390,''],
];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const records=[],errors=[];
 try {
  const context=await browser.newContext(); const page=await context.newPage();
  page.on('pageerror',e=>errors.push({message:e.message,stack:e.stack,url:page.url()}));
  for(const [name,label,route,width,selector,mode] of captures){
   await page.setViewportSize({width,height:1000});
   const response=await page.goto(origin+route,{waitUntil:'networkidle',timeout:120000}); assert.equal(response.status(),200,route);if(await page.locator('[data-board-ready]').count())await page.waitForSelector('[data-board-ready="true"]');if(mode==='fit')await page.getByRole('button',{name:'Fit map',exact:true}).click();
   await page.evaluate(async selector=>{await document.fonts.ready;const target=selector?document.querySelector(selector):null;window.scrollTo({top:target?Math.max(0,target.getBoundingClientRect().top+scrollY-82):0,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all([...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).map(i=>i.decode().catch(()=>{})));},selector);
   const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollY,images:[...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).map(i=>({src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0}))}));
   assert(metrics.scrollWidth<=width,`${name}: overflow`);assert(metrics.images.every(i=>i.loaded),`${name}: image failed`);
   const mapStats=await page.evaluate(async()=>({placements:document.querySelectorAll('[data-map-encounter]').length,portraits:document.querySelectorAll('[data-map-portrait]').length,zoom:document.querySelector('[data-zoom]')?.getAttribute('data-zoom'),portraitImages:await Promise.all([...new Set([...document.querySelectorAll('[data-map-portrait]')].map(i=>i.getAttribute('href')))].map(src=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve({src,loaded:i.naturalWidth>0});i.onerror=()=>resolve({src,loaded:false});i.src=src;})))}));assert(mapStats.portraitImages.every(i=>i.loaded),`${name}: map portrait failed`);const image=path.join(out,name+'.png');await page.screenshot({path:image,fullPage:false});records.push({name,label,route,image,...metrics,...mapStats});console.log(name);
  }
  // Native GET drill-down, correlated membership, search, pagination and history.
  await page.goto(origin+'/quests',{waitUntil:'networkidle'});
  await page.getByRole('link').filter({hasText:'Story act 4'}).click(); await page.waitForURL(u=>u.searchParams.get('act')==='act4');
  await page.getByRole('link').filter({hasText:'Devastation'}).click();await page.waitForURL(u=>u.searchParams.get('chapter')==='a04_ch04');
  assert.equal(await page.locator('main article').count(),6);
  await page.getByRole('searchbox').fill('Allegiances');await page.getByRole('button',{name:'Search',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('q')==='Allegiances');assert.equal(await page.locator('main article').count(),1);
  await page.goBack({waitUntil:'networkidle'});await page.waitForURL(u=>u.searchParams.get('chapter')==='a04_ch04'&&!u.searchParams.get('q'));assert.equal(await page.locator('main article').count(),6);
  await page.goto(origin+'/quests?category=Story&coverage=full-map&page=2',{waitUntil:'networkidle'});await page.getByRole('link',{name:'Next',exact:false}).click();await page.waitForURL(u=>u.searchParams.get('page')==='3');assert.equal(new URL(page.url()).searchParams.get('coverage'),'full-map');
  await page.goto(origin+'/quests/a05_ch01_q01?path=2&node=14,26',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Portal ↗ (10, 23)'}).click();assert.equal(await page.locator('#coordinate-heading').innerText(),'(10, 23)');await page.getByLabel('Zoom in').click();assert(Number(await page.locator('svg[data-zoom]').getAttribute('data-zoom'))>0.8);
  await page.getByLabel('Authored path').selectOption('1');await page.getByRole('heading',{name:'Path 2 · Encounter order'}).waitFor();await page.getByLabel('Route coordinate',{exact:true}).selectOption('1');assert(await page.locator('#coordinate-heading').innerText());
  await page.getByRole('button',{name:'Toggle map overview'}).click();await page.getByRole('img',{name:'Map overview'}).waitFor();await page.getByRole('button',{name:'Toggle map overview'}).click();assert.equal(await page.locator('[data-map-encounter]').count(),20);assert.equal(await page.locator('[data-map-portrait]').count(),20);const mapNode=page.locator('[data-map-encounter]').first();await mapNode.focus();await page.keyboard.press('Enter');assert.equal(await mapNode.getAttribute('aria-pressed'),'true');
  const viewport=page.getByRole('region',{name:'Scrollable quest coordinate map'});await viewport.evaluate(e=>e.scrollTo(0,0));await viewport.focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.querySelector('[aria-label="Scrollable quest coordinate map"]').scrollTop>0);const priorPan=await viewport.evaluate(e=>e.scrollTop);const bounds=await viewport.boundingBox();await page.mouse.move(bounds.x+30,bounds.y+180);await page.mouse.down();await page.mouse.move(bounds.x+30,bounds.y+100,{steps:8});await page.mouse.up();assert((await viewport.evaluate(e=>e.scrollTop))>priorPan,'mouse drag pans the map');
  await page.goto(origin+'/quests/a04_ch04_q06?node=24,1',{waitUntil:'networkidle'});assert.equal(await page.locator('[aria-labelledby="coordinate-heading"] [data-quest-portrait="resolved"]').count(),0);assert.equal(await page.locator('a[href="/champions/maestro"]').count(),0);
  await page.goto(origin+'/quests/a05_ch01_q01',{waitUntil:'networkidle'});assert.equal(await page.locator('#quest-rewards a[href="/crystals/mythic_shard_crystal"]').count(),1);assert.equal(await page.locator('#quest-rewards a[href="/crystals/class_cat_crystal"]').count(),2);assert(!(await page.locator('#quest-rewards').innerText()).includes('No direct champion'));
  await page.goto(origin+'/quests/a04_ch04_q01',{waitUntil:'networkidle'});const href=await page.locator('#quest-rewards a[href="/crystals/quest_crystal_improvedspin"]').count();assert(href>0,'Quest token must resolve to exact differently named opening');
  await page.goto(origin+'/quests/a04_ch04_q06',{waitUntil:'networkidle'});assert.equal(await page.locator('[data-menu-art-role]').getAttribute('data-menu-art-role'),'chapter');assert((await page.locator('[data-menu-art-role] img').first().getAttribute('src')).includes('menu-art'));assert((await page.locator('[aria-label="Scrollable quest coordinate map"]').evaluate(e=>getComputedStyle(e.parentElement).backgroundImage)).includes('/game-quests/artwork/'),'Map keeps terrain');
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({captures:records,errors,checks:['verified act/chapter drill-down','scope-preserving GET search','browser history','filter-preserving pagination','real portal navigation','zoom','authored route and keyboard-compatible native coordinate selector','neutral NPC portrait','exact reward destinations and hidden empty sections','all map placements render portraits or neutral NPC markers','map overview toggle','keyboard portrait selection','verified menu artwork header with unchanged map terrain']},null,2));assert.deepEqual(errors,[]);
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
