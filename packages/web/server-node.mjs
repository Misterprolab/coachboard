import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// All possible bun locations
const bunCandidates = [
  '/usr/bin/bun',
  '/usr/local/bin/bun', 
  `${process.env.HOME}/.bun/bin/bun`,
  '/root/.bun/bin/bun',
  '/home/render/.bun/bin/bun',
  '/opt/render/.bun/bin/bun',
];

let bunPath = null;
for (const p of bunCandidates) {
  if (existsSync(p)) { bunPath = p; break; }
}
if (!bunPath) {
  try { bunPath = execSync('which bun 2>/dev/null', { encoding: 'utf8' }).trim(); } catch(e) {}
}

console.log(`HOME=${process.env.HOME}, PATH=${process.env.PATH}`);
console.log(`Bun path: ${bunPath}`);

if (bunPath) {
  console.log(`Starting bun server...`);
  const child = spawn(bunPath, ['src/server.ts'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env }
  });
  child.on('error', (err) => { console.error('Bun spawn error:', err); startNodeFallback(); });
  child.on('exit', (code) => { if (code !== 0) { console.log('Bun exited, trying fallback'); startNodeFallback(); } else process.exit(0); });
} else {
  startNodeFallback();
}

function startNodeFallback() {
  const distDir = join(__dirname, 'expo-dist');
  const indexPath = join(distDir, 'index.html');
  console.log(`Node fallback on port ${PORT}, distDir=${distDir}, indexExists=${existsSync(indexPath)}`);

  createServer((req, res) => {
    let pathname = new URL(req.url, `http://localhost`).pathname;
    if (pathname.startsWith('/api')) {
      res.writeHead(503); res.end('API unavailable'); return;
    }
    const clean = pathname.replace(/^\/+/, '').replace(/\.\./g, '');
    const filePath = clean ? join(distDir, clean) : indexPath;
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    const types = { html:'text/html', js:'application/javascript', css:'text/css',
      png:'image/png', ico:'image/x-icon', json:'application/json', webmanifest:'application/manifest+json', svg:'image/svg+xml' };
    if (existsSync(filePath) && !filePath.endsWith('/')) {
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(readFileSync(filePath));
    } else {
      if (existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(indexPath));
      } else {
        res.writeHead(500); res.end('App not built');
      }
    }
  }).listen(PORT, '0.0.0.0', () => console.log(`Fallback server on http://0.0.0.0:${PORT}`));
}
