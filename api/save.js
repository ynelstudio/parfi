// Vercel Serverless Function — enregistre une page sur GitHub (commit) CÔTÉ SERVEUR.
// Le token GitHub vit dans les variables d'env Vercel, jamais dans le navigateur.
// Exige un jeton de session valide (émis par /api/login).
const crypto = require('crypto');

function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function verify(token, secret) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const parts = token.split('.');
  const expect = b64url(crypto.createHmac('sha256', secret).update(parts[0]).digest());
  if (parts[1] !== expect) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); } catch (e) { return null; }
  if (!payload || !payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  const token = body && body.token;
  const path = body && body.path;
  const content = body && body.content;
  const message = (body && body.message) || 'Edition via editeur visuel';

  const secret = process.env.SESSION_SECRET || '';
  const ghToken = process.env.GH_TOKEN || '';
  const owner = process.env.GH_OWNER || 'ynelstudio';
  const repo = process.env.GH_REPO || 'parfi';
  const branch = process.env.GH_BRANCH || 'main';

  if (!secret || !ghToken) { res.status(500).json({ error: 'Serveur non configuré (variables d\'environnement manquantes)' }); return; }
  if (!verify(token, secret)) { res.status(401).json({ error: 'Session expirée — reconnecte-toi.' }); return; }
  if (!path || typeof content !== 'string') { res.status(400).json({ error: 'Requête invalide' }); return; }
  // garde-fou : on n'autorise QUE les fichiers du site dans editor/
  if (!/^editor\/[A-Za-z0-9._/-]+$/.test(path) || path.indexOf('..') >= 0) { res.status(400).json({ error: 'Chemin non autorisé' }); return; }

  const api = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path;
  const headers = { 'Authorization': 'Bearer ' + ghToken, 'User-Agent': 'parfi-editor', 'Accept': 'application/vnd.github+json' };
  try {
    let sha;
    const cur = await fetch(api + '?ref=' + branch, { headers: headers });
    if (cur.ok) { const j = await cur.json(); sha = j.sha; }
    const putBody = { message: message, content: Buffer.from(content, 'utf8').toString('base64'), branch: branch };
    if (sha) putBody.sha = sha;
    const put = await fetch(api, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(putBody) });
    if (!put.ok) { let e = {}; try { e = await put.json(); } catch (x) {} res.status(502).json({ error: (e && e.message) || ('GitHub ' + put.status) }); return; }
    res.status(200).json({ ok: true });
  } catch (err) { res.status(500).json({ error: String((err && err.message) || err) }); }
};
