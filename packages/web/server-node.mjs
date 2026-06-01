import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Check if bun is available
let bunPath = null;
try {
  bunPath = execSync('which bun', { encoding: 'utf8' }).trim();
} catch(e) {
  const homeBun = `${process.env.HOME}/.bun/bin/bun`;
  if (existsSync(homeBun)) bunPath = homeBun;
}

if (bunPath) {
  console.log(`Found bun at ${bunPath}, starting bun server...`);
  const child = spawn(bunPath, ['src/server.ts'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env }
  });
  child.on('exit', (code) => process.exit(code));
} else {
  // Pure Node fallback - serve static files
  console.log(`Bun not found, serving static files with Node on port ${PORT}`);
  const distDir = join(__dirname, 'expo-dist');
  const indexPath = join(distDir, 'index.html');

  createServer((req, res) => {
    // Only serve static, no API
    let pathname = new URL(req.url, `http://localhost`).pathname;
    if (pathname.startsWith('/api')) {
      res.writeHead(503);
      res.end('API unavailable in fallback mode');
      return;
    }
    
    const clean = pathname.replace(/^\/+/, '').replace(/\.\./g, '');
    const filePath = clean ? join(distDir, clean) : indexPath;

    if (existsSync(filePath)) {
      const ext = filePath.split('.').pop();
      const types = { html:'text/html', js:'application/javascript', css:'text/css',
        png:'image/png', ico:'image/x-icon', json:'application/json', webmanifest:'application/manifest+json' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(indexPath));
    }
  }).listen(PORT, '0.0.0.0', () => {
    console.log(`Node fallback server on port ${PORT}`);
  });
}
