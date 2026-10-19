'use strict';
const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8080);
const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY || ADMIN_KEY.length < 24) {
  console.error('Set ADMIN_KEY to a long random secret (at least 24 characters).');
  process.exit(1);
}
const app = express();
app.use(express.json({limit:'16kb'}));
app.disable('x-powered-by');
const db = new Database(process.env.DB_PATH || './licenses.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS devices (
 device_id TEXT PRIMARY KEY,
 first_seen_ms INTEGER NOT NULL,
 activated INTEGER NOT NULL DEFAULT 0,
 activation_code_hash TEXT,
 last_seen_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS codes (
 code_hash TEXT PRIMARY KEY,
 created_ms INTEGER NOT NULL,
 used_device_id TEXT,
 used_ms INTEGER,
 disabled INTEGER NOT NULL DEFAULT 0
);`);
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const validDevice = s => typeof s === 'string' && /^[A-Za-z0-9._:-]{8,160}$/.test(s);
const authAdmin = (req,res,next) => {
 const got = req.get('x-admin-key') || '';
 const a = Buffer.from(got), b = Buffer.from(ADMIN_KEY);
 if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return res.status(401).json({error:'unauthorized'});
 next();
};
app.get('/health', (_req,res) => res.json({ok:true,service:'nzr-license'}));
app.post('/v1/status', (req,res) => {
 const {deviceId} = req.body || {};
 if (!validDevice(deviceId)) return res.status(400).json({error:'invalid_device'});
 const now = Date.now();
 let row = db.prepare('SELECT * FROM devices WHERE device_id=?').get(deviceId);
 if (!row) {
   db.prepare('INSERT INTO devices(device_id,first_seen_ms,last_seen_ms) VALUES(?,?,?)').run(deviceId,now,now);
   row = db.prepare('SELECT * FROM devices WHERE device_id=?').get(deviceId);
 } else {
   db.prepare('UPDATE devices SET last_seen_ms=? WHERE device_id=?').run(now,deviceId);
 }
 if (row.activated) return res.json({status:'activated'});
 const remaining = Math.max(0, 48*60*60*1000 - (now - row.first_seen_ms));
 if (remaining <= 0) return res.json({status:'expired',remainingMs:0});
 return res.json({status:'trial',remainingMs:remaining});
});
app.post('/v1/activate', (req,res) => {
 const {deviceId, code} = req.body || {};
 if (!validDevice(deviceId) || typeof code !== 'string' || !/^[A-Za-z0-9-]{8,80}$/.test(code)) return res.status(400).json({error:'invalid_request'});
 const codeHash = hash(code.trim().toUpperCase());
 const row = db.prepare('SELECT * FROM codes WHERE code_hash=? AND disabled=0').get(codeHash);
 if (!row) return res.status(403).json({status:'invalid_code'});
 if (row.used_device_id && row.used_device_id !== deviceId) return res.status(409).json({status:'code_already_used'});
 const tx = db.transaction(() => {
   db.prepare('UPDATE codes SET used_device_id=?, used_ms=COALESCE(used_ms,?) WHERE code_hash=?').run(deviceId,Date.now(),codeHash);
   db.prepare('INSERT INTO devices(device_id,first_seen_ms,activated,activation_code_hash,last_seen_ms) VALUES(?,?,1,?,?) ON CONFLICT(device_id) DO UPDATE SET activated=1,activation_code_hash=excluded.activation_code_hash,last_seen_ms=excluded.last_seen_ms').run(deviceId,Date.now(),codeHash,Date.now());
 });
 tx();
 return res.json({status:'activated'});
});
app.post('/admin/codes', authAdmin, (req,res) => {
 const count = Math.max(1, Math.min(50, Number(req.body?.count || 1)));
 const codes = [];
 const insert = db.prepare('INSERT INTO codes(code_hash,created_ms) VALUES(?,?)');
 const tx = db.transaction(() => {
   for (let i=0;i<count;i++) {
     const raw = crypto.randomBytes(12).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
     insert.run(hash(raw),Date.now()); codes.push(raw);
   }
 });
 tx(); res.json({codes});
});
app.post('/admin/codes/disable', authAdmin, (req,res) => {
 const {code} = req.body || {};
 if (typeof code !== 'string') return res.status(400).json({error:'invalid_code'});
 const info = db.prepare('UPDATE codes SET disabled=1 WHERE code_hash=?').run(hash(code.trim().toUpperCase()));
 res.json({disabled:info.changes===1});
});
app.listen(PORT, '0.0.0.0', () => console.log(`NzR license service listening on ${PORT}`));
