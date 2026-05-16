#!/usr/bin/env node
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const COOKIE  = process.env.ROBLOX_COOKIE;
const USER_ID = Number(process.env.ROBLOX_USER_ID || '3404416545');
const OUT     = path.join(__dirname, '..', 'data', 'presence.json');

if (!COOKIE) {
  console.error('ERROR: ROBLOX_COOKIE env var is not set.');
  process.exit(1);
}

function request(method, hostname, pathname, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'User-Agent':    'Mozilla/5.0 (compatible; PortfolioBot/1.0)',
      'Cookie':        `.ROBLOSECURITY=${COOKIE}`,
      ...extraHeaders,
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request({ hostname, path: pathname, method, headers }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getCsrfToken() {
  // Roblox rejects POST requests without a CSRF token even with a valid cookie.
  // The standard flow: send any POST → get 403 with x-csrf-token in response headers → retry with that token.
  const probe = await request('POST', 'auth.roblox.com', '/v2/logout', null, {});
  const token = probe.headers['x-csrf-token'];
  if (!token) {
    console.warn('Could not obtain CSRF token (probe status:', probe.status, ')');
    console.warn('Probe body:', JSON.stringify(probe.body));
  } else {
    console.log('CSRF token obtained.');
  }
  return token || null;
}

(async () => {
  try {
    const csrf = await getCsrfToken();

    const extraHeaders = csrf ? { 'x-csrf-token': csrf } : {};
    const { status, body } = await request(
      'POST',
      'presence.roblox.com',
      '/v1/presence/users',
      { userIds: [USER_ID] },
      extraHeaders
    );

    console.log(`Presence API responded with status ${status}`);

    if (status === 401) {
      console.error('ERROR: 401 Unauthorized — the ROBLOX_COOKIE secret is invalid or expired.');
      console.error('Renew it: open roblox.com in your browser → F12 → Application → Cookies → .ROBLOSECURITY → copy the value → update the GitHub secret.');
      process.exit(1);
    }

    if (status === 403) {
      console.error('ERROR: 403 Forbidden — CSRF token issue or cookie is invalid.');
      console.error('Response:', JSON.stringify(body));
      process.exit(1);
    }

    if (status !== 200) {
      console.error(`ERROR: Roblox API returned ${status}:`, JSON.stringify(body));
      process.exit(1);
    }

    const arr = body?.userPresences ?? body?.data ?? (Array.isArray(body) ? body : null);
    if (!Array.isArray(arr) || !arr.length) {
      console.error('ERROR: Unexpected response shape:', JSON.stringify(body));
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
