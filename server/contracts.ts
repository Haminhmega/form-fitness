export type Statement={bind:(...args:unknown[])=>Statement;first:()=>Promise<any>;run:()=>Promise<{meta:{changes:number}}>};
export type Env={
  DB:{prepare:(sql:string)=>Statement};
  ASSETS?:{fetch:(request:Request)=>Promise<Response>};
  GOOGLE_CLIENT_ID?:string;
  GOOGLE_CLIENT_SECRET?:string;
  AUTH_ORIGIN?:string;
};
export const privateHeaders={'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export const json=(value:unknown,status=200,extra:HeadersInit={})=>new Response(JSON.stringify(value),{status,headers:{...privateHeaders,...extra}});
export const sameOrigin=(request:Request)=>request.headers.get('Origin')===new URL(request.url).origin&&request.headers.get('X-Form-Client')==='1'&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
