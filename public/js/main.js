// ============================================================
// PENSENTIR — página inicial
// ============================================================
import { $, $$, esc, track, vid, toast, loadConfig, initCommon } from './common.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------- pilares ----------
const ICONS = {
  foco: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  reflexao: '<path d="M2 6c3-1.5 6.5-1.5 10 1 3.5-2.5 7-2.5 10-1v13c-3-1.5-6.5-1.5-10 1-3.5-2.5-7-2.5-10-1z"/><path d="M12 7v13"/>',
  evolucao: '<path d="M4 20V14M10 20V10M16 20V6"/><path d="M3 9l6-5 4 3 7-5M16 2h4v4"/>',
  mentalidade: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4z"/>',
  autoconfianca: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  motivacao: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1.2 2.5 2.2 2.8C10.8 8.6 11.3 5.5 12 3z"/>',
};

const PILLARS = [
  { name: 'Foco', key: 'foco', text: 'Escolher para onde vai sua energia. Menos distração, mais presença no que importa.' },
  { name: 'Reflexão', key: 'reflexao', text: 'Parar, olhar para dentro e entender o porquê. Quem se conhece decide melhor.' },
  { name: 'Evolução', key: 'evolucao', text: 'Crescer um pouco a cada dia. Constância vence intensidade quando o assunto é mudar de vida.' },
  { name: 'Mentalidade', key: 'mentalidade', text: 'Seus pensamentos moldam suas atitudes. Treine a mente como quem treina o corpo.' },
  { name: 'Autoconfiança', key: 'autoconfianca', text: 'Acreditar em si antes da prova chegar. Confiança se constrói com pequenas vitórias.' },
  { name: 'Motivação', key: 'motivacao', text: 'O combustível para começar — e a disciplina para continuar quando a vontade some.' },
];
const iconSvg = (key) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[key]}</svg>`;

function renderPillars() {
  $('#pillars').innerHTML = PILLARS.map((p) => `
    <article class="pillar">
      ${iconSvg(p.key)}
      <h3>${p.name}</h3>
      <p>${p.text}</p>
    </article>`).join('');
}

// ---------- frases ----------
const FALLBACK = [
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

let phrases = FALLBACK;
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
  lastPhrase = pool[Math.floor(Math.random() * pool.length)];
  return lastPhrase;
}

// ---------- roleta ----------
const SEG = 360 / PILLARS.length;
const R = 198;
const pt = (a, r) => [r * Math.sin((a * Math.PI) / 180), -r * Math.cos((a * Math.PI) / 180)];
const f = (n) => n.toFixed(2);

function arc(i, r = R) {
  const [x0, y0] = pt(i * SEG, r);
  const [x1, y1] = pt((i + 1) * SEG, r);
  return `M0 0 L${f(x0)} ${f(y0)} A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)} Z`;
}

function buildWheel() {
  let h = `
    <defs>
      <radialGradient id="segA" cx="0" cy="0" r="${R}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#0b0805"/><stop offset=".7" stop-color="#130d07"/><stop offset="1" stop-color="#1f150a"/>
      </radialGradient>
      <radialGradient id="segB" cx="0" cy="0" r="${R}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#050403"/><stop offset=".7" stop-color="#090705"/><stop offset="1" stop-color="#110c07"/>
      </radialGradient>
      <radialGradient id="segHi" cx="0" cy="0" r="${R}" gradientUnits="userSpaceOnUse">
        <stop offset=".25" stop-color="#f07a2b" stop-opacity="0"/><stop offset=".8" stop-color="#f07a2b" stop-opacity=".28"/><stop offset="1" stop-color="#f5dfab" stop-opacity=".45"/>
      </radialGradient>
      <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f5dfab"/><stop offset=".35" stop-color="#b8862f"/><stop offset=".6" stop-color="#f0d6a0"/><stop offset="1" stop-color="#7a5418"/>
      </linearGradient>
    </defs>
    <circle r="216" fill="url(#ringG)"/>
    <circle r="210.5" fill="#000"/>`;

  PILLARS.forEach((p, i) => { h += `<path class="seg" d="${arc(i)}" fill="url(#${i % 2 ? 'segB' : 'segA'})"/>`; });
  PILLARS.forEach((p, i) => { h += `<path class="seg-hl" data-i="${i}" d="${arc(i)}"/>`; });

  // marcações de mostrador
  for (let k = 0; k < 72; k++) {
    const major = k % 12 === 0;
    const [x0, y0] = pt(k * 5, major ? 198 : 203);
    const [x1, y1] = pt(k * 5, 208);
    h += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="#d4a853" stroke-opacity="${major ? 0.9 : 0.35}" stroke-width="${major ? 1.4 : 1}"/>`;
  }
  // divisórias
  PILLARS.forEach((p, i) => {
    const [x0, y0] = pt(i * SEG, 64);
    const [x1, y1] = pt(i * SEG, R);
    h += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="#d4a853" stroke-opacity=".45" stroke-width="1"/>`;
  });
  h += `<circle r="${R}" fill="none" stroke="#d4a853" stroke-opacity=".5" stroke-width="1"/>
        <circle r="150" fill="none" stroke="#d4a853" stroke-opacity=".07" stroke-width="1"/>`;

  // ícones e nomes
  PILLARS.forEach((p, i) => {
    const c = i * SEG + SEG / 2;
    const flip = c > 180 ? 90 : -90;
    h += `
      <g transform="rotate(${c})">
        <g transform="translate(0,-182) rotate(${-c})">
          <svg x="-9" y="-9" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a853" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.key]}</svg>
        </g>
        <text class="label" transform="translate(0,-128) rotate(${flip})" text-anchor="middle" dominant-baseline="central">${p.name}</text>
      </g>`;
  });
  $('#wheel').innerHTML = h;
}

let rotation = 0;
let spinning = false;

function spin() {
  if (spinning) return;
  spinning = true;
  const wrap = $('#wheelWrap');
  const wheel = $('#wheel');
  $$('.seg-hl', wheel).forEach((el) => el.classList.remove('on'));

  const idx = Math.floor(Math.random() * PILLARS.length);
  const jitter = (Math.random() - 0.5) * SEG * 0.7;
  const target = idx * SEG + SEG / 2 + jitter; // ângulo da roda que para sob o ponteiro
  const residue = (((360 - target) % 360) + 360) % 360;
  const base = rotation - (((rotation % 360) + 360) % 360);
  rotation = base + 360 * 6 + residue;

  wrap.classList.add('spinning');
  $('#spinBtn').disabled = true;
  wheel.style.transform = `rotate(${rotation}deg)`;
  track('spin');

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    wrap.classList.remove('spinning');
    $(`.seg-hl[data-i="${idx}"]`, wheel)?.classList.add('on');
    setTimeout(() => {
      spinning = false;
      $('#spinBtn').disabled = false;
      showPhrase(PILLARS[idx]);
    }, 550);
  };
  wheel.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 6200); // garantia caso o transitionend não dispare
}

function showPhrase(pillar) {
  const p = pickPhrase(pillar.name);
  const key = PILLARS.find((x) => norm(x.name) === norm(p.pillar))?.key || pillar.key;
  $('#revealIcon').innerHTML = iconSvg(key);
  $('#revealPillar').textContent = p.pillar || pillar.name;
  $('#revealText').innerHTML = esc(p.text)
    .split(' ')
    .map((w, i) => `<span style="animation-delay:${0.25 + i * 0.06}s">${w}</span>`)
    .join(' ');
  $('#revealAuthor').textContent = p.author ? `— ${p.author}` : '';
  $('#reveal').hidden = false;
  $('#againBtn').focus({ preventScroll: true });
}

const closeReveal = () => { $('#reveal').hidden = true; };

async function sharePhrase() {
  const text = `“${lastPhrase?.text || ''}” — Pensentir`;
  const url = location.origin;
  try {
    if (navigator.share) { await navigator.share({ text, url }); return; }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Frase copiada. Cole onde quiser.');
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Não foi possível compartilhar agora.');
  }
}

// ---------- produtos ----------
const bookCover = (title) => `<div class="book"><div><img src="/img/logo.png" alt=""/><b>${esc(title)}</b></div></div>`;

function emptyProducts() {
  return `
    <article class="product">
      <div class="product-media">${bookCover('Ebook Pensentir')}<span class="badge">Em breve</span></div>
      <div class="product-body">
        <h3>O ebook da Pensentir está sendo escrito</h3>
        <p class="sub">Autoconfiança, reflexão e os pilares de uma mente forte</p>
        <p class="desc">Um guia prático para fortalecer sua confiança e transformar reflexão em atitude, com exercícios para fazer no seu ritmo.</p>
        <div class="buy"><a class="btn btn-gold" href="#vip">Quero ser avisado</a></div>
      </div>
    </article>`;
}

async function loadProducts() {
  const box = $('#products');
  let list = [];
  try {
    const r = await fetch('/api/products');
    if (r.ok) list = await r.json();
  } catch { /* vazio */ }

  if (!list.length) { box.innerHTML = emptyProducts(); return; }
  const v = vid();
  box.innerHTML = list.map((p) => `
    <article class="product">
      <div class="product-media">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="lazy"/>` : bookCover(p.title)}
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      </div>
      <div class="product-body">
        <h3>${esc(p.title)}</h3>
        ${p.subtitle ? `<p class="sub">${esc(p.subtitle)}</p>` : ''}
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
        <div class="buy">
          <div class="price">
            <b>${brl.format(Number(p.price))}</b>
            ${p.old_price ? `<s>${brl.format(Number(p.old_price))}</s>` : ''}
          </div>
          <a class="btn btn-gold" href="/r/${esc(p.id)}${v ? `?v=${encodeURIComponent(v)}` : ''}" target="_blank" rel="noopener">Comprar agora</a>
          <p class="buy-note">Pagamento seguro pelo Mercado Pago: Pix, cartão ou boleto. Veja a política de <a href="/reembolso">trocas e reembolso</a>.</p>
        </div>
      </div>
    </article>`).join('');
}

// ---------- aviso de lançamento ----------
function setupLeadForm() {
  const form = $('#leadForm');
  const msg = $('#leadMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    msg.className = 'form-msg';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      msg.textContent = 'Digite um e-mail válido, como nome@gmail.com.';
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
      if (!r.ok) throw new Error(j.error || 'Não deu para salvar agora. Tente de novo em instantes.');
      form.reset();
      msg.textContent = 'Pronto. Você vai receber o aviso quando o ebook sair.';
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('err');
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- init ----------
initCommon();
renderPillars();
buildWheel();
setupLeadForm();

$('#spinBtn').addEventListener('click', spin);
$('#hubBtn').addEventListener('click', spin);
$('#againBtn').addEventListener('click', () => { closeReveal(); setTimeout(spin, 200); });
$('#shareBtn').addEventListener('click', sharePhrase);
$('#revealClose').addEventListener('click', closeReveal);
$('#reveal').addEventListener('click', (e) => { if (e.target.id === 'reveal') closeReveal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeReveal(); });

track('pageview');
loadPhrases();
loadConfig();
loadProducts();
