import {build} from 'esbuild';
import {mkdir,writeFile,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('dist/server/',root),{recursive:true});
await build({entryPoints:[new URL('server/index.ts',root).pathname.replace(/^\/(\w:)/,'$1')],outfile:new URL('dist/server/index.js',root).pathname.replace(/^\/(\w:)/,'$1'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await mkdir(new URL('dist/.openai/',root),{recursive:true});
await cp(new URL('.openai/hosting.json',root),new URL('dist/.openai/hosting.json',root));
await cp(new URL('drizzle/',root),new URL('dist/.openai/drizzle/',root),{recursive:true});
await writeFile(new URL('dist/server/wrangler.json',root),JSON.stringify({name:'form-fitness',main:'index.js',compatibility_date:'2026-05-15',assets:{directory:'../client',binding:'ASSETS',run_worker_first:['/api/*']},d1_databases:[{binding:'DB',database_name:'form-local',migrations_dir:'../../drizzle',database_id:'00000000-0000-4000-8000-000000000000'}]},null,2));
