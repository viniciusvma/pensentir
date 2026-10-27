import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  PORT = 3000,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ADMIN_PASSWORD,
  SESSION_SECRET,
  NODE_ENV,
} = process.env;

const required = { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD, SESSION_SECRET };
for (const [k, v] of Object.entries(required)) {
  if (!v) {
    console.error(`[pensentir] Falta a variável de ambiente ${k}`);
    process.exit(1);
  }
}

const IS_PROD = NODE_ENV === 'production';
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// ---------------------------------------------------------------- helpers
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isBot = (ua = '') =>
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|curl|wget|python|headless|lighthouse/i.test(ua);
const deviceOf = (ua = '') => (/ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'desktop');
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : null);
const isHttpsUrl = (v) => {
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
};

function refHost(ref, req) {
  if (!ref) return '';
  try {
    const u = new URL(ref);
    if (u.host === req.get('host')) return '';
    return u.hostname.replace(/^www\./, '').replace(/^(l|lm|m)\.(instagram|facebook)\.com$/, '$2.com');
  } catch { return ''; }
}

function limiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, h] of hits) if (h.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(req.ip, h); }
    if (++h.n > max) return res.status(429).json({ error: 'Muitas requisições. Tente de novo em instantes.' });
    next();
  };
}

async function getSettings(keys) {
  let q = db.from('settings').select('key,value');
  if (keys) q = q.in('key', keys);
  const { data, error } = await q;
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.key, r.value]));
}

async function setSetting(key, value) {
  const { error } = await db.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function logEvent(req, row) {
  const ua = req.get('user-agent') || '';
  if (isBot(ua)) return;
  const { error } = await db.from('events').insert({ device: deviceOf(ua), ...row });
  if (error) console.error('[events]', error.message);
}

// ---------------------------------------------------------------- admin session
const COOKIE = 'pz_admin';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const sessionKey = crypto.createHash('sha256').update(SESSION_SECRET + '|' + ADMIN_PASSWORD).digest();
const sign = (v) => crypto.createHmac('sha256', sessionKey).update(v).digest('base64url');
const makeSession = () => { const exp = String(Date.now() + SESSION_MS); return `${exp}.${sign(exp)}`; };

function validSession(token) {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(exp) > Date.now();
}

function getCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function requireAdmin(req, res, next) {
  if (validSession(getCookie(req, COOKIE))) return next();
  res.status(401).json({ error: 'Não autorizado' });
}

const loginFails = new Map();
function passwordOk(input) {
  const a = crypto.createHash('sha256').update(String(input || '')).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------- PUBLIC API
const PUBLIC_SETTINGS = ['instagram_url', 'facebook_url', 'contact_email', 'legal_name', 'legal_doc', 'legal_address'];

app.get('/healthz', (req, res) => res.send('ok'));

app.get('/api/config', ah(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(await getSettings(PUBLIC_SETTINGS));
}));

app.get('/api/products', ah(async (req, res) => {
  const { data, error } = await db
    .from('products')
    .select('id,title,subtitle,description,price,old_price,image_url,badge')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.set('Cache-Control', 'public, max-age=60');
  res.json(data);
}));

app.get('/api/phrases', ah(async (req, res) => {
  const { data, error } = await db.from('phrases').select('pillar,text,author').eq('active', true);
  if (error) throw error;
  res.set('Cache-Control', 'public, max-age=300');
  res.json(data);
}));

const TRACK_TYPES = new Set(['pageview', 'spin', 'ig_click', 'fb_click']);
app.post('/api/track', limiter(60, 60e3), ah(async (req, res) => {
  const { type, path: p, referrer, visitor_id } = req.body || {};
  if (!TRACK_TYPES.has(type)) return res.status(400).json({ error: 'tipo inválido' });
  await logEvent(req, {
    type,
    path: clip(p, 200),
    referrer: refHost(referrer, req),
    visitor_id: clip(visitor_id, 64),
  });
  res.status(204).end();
}));

app.post('/api/leads', limiter(5, 60e3), ah(async (req, res) => {
  const name = clip(req.body?.name, 80) || null;
  const email = clip(req.body?.email, 160)?.toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'E-mail inválido' });
  const { error } = await db.from('leads').upsert({ name, email }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) throw error;
  res.json({ ok: true });
}));

