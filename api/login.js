// Vercel Serverless Function — connexion back-office (vérif mot de passe CÔTÉ SERVEUR)
// Le hash du mot de passe et le secret de session vivent dans les variables d'env Vercel,
// jamais dans le code public. Renvoie un jeton de session signé (HMAC) valable 7 jours.
const crypto = require('crypto');

function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sign(payloadObj, secret) {
  const data = b64url(Buffer.from(JSON.stringify(payloadObj)));
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return data + '.' + sig;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const email = String((body && body.email) || '').trim().toLowerCase();
  const password = String((body && body.password) || '');

  const adminEmail = String(process.env.ADMIN_EMAIL || 'contact@ynelstudio.fr').toLowerCase();
  const adminHash = process.env.ADMIN_PASS_HASH || '';
  const secret = process.env.SESSION_SECRET || '';
  if (!adminHash || !secret) { res.status(500).json({ error: 'Serveur non configuré (variables d\'environnement manquantes)' }); return; }

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (email === adminEmail && hash === adminHash) {
    const token = sign({ email: adminEmail, role: 'admin', exp: Date.now() + 7 * 864e5 }, secret);
    res.status(200).json({ ok: true, email: adminEmail, role: 'admin', token: token });
  } else {
    res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
  }
};
