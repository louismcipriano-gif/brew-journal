const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 5173;
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // ── Claude proxy ────────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/claude') {
    try {
      const body = await readBody(req);
      const apiKey = req.headers['x-api-key'] || '';

      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
          'content-type': 'application/json',
          'content-length': body.length,
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        const ct = proxyRes.headers['content-type'] || 'application/json';
        const headers = { 'content-type': ct };
        // SSE streams need these headers so the browser doesn't buffer
        if (ct.includes('event-stream')) {
          headers['cache-control'] = 'no-cache';
          headers['connection']    = 'keep-alive';
          headers['x-accel-buffering'] = 'no'; // disables nginx buffering if present
        }
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (e) => {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: e.message } }));
      });
      proxyReq.write(body);
      proxyReq.end();
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: e.message } }));
    }
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────────
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);

  // SPA fallback: unknown paths → index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Brew Journal → http://localhost:${PORT}`);
});
