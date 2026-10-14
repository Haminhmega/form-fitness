import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const devCsp={name:'form-dev-csp',apply:'serve' as const,transformIndexHtml:(html:string)=>html.replace("connect-src 'self' blob: data:","connect-src 'self' blob: data: ws://127.0.0.1:* ws://localhost:*")};
export default defineConfig({ plugins: [react(),devCsp], base: './', build:{outDir:'dist/client'}, server:{proxy:{'/api':'http://127.0.0.1:8787','/auth':'http://127.0.0.1:8787'}}, worker: { format: 'es' } });
