import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = fs.readFileSync(path.join(root, 'dist/client/index.html'), 'utf8');
html = html.replace("script-src 'self' blob: 'wasm-unsafe-eval'", "script-src 'self' blob: 'unsafe-inline' 'wasm-unsafe-eval'");
html = html.replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g, (_match, src) => {
  const code = fs.readFileSync(path.join(root, 'dist/client', src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${code}</script>`;
});
html = html.replace(/<link[^>]+href="([^"]+\.css)"[^>]*>/g, (_match, href) => `<style>${fs.readFileSync(path.join(root, 'dist/client', href), 'utf8')}</style>`);
html = html.replace(/<link[^>]+rel="(?:manifest|apple-touch-icon)"[^>]*>/g, '');
const destination = process.argv[2] || path.join(root, '..', 'Form.html');
fs.writeFileSync(destination, html);
console.log(`Standalone prototype saved: ${destination}`);
