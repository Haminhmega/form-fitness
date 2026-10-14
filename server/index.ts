import {saveSchema} from '../shared/account';
type Statement={bind:(...args:unknown[])=>Statement;first:()=>Promise<any>;run:()=>Promise<{meta:{changes:number}}>};
type Env={DB:{prepare:(sql:string)=>Statement};ASSETS?:{fetch:(request:Request)=>Promise<Response>}};
const headers={'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
function identity(request:Request){
  // Sites dispatch validates sign-in and injects these headers. Never accept an
  // owner ID from the body, query, local storage, or a service bypass token.
  const id=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email');
  if(!id||!email||id.length>512||email.length>320)return null;
  let name='';
  if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8')try{name=decodeURIComponent(request.headers.get('oai-authenticated-user-full-name')||'')}catch{}
  return {id,email,name:name.slice(0,100)};
}
async function readJson(request:Request){
  if(!request.body)throw Error('body');
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let length=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>2_000_000){await reader.cancel();throw Error('size')}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export default {async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
  if(url.pathname!=='/api/account')return json({error:'Not found'},404);
  const user=identity(request);
  if(!user)return json({error:'Sign in to access your Form account.'},401);
  if(!['GET','PUT','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
  if(request.method!=='GET'&&(request.headers.get('Origin')!==url.origin||request.headers.get('X-Form-Client')!=='1'||request.headers.get('Sec-Fetch-Site')==='cross-site'))return json({error:'This request must come from Form.'},403);
  if(!env.DB)return json({error:'Account storage is temporarily unavailable. Please retry.'},503);
  try{
    if(request.method==='GET'){
      const row=await env.DB.prepare('SELECT document,revision,updated_at FROM form_accounts WHERE user_id = ?').bind(user.id).first();
      return json({user,record:row&&row.document!=='null'?{document:JSON.parse(row.document),revision:row.revision,updatedAt:row.updated_at}:null});
    }
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected JSON'},415);
    let body;try{body=await readJson(request)}catch{return json({error:'The request is invalid or too large.'},400)}
    if(request.method==='DELETE'){
      if(body?.confirm!=='DELETE MY FORM ACCOUNT')return json({error:'Confirm account deletion.'},400);
      // Retain only the owner key/revision, with all profile data removed. A
      // stale offline device must not overwrite a subsequently recreated account.
      await env.DB.prepare("UPDATE form_accounts SET document = 'null', revision = revision + 1, updated_at = ? WHERE user_id = ?").bind(new Date().toISOString(),user.id).run();
      return json({deleted:true});
    }
    const parsed=saveSchema.safeParse(body);
    if(!parsed.success)return json({error:'Check your details and try again.',fields:parsed.error.issues.map(i=>({path:i.path.join('.'),message:i.message})).slice(0,12)},400);
    const {revision,document}=parsed.data;
    // Sample history cannot become a real user's synced workout record.
    document.training.history=document.training.history.filter(item=>!item.sample);
    const updatedAt=new Date().toISOString();
    const saved=revision===0
      ?await env.DB.prepare("INSERT INTO form_accounts (user_id,document,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET document=excluded.document,revision=form_accounts.revision+1,updated_at=excluded.updated_at WHERE form_accounts.document='null' RETURNING document,revision,updated_at").bind(user.id,JSON.stringify(document),updatedAt).first()
      :await env.DB.prepare("UPDATE form_accounts SET document = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ? AND document != 'null' RETURNING document,revision,updated_at").bind(JSON.stringify(document),updatedAt,user.id,revision).first();
    if(!saved)return json({error:'Another device saved changes. Refresh before saving again.'},409);
    return json({record:{document:JSON.parse(saved.document),revision:saved.revision,updatedAt:saved.updated_at}});
  }catch{return json({error:'Your account could not be loaded or saved. Please retry.'},503)}
}};
