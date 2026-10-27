// ============================================================
// PENSENTIR — site público
// ============================================================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------- visitante (só para contar acessos únicos) ----------
function visitorId() {
  try {
    let id = localStorage.getItem('pz_vid');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('pz_vid', id); }
    return id;
  } catch { return null; }
}
const VID = visitorId();

function track(type) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ type, path: location.pathname + location.hash, referrer: document.referrer, visitor_id: VID }),
  }).catch(() => {});
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- pilares ----------
const ICONS = {
  foco: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/><path d="M21 3l-7.5 7.5M17 3h4v4"/>',
  reflexao: '<path d="M2 6c3-1.5 6.5-1.5 10 1 3.5-2.5 7-2.5 10-1v13c-3-1.5-6.5-1.5-10 1-3.5-2.5-7-2.5-10-1z"/><path d="M12 7v13"/>',
  evolucao: '<path d="M3 20h18"/><path d="M6 16v-3M10 16v-6M14 16v-4M18 16V7"/><path d="M4 11l5-5 4 3 7-6M16 3h4v4"/>',
  mentalidade: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4z"/>',
  autoconfianca: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  motivacao: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1.2 2.5 2.2 2.8C10.8 8.6 11.3 5.5 12 3z"/>',
};

const PILLARS = [
  { name: 'Foco', key: 'foco', text: 'Escolher para onde vai sua energia. Menos distração, mais presença no que realmente importa.' },
  { name: 'Reflexão', key: 'reflexao', text: 'Parar, olhar para dentro e entender o porquê. Quem se conhece decide melhor.' },
  { name: 'Evolução', key: 'evolucao', text: 'Crescer um pouco a cada dia. Constância vence intensidade quando o assunto é mudar de vida.' },
  { name: 'Mentalidade', key: 'mentalidade', text: 'Seus pensamentos moldam suas atitudes. Treine a mente como quem treina o corpo.' },
  { name: 'Autoconfiança', key: 'autoconfianca', text: 'Acreditar em si mesmo antes da prova chegar. Confiança se constrói com pequenas vitórias.' },
  { name: 'Motivação', key: 'motivacao', text: 'O combustível para começar — e a disciplina para continuar quando a vontade some.' },
];

function renderPillars() {
  $('#pillars').innerHTML = PILLARS.map((p) => `
    <article class="pillar reveal-up">
      <div class="pillar-icon"><svg viewBox="0 0 24 24">${ICONS[p.key]}</svg></div>
      <h3>${p.name}</h3>
      <p>${p.text}</p>
    </article>`).join('');
}

// ---------- frases ----------
const FALLBACK_PHRASES = [
  ['Foco', 'Onde você coloca sua atenção, você coloca sua vida.'],
  ['Foco', 'Menos coisas, feitas por inteiro.'],
  ['Reflexão', 'Antes de reagir, respire. Antes de decidir, sinta.'],
  ['Reflexão', 'Nem todo silêncio é vazio. Alguns são respostas.'],
  ['Evolução', 'Um passo pequeno ainda é um passo pra frente.'],
  ['Evolução', 'Você não precisa ser melhor que ninguém. Só melhor que ontem.'],
  ['Mentalidade', 'O que você repete pra si mesmo, vira o que você acredita.'],
  ['Mentalidade', 'Troque o "não consigo" por "ainda não consegui".'],
  ['Autoconfiança', 'Você já sobreviveu a 100% dos seus piores dias.'],
  ['Autoconfiança', 'Pare de pedir permissão para ser quem você é.'],
  ['Motivação', 'Não desista só porque ainda não deu certo.'],
  ['Motivação', 'Comece com o que tem. O resto vem no caminho.'],
].map(([pillar, text]) => ({ pillar, text, author: null }));

let phrases = FALLBACK_PHRASES;
let lastPhrase = null;

async function loadPhrases() {
  try {
    const r = await fetch('/api/phrases');
    if (!r.ok) return;
    const data = await r.json();
    if (Array.isArray(data) && data.length) phrases = data;
  } catch { /* usa as frases locais */ }
}

