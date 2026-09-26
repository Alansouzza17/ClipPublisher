import fs from 'node:fs'; import {config} from './config.js'; import {getTokens,saveTokens} from './security.js'; import type {PublishMetadata,PublicationResult,Token} from './types.js';
export interface CreatorInfo { creator_username:string; creator_nickname:string; creator_avatar_url?:string; privacy_level_options:string[]; comment_disabled:boolean; duet_disabled:boolean; stitch_disabled:boolean; max_video_post_duration_sec:number; }
export async function tiktokToken(){let t=await getTokens('tiktok');if(!t)throw new Error('TikTok não conectado.');if(t.expiryDate&&t.expiryDate<Date.now()+60_000&&t.refreshToken){const r=await fetch('https://open.tiktokapis.com/v2/oauth/token/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_key:config.tiktok.key,client_secret:config.tiktok.secret,grant_type:'refresh_token',refresh_token:t.refreshToken})});const x:any=await r.json();if(!r.ok||!x.access_token)throw new Error(x.error?.message||'Token do TikTok expirado; reconecte a conta.');t={accessToken:x.access_token,refreshToken:x.refresh_token||t.refreshToken,expiryDate:Date.now()+(x.expires_in||0)*1000};await saveTokens('tiktok',t)}return t}
const text=(m:PublishMetadata)=>[m.caption,m.mentions,m.hashtags].filter(Boolean).join(' ').trim();
export async function getTikTokCreatorInfo():Promise<CreatorInfo>{const token=await tiktokToken();const r=await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/',{method:'POST',headers:{Authorization:`Bearer ${token.accessToken}`,'Content-Type':'application/json; charset=UTF-8'}});const x:any=await r.json();if(!r.ok||x.error?.code!=='ok')throw new Error(x.error?.message||'Não foi possível consultar as permissões TikTok.');return x.data}
// TikTok treats chunk_size as the size of each chunk except the final chunk.
// Trailing bytes are appended to that final chunk, so the count is floored.
const chunkPlan = (size: number) => {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("O vídeo é inválido.");
  }

  const chunkSize = Math.min(size, 10_000_000);

  return {
    chunkSize,
    count: Math.floor(size / chunkSize),
  };
};
export async function publishTikTok(file:string,size:number,mime:string,metadata:PublishMetadata):Promise<PublicationResult>{const caption=text(metadata);if([...caption].length>2200)throw new Error('A legenda do TikTok ultrapassa o limite de 2200 caracteres.');const creator=await getTikTokCreatorInfo();const privacy=metadata.tiktokPrivacy||'SELF_ONLY';if(!creator.privacy_level_options.includes(privacy))throw new Error('A privacidade escolhida não está disponível para esta conta TikTok.');const token=await tiktokToken(),headers={Authorization:`Bearer ${token.accessToken}`,'Content-Type':'application/json; charset=UTF-8'},plan=chunkPlan(size);if(plan.count>1000)throw new Error('O vídeo excede o máximo de 1000 blocos aceito pelo TikTok.');const body = {
  post_info: {
    title: caption,
    privacy_level: privacy,
    disable_comment: creator.comment_disabled || !!metadata.disableComment,
    disable_duet: creator.duet_disabled || !!metadata.disableDuet,
    disable_stitch: creator.stitch_disabled || !!metadata.disableStitch,
  },
  source_info: {
    source: 'FILE_UPLOAD',
    video_size: size,
    chunk_size: plan.chunkSize,
    total_chunk_count: plan.count,
  },
};

console.log('========== TIKTOK REQUEST ==========');
console.log(JSON.stringify(body, null, 2));
console.log('====================================');

const init = await fetch(
  'https://open.tiktokapis.com/v2/post/publish/video/init/',
  {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }
);const x:any=await init.json();console.log(JSON.stringify(x, null, 2));console.log(
  JSON.stringify(x, null, 2)
);if(!init.ok||x.error?.code!=='ok')throw new Error(x.error?.message||'TikTok recusou a inicialização do envio.');for(let i=0;i<plan.count;i++){const start=i*plan.chunkSize,end=i===plan.count-1?size-1:start+plan.chunkSize-1,length=end-start+1,body=fs.createReadStream(file,{start,end});const upload=await fetch(x.data.upload_url,{method:'PUT',headers:{'Content-Type':mime,'Content-Length':String(length),'Content-Range':`bytes ${start}-${end}/${size}`},body:body as any,duplex:'half'} as any);if(!(upload.status===201||(upload.status===206&&i<plan.count-1)))throw new Error(`O envio do bloco ${i+1} de ${plan.count} falhou.`)}return {pending:true,publishId:x.data.publish_id};}
export async function getTikTokPublishStatus(publishId:string){const token=await tiktokToken();const r=await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/',{method:'POST',headers:{Authorization:`Bearer ${token.accessToken}`,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify({publish_id:publishId})});const x:any=await r.json();if(!r.ok||x.error?.code!=='ok')throw new Error(x.error?.message||'Não foi possível consultar o status do TikTok.');return x.data as {status:string;fail_reason?:string;publicaly_available_post_id?:string[];uploaded_bytes?:number}}
