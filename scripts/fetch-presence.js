#!/usr/bin/env node
// Calls Roblox Presence API with an authenticated cookie and writes data/presence.json
// Requires env var: ROBLOX_COOKIE  (the .ROBLOSECURITY cookie value)
// Requires env var: ROBLOX_USER_ID (numeric user id)

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const COOKIE  = process.env.ROBLOX_COOKIE;
const USER_ID = Number(process.env.ROBLOX_USER_ID || '3404416545');
const OUT     = path.join(__dirname, '..', 'data', 'presence.json');

if (!COOKIE) {
  console.error('Missing ROBLOX_COOKIE env var');
  process.exit(1);
}

function post(hostname, pathname, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      { hostname, path: pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers } },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  try {
    const { status, body } = await post(
      'presence.roblox.com',
      '/v1/presence/users',
      { userIds: [USER_ID] },
      { Cookie: `.ROBLOSECURITY=${COOKIE}`, 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioPresenceBot/1.0)' }
    );

    if (status !== 200) {
      console.error(`Roblox API returned ${status}:`, JSON.stringify(body));
      process.exit(1);
    }

    const arr = body?.userPresences ?? body?.data ?? (Array.isArray(body) ? body : null);
    if (!Array.isArray(arr) || !arr.length) {
      console.error('Unexpected response shape:', JSON.stringify(body));
      process.exit(1);
    }

    const p = arr[0];
    const out = {
      userPresenceType: p.userPresenceType ?? 0,
      lastLocation:     p.lastLocation     ?? null,
      gameId:           p.gameId           ?? null,
      placeId:          p.placeId          ?? null,
      updatedAt:        new Date().toISOString(),
    };

    fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log('presence.json updated:', JSON.stringify(out));
  } catch (err) {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  }
})();