function pickPhrase(pillarName) {
  const same = phrases.filter((p) => norm(p.pillar) === norm(pillarName));
  let pool = same.length ? same : phrases;
  if (pool.length > 1) pool = pool.filter((p) => p !== lastPhrase);
  const p = pool[Math.floor(Math.random() * pool.length)];
  lastPhrase = p;
  return p;
}

// ---------- roleta ----------
const SVGNS = 'http://www.w3.org/2000/svg';
const SEG = 360 / PILLARS.length;
const R = 194;
const pt = (a, r) => [r * Math.sin((a * Math.PI) / 180), -r * Math.cos((a * Math.PI) / 180)];

function buildWheel() {
  const svg = $('#wheel');
  let html = `
    <defs>
      <radialGradient id="segA" cx="0" cy="0" r="${R}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#2a1a0e"/><stop offset="1" stop-color="#140c08"/>
      </radialGradient>
      <radialGradient id="segB" cx="0" cy="0" r="${R}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#5a3414"/><stop offset=".75" stop-color="#8a531f"/><stop offset="1" stop-color="#b8752c"/>
      </radialGradient>
      <linearGradient id="ring" x1="0" y1="-1" x2="0" y2="1" gradientUnits="objectBoundingBox">
        <stop offset="0" stop-color="#f8dc98"/><stop offset=".5" stop-color="#c8913e"/><stop offset="1" stop-color="#7a521f"/>
      </linearGradient>
    </defs>
    <circle r="214" fill="url(#ring)"/>
    <circle r="200" fill="#0b0908"/>`;

  PILLARS.forEach((p, i) => {
    const a0 = i * SEG, a1 = (i + 1) * SEG;
    const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
    html += `<path d="M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="url(#${i % 2 ? 'segB' : 'segA'})"/>`;
  });
  PILLARS.forEach((p, i) => {
    const [x, y] = pt(i * SEG, R);
    html += `<line x1="0" y1="0" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#e3b45f" stroke-opacity=".7" stroke-width="1.5"/>`;
  });
  PILLARS.forEach((p, i) => {
    const c = i * SEG + SEG / 2;
    const flip = c > 180 ? 90 : -90; // lado esquerdo lê de fora pra dentro, sempre na posição certa
    html += `
      <g transform="rotate(${c})">
        <text x="0" y="0" transform="translate(0,-130) rotate(${flip})" text-anchor="middle" dominant-baseline="central">${p.name}</text>
        <circle cx="0" cy="-${R - 10}" r="2.5" fill="#f6d58e" opacity=".8"/>
      </g>`;
  });
  html += `<circle r="${R}" fill="none" stroke="#e3b45f" stroke-opacity=".5" stroke-width="2"/>`;
  svg.innerHTML = html;

  // luzinhas da borda
  const lights = $('#wheelLights');
  const N = 24;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI;
    const el = document.createElement('i');
    el.style.left = `${50 + 46.6 * Math.sin(a)}%`;
    el.style.top = `${50 - 46.6 * Math.cos(a)}%`;
    el.style.animationDelay = `${(i % 2) * 0.8}s`;
    lights.appendChild(el);
  }
}

let rotation = 0;
let spinning = false;

function spin() {
  if (spinning) return;
  spinning = true;
  const wrap = $('.wheel-wrap');
  const wheel = $('#wheel');
  const idx = Math.floor(Math.random() * PILLARS.length);
  const jitter = (Math.random() - 0.5) * (SEG * 0.7);
  const target = idx * SEG + SEG / 2 + jitter;            // ângulo (na roda) que deve parar sob o ponteiro
  const residue = (((360 - target) % 360) + 360) % 360;
  const base = rotation - (((rotation % 360) + 360) % 360);
  rotation = base + 360 * 6 + residue;

  wrap.classList.add('spinning', 'ticking');
  $('#spinBtn').disabled = true;
  wheel.style.transform = `rotate(${rotation}deg)`;
  track('spin');

  const tickOff = setTimeout(() => wrap.classList.remove('ticking'), 4300);
  const done = () => {
    clearTimeout(tickOff);
    wrap.classList.remove('spinning', 'ticking');
    $('#spinBtn').disabled = false;
    spinning = false;
    showPhrase(PILLARS[idx].name);
  };
  let finished = false;
  const finish = () => { if (!finished) { finished = true; done(); } };
  wheel.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 6200); // garantia caso o transitionend não dispare
}

