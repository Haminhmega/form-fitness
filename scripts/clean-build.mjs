import {rm} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist');
if(output!==root+sep+'dist')throw Error('Unexpected build output path');
await rm(output,{recursive:true,force:true});