// clique no produto -> registra e manda pro checkout do Mercado Pago
app.get('/r/:id', ah(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.redirect('/#produtos');
  const { data } = await db.from('products').select('id,checkout_url,active').eq('id', req.params.id).maybeSingle();
  if (!data || !data.active || !isHttpsUrl(data.checkout_url)) return res.redirect('/#produtos');
  await logEvent(req, { type: 'product_click', product_id: data.id, visitor_id: clip(req.query.v, 64) });
  res.redirect(302, data.checkout_url);
}));

// ---------------------------------------------------------------- ADMIN API
app.post('/api/admin/login', ah(async (req, res) => {
  const now = Date.now();
  const f = loginFails.get(req.ip);
  if (f && f.until > now) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });

  if (!passwordOk(req.body?.password)) {
    const fresh = !f || now - f.first > 15 * 60e3;
    const n = fresh ? 1 : f.n + 1;
    loginFails.set(req.ip, { n, first: fresh ? now : f.first, until: n >= 5 ? now + 15 * 60e3 : 0 });
    return res.status(401).json({ error: 'Senha incorreta' });
  }
  loginFails.delete(req.ip);
  res.cookie(COOKIE, makeSession(), {
    httpOnly: true, secure: IS_PROD, sameSite: 'strict', maxAge: SESSION_MS, path: '/',
  });
  res.json({ ok: true });
}));

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.use('/api/admin', requireAdmin);

app.get('/api/admin/me', (req, res) => res.json({ ok: true }));

app.get('/api/admin/stats', ah(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const { data, error } = await db.rpc('admin_stats', { p_days: days });
  if (error) throw error;
  res.json(data);
}));

app.get('/api/admin/events', ah(async (req, res) => {
  const { data, error } = await db
    .from('events')
    .select('id,type,path,referrer,device,created_at,products(title)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  res.json(data);
}));

// ---- produtos
function productPayload(b) {
  const out = {
    title: clip(b.title, 140),
    subtitle: clip(b.subtitle, 200) || null,
    description: clip(b.description, 3000) || null,
    price: Number(b.price),
    old_price: b.old_price === '' || b.old_price == null ? null : Number(b.old_price),
    image_url: clip(b.image_url, 600) || null,
    checkout_url: clip(b.checkout_url, 600),
    badge: clip(b.badge, 40) || null,
    active: b.active !== false,
    sort_order: Number.isFinite(Number(b.sort_order)) ? Math.trunc(Number(b.sort_order)) : 0,
    updated_at: new Date().toISOString(),
  };
  if (!out.title) return { error: 'Título obrigatório' };
  if (!Number.isFinite(out.price) || out.price < 0) return { error: 'Preço inválido' };
  if (out.old_price !== null && (!Number.isFinite(out.old_price) || out.old_price < 0)) return { error: 'Preço antigo inválido' };
  if (!isHttpsUrl(out.checkout_url)) return { error: 'Link de pagamento precisa começar com https://' };
  if (out.image_url && !isHttpsUrl(out.image_url)) return { error: 'URL da imagem precisa começar com https://' };
  return { out };
}

app.get('/api/admin/products', ah(async (req, res) => {
  const { data, error } = await db.from('products').select('*').order('sort_order').order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

app.post('/api/admin/products', ah(async (req, res) => {
  const { out, error: err } = productPayload(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const { data, error } = await db.from('products').insert(out).select().single();
  if (error) throw error;
  res.json(data);
}));

app.put('/api/admin/products/:id', ah(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'id inválido' });
  const { out, error: err } = productPayload(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const { data, error } = await db.from('products').update(out).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

app.delete('/api/admin/products/:id', ah(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'id inválido' });
  const { error } = await db.from('products').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ---- upload de imagem (Supabase Storage, bucket "produtos")
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)),
});
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

app.post('/api/admin/upload', upload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie uma imagem PNG, JPG, WEBP ou GIF de até 5MB' });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${EXT[req.file.mimetype]}`;
  const { error } = await db.storage.from('produtos').upload(name, req.file.buffer, { contentType: req.file.mimetype });
  if (error) throw error;
  res.json({ url: db.storage.from('produtos').getPublicUrl(name).data.publicUrl });
}));