function showPhrase(pillarName) {
  const p = pickPhrase(pillarName);
  $('#revealPillar').textContent = p.pillar || pillarName;
  $('#revealText').innerHTML = esc(p.text)
    .split(' ')
    .map((w, i) => `<span style="animation-delay:${0.35 + i * 0.07}s">${w}</span>`)
    .join(' ');
  $('#revealAuthor').textContent = p.author ? `— ${p.author}` : '';
  $('#reveal').hidden = false;
  $('#againBtn').focus({ preventScroll: true });
}

function closeReveal() { $('#reveal').hidden = true; }

async function sharePhrase() {
  const text = `“${lastPhrase?.text || ''}” — Pensentir`;
  const url = location.origin;
  try {
    if (navigator.share) { await navigator.share({ text, url }); return; }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Frase copiada! Cole onde quiser.');
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Não foi possível compartilhar agora.');
  }
}

// ---------- config (links sociais) ----------
async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    if (!r.ok) return;
    const c = await r.json();
    if (c.instagram_url) $$('.js-ig').forEach((a) => (a.href = c.instagram_url));
    if (c.facebook_url) $$('.js-fb').forEach((a) => { a.href = c.facebook_url; a.hidden = false; });
    if (c.contact_email) $$('.js-mail').forEach((a) => { a.href = `mailto:${c.contact_email}`; a.hidden = false; });
  } catch { /* mantém padrão */ }
}

// ---------- produtos ----------
function emptyProducts() {
  return `
    <div class="empty-product reveal-up">
      <div class="book"><div><img src="/img/logo.png" alt=""/><b>EBOOK<br/>PENSENTIR</b></div></div>
      <div>
        <p class="eyebrow">Em produção</p>
        <h3>O ebook da Pensentir está chegando</h3>
        <p class="muted">Um guia prático para fortalecer sua autoconfiança e transformar reflexão em atitude.</p>
        <ul>
          <li>Autoconfiança na prática</li>
          <li>Reflexão e autoconhecimento</li>
          <li>Os pilares de uma mente forte</li>
        </ul>
      </div>
    </div>`;
}

