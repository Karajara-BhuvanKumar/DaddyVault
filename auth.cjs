'use strict';
const crypto = require('node:crypto');
const scrypt = require('node:util').promisify(crypto.scrypt);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const hashPattern = /^scrypt\$65536\$[a-f0-9]{32}\$[a-f0-9]{128}$/;
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 256) throw Error('Use a unique password of 16–256 characters.');
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, {N:65536,r:8,p:1,maxmem:128*1024*1024});
  return `scrypt$65536$${salt}$${key.toString('hex')}`;
}
function createAuth(db, passwordHash) {
  if (!hashPattern.test(passwordHash)) throw Error('DADDYVAULT_PASSWORD_HASH is invalid. Run npm run password:hash.');
  const credential = digest(passwordHash);
  db.prepare('DELETE FROM auth_sessions WHERE credential != ? OR expires <= ?').run(credential, Date.now());
  return {
    async login(password) {
      const now = Date.now();
      // Persisted global budget for a single owner; forwarded IPs are untrusted.
      db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').run(now - 60000);
      if (db.prepare('SELECT COUNT(*) AS n FROM login_attempts').get().n >= 10) throw Object.assign(Error('Too many sign-in attempts. Wait one minute and retry.'),{status:429});
      db.prepare('INSERT INTO login_attempts(attempted_at) VALUES(?)').run(now);
      if (typeof password !== 'string' || password.length > 256) return null;
      const [, , salt, expected] = passwordHash.split('$');
      const actual = await scrypt(password, salt, 64, {N:65536,r:8,p:1,maxmem:128*1024*1024});
      if (!crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'))) return null;
      const token = crypto.randomBytes(32).toString('hex'), csrf = crypto.randomBytes(32).toString('hex');
      db.prepare('DELETE FROM auth_sessions WHERE expires <= ?').run(now);
      db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?)').run(digest(token), csrf, now + 12*60*60*1000, credential);
      return {token, csrf};
    },
    session(token) {
      if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
      return db.prepare('SELECT csrf FROM auth_sessions WHERE id=? AND credential=? AND expires>?').get(digest(token), credential, Date.now());
    },
    logout(token) { if (token) db.prepare('DELETE FROM auth_sessions WHERE id=?').run(digest(token)); }
  };
}
module.exports = {hashPassword, createAuth, hashPattern};
