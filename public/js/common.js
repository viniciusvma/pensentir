// ============================================================
// PENSENTIR — partes comuns (home e páginas legais)
// ============================================================
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* sem storage */ } },
};

// ---------- aviso de privacidade (LGPD) ----------
export const consent = () => store.get('pz_consent'); // 'yes' | 'no' | null

function visitorId() {
  if (consent() !== 'yes') return null;
  let id = store.get('pz_vid');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
    store.set('pz_vid', id);
  }
  return id;
}

export function track(type) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ type, path: location.pathname + location.hash, referrer: document.referrer, visitor_id: visitorId() }),
  }).catch(() => {});
}
export const vid = () => visitorId();

function setupConsent() {
  const box = $('#consent');
  if (!box) return;
  const show = () => { box.hidden = false; };
  const hide = () => { box.hidden = true; };
  if (!consent()) show();
  $('#consentYes')?.addEventListener('click', () => { store.set('pz_consent', 'yes'); hide(); });
  $('#consentNo')?.addEventListener('click', () => { store.set('pz_consent', 'no'); store.del('pz_vid'); hide(); });
  $$('.js-consent-open').forEach((b) => b.addEventListener('click', show));
}

// ---------- toast ----------
export function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2800);
}

// ---------- configurações públicas ----------
function docLabel(doc) {
  const digits = String(doc || '').replace(/\D/g, '');
  if (digits.length === 11) return `CPF ${doc}`;
  if (digits.length === 14) return `CNPJ ${doc}`;
  return doc;
}

export async function loadConfig() {
  let c = {};
  try {
    const r = await fetch('/api/config');
    if (r.ok) c = await r.json();
  } catch { /* mantém padrão */ }

  if (c.instagram_url) $$('.js-ig').forEach((a) => (a.href = c.instagram_url));
  if (c.facebook_url) $$('.js-fb').forEach((a) => { a.href = c.facebook_url; a.hidden = false; });

  if (c.contact_email) {
    $$('.js-mail').forEach((a) => {
      a.href = `mailto:${c.contact_email}`;
      a.textContent = c.contact_email;
      a.hidden = false;
      // muitos PCs não têm app de e-mail configurado: copia o endereço também
      a.addEventListener('click', () => {
        navigator.clipboard?.writeText(c.contact_email).then(
          () => toast(`E-mail copiado: ${c.contact_email}`),
          () => {},
        );
      });
    });
  }

  const parts = [c.legal_name, c.legal_doc && docLabel(c.legal_doc)].filter(Boolean);
  $$('.js-legal-line').forEach((el) => (el.textContent = parts.join(' — ')));

  $$('[data-fill]').forEach((el) => {
    const k = el.dataset.fill;
    const v = k === 'legal_doc' ? (c.legal_doc ? docLabel(c.legal_doc) : '') : c[k];
    if (k === 'contact_email' && v) el.innerHTML = `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
    else el.textContent = v || '';
  });

  $$('.js-ig').forEach((a) => a.addEventListener('click', () => track('ig_click')));
  $$('.js-fb').forEach((a) => a.addEventListener('click', () => track('fb_click')));
  return c;
}

// ---------- menu ----------
function setupNav() {
  const burger = $('#burger');
  const links = $('#navLinks');
  if (!burger || !links) return;
  burger.addEventListener('click', () => {
    const open = !links.classList.contains('open');
    links.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', links).forEach((a) => a.addEventListener('click', () => {
    links.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }));
}

export function initCommon() {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
  setupNav();
  setupConsent();
}
