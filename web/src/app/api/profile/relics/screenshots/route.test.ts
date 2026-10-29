import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { POST, PUT } from './route';

const mocks = vi.hoisted(()=>({player:vi.fn(),quota:vi.fn(),scan:vi.fn(),load:vi.fn(),state:vi.fn(),save:vi.fn(),create:vi.fn(),update:vi.fn(),lock:vi.fn()}));
vi.mock('@/lib/auth-helpers',()=>({getUserPlayerWithAlliance:mocks.player}));
vi.mock('@/lib/prisma',()=>({prisma:{$transaction:async(fn:(tx:unknown)=>unknown)=>fn({$executeRaw:mocks.lock,rosterUploadEvent:{create:mocks.create}}),rosterUploadEvent:{update:mocks.update}}}));
vi.mock('@/lib/with-request-context',()=>({withRouteContext:(fn:unknown)=>fn}));
vi.mock('@/lib/logger',()=>({default:{error:vi.fn()}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@cerebro/core/services/rosterScreenshotQuotaService',()=>({getRosterScreenshotQuota:mocks.quota}));
vi.mock('@cerebro/core/services/relicScreenshotService',()=>({loadScreenshotRelics:mocks.load,parseRelicScreenshot:mocks.scan}));
vi.mock('@cerebro/core/services/playerRelicService',async original=>({...await original<object>(),getPlayerRelicState:mocks.state,importPlayerRelics:mocks.save}));
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.player.mockResolvedValue({id:'a',ingameName:'Alpha',botUserId:'actor',discordId:'discord'});
  mocks.quota.mockResolvedValue({allowed:true,used:0,limit:5});
  mocks.create.mockResolvedValue({id:'event'}); mocks.update.mockResolvedValue({});
  mocks.load.mockResolvedValue([]);mocks.scan.mockResolvedValue([{id:'row'}]);
  mocks.state.mockResolvedValue({entries:[],prestige:{revision:'a'.repeat(64)}});
  mocks.save.mockResolvedValue({entries:[{id:'saved'}],prestige:{}});
});
const upload = async(profile='a',origin='http://localhost',bytes?:Uint8Array)=>{
  const form=new FormData();form.set('profileId',profile);
  form.set('image',new File([new Uint8Array(bytes??await sharp({create:{width:1000,height:500,channels:3,background:'black'}}).png().toBuffer())],'screen.png',{type:'image/png'}));
  return new NextRequest('http://localhost/api/profile/relics/screenshots',{method:'POST',headers:{origin},body:form});
};
const saveRequest=(profileId='a')=>new NextRequest('http://localhost/api/profile/relics/screenshots',{method:'PUT',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({profileId,revision:'a'.repeat(64),entries:[{relicId:'ant',stars:6,rank:4,sigLevel:87,expectedPrestige:1962}]})});
describe('relic screenshot upload and reviewed import',()=>{
  it('requires authentication, active profile and same origin before any paid OCR',async()=>{
    mocks.player.mockResolvedValueOnce(null);expect((await POST(await upload())).status).toBe(401);
    expect((await POST(await upload('b'))).status).toBe(409);
    expect((await POST(await upload('a','https://other.test'))).status).toBe(403);
    expect(mocks.scan).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
  });
  it('validates the real image before reserving quota',async()=>{
    expect((await POST(await upload('a','http://localhost',new TextEncoder().encode('not an image')))).status).toBe(422);
    expect(mocks.quota).not.toHaveBeenCalled();
  });
  it('enforces shared quota before OCR and does not create inventory during a scan',async()=>{
    mocks.quota.mockResolvedValueOnce({allowed:false,used:5,limit:5});
    expect((await POST(await upload())).status).toBe(403);expect(mocks.scan).not.toHaveBeenCalled();
    const response=await POST(await upload());expect(response.status).toBe(200);
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.scan.mock.invocationCallOrder[0]);
    expect(mocks.save).not.toHaveBeenCalled();expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'success',metadata:{detectedRelics:1}})}));
  });
  it('records failed scans and never applies partial inventory',async()=>{
    mocks.scan.mockRejectedValueOnce(new Error('No complete relic cards recognized.'));
    expect((await POST(await upload())).status).toBe(422);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'failed',errorCount:1})}));
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('saves only for the authenticated current profile, through the atomic import service',async()=>{
    expect((await PUT(saveRequest('b'))).status).toBe(409);expect(mocks.save).not.toHaveBeenCalled();
    expect((await PUT(saveRequest())).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(),'a',{revision:'a'.repeat(64),entries:[{relicId:'ant',stars:6,rank:4,sigLevel:87,expectedPrestige:1962}]});
  });
  it('bounds upload size before buffering or running OCR',async()=>{
    const request=await upload();request.headers.set('content-length',String(9*1024*1024));
    expect((await POST(request)).status).toBe(413);expect(mocks.scan).not.toHaveBeenCalled();
  });
});