async function loadProducts() {
  const box = $('#products');
  let list = [];
  try {
    const r = await fetch('/api/products');
    if (r.ok) list = await r.json();
  } catch { /* vazio */ }

  if (!list.length) { box.innerHTML = emptyProducts(); observeReveal(); return; }

  box.innerHTML = list.map((p) => `
    <article class="product reveal-up">
      <div class="product-img">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="lazy"/>` : `<div class="book" style="width:120px"><div><img src="/img/logo.png" alt=""/><b>${esc(p.title)}</b></div></div>`}
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      </div>
      <div class="product-body">
        <h3>${esc(p.title)}</h3>
        ${p.subtitle ? `<p class="sub">${esc(p.subtitle)}</p>` : ''}
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
        <div class="price-row">
          <span class="price">${brl.format(Number(p.price))}</span>
          ${p.old_price ? `<span class="old">${brl.format(Number(p.old_price))}</span>` : ''}
        </div>
        <a class="btn btn-gold" href="/r/${esc(p.id)}${VID ? `?v=${encodeURIComponent(VID)}` : ''}" target="_blank" rel="noopener">Quero o meu</a>
      </div>
    </article>`).join('');
  observeReveal();
}

// ---------- lista VIP ----------
function setupLeadForm() {
  const form = $('#leadForm');
  const msg = $('#leadMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    msg.className = 'form-msg';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      msg.textContent = 'Digite um e-mail válido.';
      msg.classList.add('err');
      return;
    }
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const r = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fd.get('name'), email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Erro ao enviar');
      form.reset();
      msg.textContent = 'Pronto! Você está na lista VIP da Pensentir. ✦';
    } catch (err) {
      msg.textContent = err.message || 'Erro ao enviar. Tente novamente.';
      msg.classList.add('err');
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- Instagram ----------
const IG_ICON = {
  VIDEO: '<svg class="ig-type" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>',
  CAROUSEL_ALBUM: '<svg class="ig-type" viewBox="0 0 24 24" fill="#fff"><path d="M4 7h11v13H4z"/><path d="M8 4h12v13h-2V6H8z"/></svg>',
};

async function loadInstagram() {
  const grid = $('#igGrid');
  let posts = [];
  try {
    const r = await fetch('/api/instagram');
    if (r.ok) posts = (await r.json()).posts || [];
  } catch { /* vazio */ }

  if (!posts.length) {
    const href = $('.js-ig').href;
    grid.innerHTML = `<div class="ig-empty">As reflexões mais recentes estão no nosso Instagram.<br/><br/><a class="btn btn-gold js-ig" href="${esc(href)}" target="_blank" rel="noopener">Abrir @pensentir</a></div>`;
    bindSocialTracking();
    return;
  }
  grid.innerHTML = posts.slice(0, 12).map((p) => `
    <a class="ig-item js-ig-post" href="${esc(p.permalink)}" target="_blank" rel="noopener" aria-label="Ver post no Instagram">
      <img src="${esc(p.image)}" alt="${esc(p.caption.slice(0, 100))}" loading="lazy" referrerpolicy="no-referrer"/>
      ${IG_ICON[p.type] || ''}
      ${p.caption ? `<span class="ig-cap">${esc(p.caption)}</span>` : ''}
    </a>`).join('');
  $$('.js-ig-post', grid).forEach((a) => a.addEventListener('click', () => track('ig_click')));
}

function bindSocialTracking() {
  $$('.js-ig').forEach((a) => { if (!a.dataset.t) { a.dataset.t = 1; a.addEventListener('click', () => track('ig_click')); } });
  $$('.js-fb').forEach((a) => { if (!a.dataset.t) { a.dataset.t = 1; a.addEventListener('click', () => track('fb_click')); } });
}

// ---------- efeitos ----------
function embers() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('.embers');
  const n = innerWidth < 600 ? 12 : 24;
  for (let i = 0; i < n; i++) {
    const e = document.createElement('i');
    e.style.left = `${Math.random() * 100}%`;
    e.style.animationDuration = `${9 + Math.random() * 12}s`;
    e.style.animationDelay = `${-Math.random() * 20}s`;
    e.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
    e.style.transform = `scale(${0.5 + Math.random()})`;
    box.appendChild(e);
  }
}

let io;
function observeReveal() {
  if (!('IntersectionObserver' in window)) { $$('.reveal-up').forEach((el) => el.classList.add('in')); return; }
  io ||= new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  $$('.reveal-up:not(.in)').forEach((el) => io.observe(el));
}

function setupNav() {
  const burger = $('#burger');
  const links = $('#navLinks');
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

// ---------- init ----------
$('#year').textContent = new Date().getFullYear();
renderPillars();
buildWheel();
embers();
setupNav();
setupLeadForm();
$$('.section-head, .manifesto-inner, .vip').forEach((el) => el.classList.add('reveal-up'));
observeReveal();

$('#spinBtn').addEventListener('click', spin);
$('#hubBtn').addEventListener('click', spin);
$('#againBtn').addEventListener('click', () => { closeReveal(); setTimeout(spin, 250); });
$('#shareBtn').addEventListener('click', sharePhrase);
$('#revealClose').addEventListener('click', closeReveal);
$('#reveal').addEventListener('click', (e) => { if (e.target.id === 'reveal') closeReveal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeReveal(); });

track('pageview');
loadPhrases();
loadConfig().then(() => { bindSocialTracking(); loadInstagram(); });
loadProducts();