// ---- frases
app.get('/api/admin/phrases', ah(async (req, res) => {
  const { data, error } = await db.from('phrases').select('*').order('pillar').order('created_at');
  if (error) throw error;
  res.json(data);
}));

app.post('/api/admin/phrases', ah(async (req, res) => {
  const pillar = clip(req.body?.pillar, 40);
  const text = clip(req.body?.text, 300);
  if (!pillar || !text) return res.status(400).json({ error: 'Pilar e frase são obrigatórios' });
  const { data, error } = await db.from('phrases')
    .insert({ pillar, text, author: clip(req.body?.author, 80) || null, active: req.body?.active !== false })
    .select().single();
  if (error) throw error;
  res.json(data);
}));

app.put('/api/admin/phrases/:id', ah(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'id inválido' });
  const patch = {};
  if ('pillar' in req.body) patch.pillar = clip(req.body.pillar, 40);
  if ('text' in req.body) patch.text = clip(req.body.text, 300);
  if ('author' in req.body) patch.author = clip(req.body.author, 80) || null;
  if ('active' in req.body) patch.active = !!req.body.active;
  if (patch.pillar === '' || patch.text === '') return res.status(400).json({ error: 'Campos vazios' });
  const { data, error } = await db.from('phrases').update(patch).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

app.delete('/api/admin/phrases/:id', ah(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'id inválido' });
  const { error } = await db.from('phrases').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ---- leads
app.get('/api/admin/leads', ah(async (req, res) => {
  const { data, error } = await db.from('leads').select('*').order('created_at', { ascending: false }).limit(5000);
  if (error) throw error;
  res.json(data);
}));

app.get('/api/admin/leads.csv', ah(async (req, res) => {
  const { data, error } = await db.from('leads').select('name,email,created_at').order('created_at', { ascending: false });
  if (error) throw error;
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['nome,email,data', ...data.map((l) => [l.name, l.email, l.created_at].map(esc).join(','))].join('\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="leads-pensentir.csv"');
  res.send('﻿' + csv);
}));

app.delete('/api/admin/leads/:id', ah(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'id inválido' });
  const { error } = await db.from('leads').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ---- configurações
app.get('/api/admin/settings', ah(async (req, res) => {
  const s = await getSettings();
  const keys = ['instagram_url', 'facebook_url', 'contact_email', 'legal_name', 'legal_doc', 'legal_address'];
  res.json(Object.fromEntries(keys.map((k) => [k, s[k] || ''])));
}));

app.put('/api/admin/settings', ah(async (req, res) => {
  const b = req.body || {};
  for (const key of ['instagram_url', 'facebook_url']) {
    if (key in b) {
      const v = clip(b[key], 300) || '';
      if (v && !isHttpsUrl(v)) return res.status(400).json({ error: `${key} precisa começar com https://` });
      await setSetting(key, v);
    }
  }
  if ('contact_email' in b) {
    const v = clip(b.contact_email, 160) || '';
    if (v && !EMAIL_RE.test(v)) return res.status(400).json({ error: 'E-mail de contato inválido' });
    await setSetting('contact_email', v);
  }
  for (const [key, max] of [['legal_name', 160], ['legal_doc', 40], ['legal_address', 300]]) {
    if (key in b) await setSetting(key, clip(b[key], max) || '');
  }
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- STATIC
const pub = path.join(__dirname, 'public');
app.get(['/admin', '/admin/'], (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(pub, 'admin', 'index.html'));
});
app.use(express.static(pub, { maxAge: IS_PROD ? '1h' : 0, extensions: ['html'] }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
app.use((req, res) => res.status(404).sendFile(path.join(pub, 'index.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[erro]', err?.message || err);
  if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Arquivo muito grande (máx. 5MB)' });
  res.status(500).json({ error: 'Erro interno' });
});

// LGPD: apaga estatísticas com mais de 24 meses (na subida e 1x por dia)
async function purgeOldEvents() {
  const cutoff = new Date(Date.now() - 730 * 24 * 3600e3).toISOString();
  const { error } = await db.from('events').delete().lt('created_at', cutoff);
  if (error) console.error('[limpeza]', error.message);
}
purgeOldEvents();
setInterval(purgeOldEvents, 24 * 3600e3).unref();

app.listen(PORT, () => console.log(`[pensentir] rodando na porta ${PORT}`));
