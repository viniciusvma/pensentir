// ============================================================
// PENSENTIR — painel admin
// ============================================================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR');
const dt = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const PILLARS = ['Foco', 'Reflexão', 'Evolução', 'Mentalidade', 'Autoconfiança', 'Motivação'];
const EVENT_LABEL = { pageview: 'Visita', spin: 'Giro na roleta', product_click: 'Clique em produto', ig_click: 'Clique Instagram', fb_click: 'Clique Facebook' };

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', err);
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2800);
}

async function api(url, opts = {}) {
  const o = { credentials: 'same-origin', ...opts };
  if (o.body && !(o.body instanceof FormData)) {
    o.headers = { 'Content-Type': 'application/json', ...(o.headers || {}) };
    o.body = JSON.stringify(o.body);
  }
  const r = await fetch(url, o);
  if (r.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Sessão expirada'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
  return j;
}

// ---------------------------------------------------------------- auth
function showLogin() { $('#app').hidden = true; $('#login').hidden = false; }
function showApp() { $('#login').hidden = true; $('#app').hidden = false; openTab('dash'); }

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginMsg').textContent = '';
  try {
    await api('/api/admin/login', { method: 'POST', body: { password: e.target.password.value } });
    e.target.reset();
    showApp();
  } catch (err) { $('#loginMsg').textContent = err.message; }
});

$('#logoutBtn').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

// ---------------------------------------------------------------- abas
const loaders = { dash: loadDash, products: loadProducts, phrases: loadPhrases, leads: loadLeads, settings: loadSettings };
function openTab(name) {
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => (t.hidden = t.id !== `tab-${name}`));
  loaders[name]().catch((e) => toast(e.message, true));
}
$$('#tabs button').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab)));

// ---------------------------------------------------------------- dashboard
let chart;
$('#daysSel').addEventListener('change', () => loadDash().catch((e) => toast(e.message, true)));

function rankList(el, rows, labelKey, fmt = (v) => v) {
  if (!rows?.length) { el.innerHTML = '<li class="none">Sem dados ainda</li>'; return; }
  const max = Math.max(...rows.map((r) => Number(r.total)));
  el.innerHTML = rows.map((r) => `
    <li><i style="width:${(Number(r.total) / max) * 100}%"></i><span>${esc(fmt(r[labelKey]))}</span><b>${num.format(r.total)}</b></li>`).join('');
}

async function loadDash() {
  const days = $('#daysSel').value;
  const [s, events] = await Promise.all([api(`/api/admin/stats?days=${days}`), api('/api/admin/events')]);

  const kpis = [
    ['Visitas hoje', s.today_pageviews, `${num.format(s.today_visitors)} pessoas`],
    ['Visitas no período', s.pageviews, `${num.format(s.visitors)} pessoas únicas`],
    ['Giros na roleta', s.spins, ''],
    ['Cliques em produtos', s.product_clicks, ''],
    ['Cliques redes sociais', s.social_clicks, ''],
    ['Novos na lista VIP', s.leads, `${num.format(s.leads_total)} no total`],
  ];
  $('#kpis').innerHTML = kpis.map(([l, v, sub]) => `<div class="kpi"><span>${l}</span><b>${num.format(v || 0)}</b><small>${sub}</small></div>`).join('');

  const labels = s.daily.map((d) => d.day.slice(8, 10) + '/' + d.day.slice(5, 7));
  const data = {
    labels,
    datasets: [
      { label: 'Visitas', data: s.daily.map((d) => d.views), borderColor: '#e3b45f', backgroundColor: 'rgba(227,180,95,.15)', fill: true, tension: .35, pointRadius: 0, borderWidth: 2 },
      { label: 'Pessoas únicas', data: s.daily.map((d) => d.visitors), borderColor: '#e8772a', backgroundColor: 'transparent', tension: .35, pointRadius: 0, borderWidth: 2, borderDash: [4, 4] },
    ],
  };
  if (window.Chart) {
    if (chart) { chart.data = data; chart.update(); }
    else {
      chart = new Chart($('#chart'), {
        type: 'line', data,
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: '#bdb3a7', boxWidth: 12 } } },
          scales: {
            x: { ticks: { color: '#8f867c', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,.04)' } },
            y: { beginAtZero: true, ticks: { color: '#8f867c', precision: 0 }, grid: { color: 'rgba(255,255,255,.04)' } },
          },
        },
      });
    }
  }

  rankList($('#refList'), s.referrers, 'source');
  rankList($('#devList'), s.devices, 'device', (d) => ({ mobile: 'Celular', desktop: 'Computador', tablet: 'Tablet' }[d] || d));
  rankList($('#prodList'), s.top_products, 'title');

  $('#eventsTable').innerHTML = events.length
    ? `<tr><th>Quando</th><th>Evento</th><th>Detalhe</th><th>Origem</th><th>Disp.</th></tr>` +
      events.map((e) => `<tr>
        <td>${dt(e.created_at)}</td>
        <td>${EVENT_LABEL[e.type] || esc(e.type)}</td>
        <td>${esc(e.products?.title || e.path || '')}</td>
        <td>${esc(e.referrer || '—')}</td>
        <td>${esc(e.device || '')}</td></tr>`).join('')
    : '<tr><td class="empty">Nenhum evento ainda</td></tr>';
}

// ---------------------------------------------------------------- produtos
let products = [];
async function loadProducts() {
  products = await api('/api/admin/products');
  const box = $('#plist');
  if (!products.length) { box.innerHTML = '<div class="empty">Nenhum produto ainda. Clique em "+ Novo produto".</div>'; return; }
  box.innerHTML = products.map((p) => `
    <div class="pcard">
      <div class="thumb" style="${p.image_url ? `background-image:url('${esc(p.image_url)}')` : ''}">${p.image_url ? '' : 'sem imagem'}</div>
      <div class="body">
        <h4>${esc(p.title)}</h4>
        <div class="meta">
          <b style="color:var(--gold-2)">${brl.format(p.price)}</b>
          <span class="tag ${p.active ? '' : 'off'}">${p.active ? 'Ativo' : 'Oculto'}</span>
          ${p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}
        </div>
        <div class="meta">Ordem ${p.sort_order}</div>
      </div>
      <div class="acts">
        <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Editar</button>
        <button class="btn btn-ghost btn-sm" data-toggle="${p.id}">${p.active ? 'Ocultar' : 'Ativar'}</button>
        <button class="btn btn-danger btn-sm" data-del="${p.id}">Excluir</button>
      </div>
    </div>`).join('');
}

$('#plist').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = b.dataset.edit || b.dataset.toggle || b.dataset.del;
  const p = products.find((x) => x.id === id);
  if (!p) return;
  try {
    if (b.dataset.edit) openProduct(p);
    if (b.dataset.toggle) { await api(`/api/admin/products/${id}`, { method: 'PUT', body: { ...p, active: !p.active } }); await loadProducts(); }
    if (b.dataset.del && confirm(`Excluir "${p.title}"? Não dá pra desfazer.`)) {
      await api(`/api/admin/products/${id}`, { method: 'DELETE' });
      toast('Produto excluído');
      await loadProducts();
    }
  } catch (err) { toast(err.message, true); }
});

const pf = $('#productForm');
const F = pf.elements;
function openProduct(p = null) {
  pf.reset();
  $('#productMsg').textContent = '';
  $('#productModalTitle').textContent = p ? 'Editar produto' : 'Novo produto';
  F.id.value = p?.id || '';
  for (const k of ['title', 'subtitle', 'description', 'price', 'old_price', 'checkout_url', 'image_url', 'badge', 'sort_order']) {
    F[k].value = p?.[k] ?? (k === 'sort_order' ? 0 : '');
  }
  F.active.checked = p ? p.active : true;
  updatePreview();
  $('#productModal').hidden = false;
  F.title.focus();
}
function closeProduct() { $('#productModal').hidden = true; }
function updatePreview() {
  const url = F.image_url.value.trim();
  const img = $('#imgPreview');
  img.hidden = !url;
  if (url) img.src = url;
}

$('#newProductBtn').addEventListener('click', () => openProduct());
$$('[data-close]').forEach((b) => b.addEventListener('click', closeProduct));
$('#productModal').addEventListener('click', (e) => { if (e.target.id === 'productModal') closeProduct(); });
F.image_url.addEventListener('input', updatePreview);

$('#imgFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  $('#productMsg').textContent = 'Enviando imagem...';
  try {
    const { url } = await api('/api/admin/upload', { method: 'POST', body: fd });
    F.image_url.value = url;
    updatePreview();
    $('#productMsg').textContent = '';
  } catch (err) { $('#productMsg').textContent = err.message; }
  e.target.value = '';
});

pf.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    title: F.title.value, subtitle: F.subtitle.value, description: F.description.value,
    price: F.price.value, old_price: F.old_price.value, checkout_url: F.checkout_url.value.trim(),
    image_url: F.image_url.value.trim(), badge: F.badge.value, sort_order: F.sort_order.value, active: F.active.checked,
  };
  const id = F.id.value;
  try {
    await api(id ? `/api/admin/products/${id}` : '/api/admin/products', { method: id ? 'PUT' : 'POST', body });
    closeProduct();
    toast('Produto salvo');
    await loadProducts();
  } catch (err) { $('#productMsg').textContent = err.message; }
});

// ---------------------------------------------------------------- frases
const phf = $('#phraseForm');
phf.pillar.innerHTML = PILLARS.map((p) => `<option>${p}</option>`).join('');
let phrases = [];

async function loadPhrases() {
  phrases = await api('/api/admin/phrases');
  $('#phrasesTable').innerHTML = phrases.length
    ? `<tr><th>Pilar</th><th>Frase</th><th>Status</th><th></th></tr>` +
      phrases.map((p) => `<tr>
        <td><span class="tag">${esc(p.pillar)}</span></td>
        <td>${esc(p.text)}${p.author ? ` <small style="color:var(--muted)">— ${esc(p.author)}</small>` : ''}</td>
        <td><span class="tag ${p.active ? '' : 'off'}">${p.active ? 'Ativa' : 'Oculta'}</span></td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Editar</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${p.id}">${p.active ? 'Ocultar' : 'Ativar'}</button>
          <button class="btn btn-danger btn-sm" data-del="${p.id}">Excluir</button>
        </td></tr>`).join('')
    : '<tr><td class="empty">Nenhuma frase. O site usa as frases padrão enquanto isso.</td></tr>';
}

phf.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/phrases', { method: 'POST', body: { pillar: phf.pillar.value, text: phf.text.value, author: phf.author.value } });
    phf.text.value = ''; phf.author.value = '';
    toast('Frase adicionada');
    await loadPhrases();
  } catch (err) { toast(err.message, true); }
});

$('#phrasesTable').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = b.dataset.edit || b.dataset.toggle || b.dataset.del;
  const p = phrases.find((x) => x.id === id);
  if (!p) return;
  try {
    if (b.dataset.edit) {
      const text = prompt('Editar frase:', p.text);
      if (text === null || !text.trim()) return;
      await api(`/api/admin/phrases/${id}`, { method: 'PUT', body: { text } });
    }
    if (b.dataset.toggle) await api(`/api/admin/phrases/${id}`, { method: 'PUT', body: { active: !p.active } });
    if (b.dataset.del) {
      if (!confirm('Excluir esta frase?')) return;
      await api(`/api/admin/phrases/${id}`, { method: 'DELETE' });
    }
    await loadPhrases();
  } catch (err) { toast(err.message, true); }
});

// ---------------------------------------------------------------- leads
async function loadLeads() {
  const leads = await api('/api/admin/leads');
  $('#leadCount').textContent = `(${num.format(leads.length)})`;
  $('#leadsTable').innerHTML = leads.length
    ? `<tr><th>Nome</th><th>E-mail</th><th>Data</th><th></th></tr>` +
      leads.map((l) => `<tr>
        <td>${esc(l.name || '—')}</td><td>${esc(l.email)}</td><td>${dt(l.created_at)}</td>
        <td class="actions"><button class="btn btn-danger btn-sm" data-del="${l.id}">Remover</button></td></tr>`).join('')
    : '<tr><td class="empty">Ninguém na lista ainda</td></tr>';
}

$('#leadsTable').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-del]');
  if (!b || !confirm('Remover este e-mail da lista?')) return;
  try { await api(`/api/admin/leads/${b.dataset.del}`, { method: 'DELETE' }); await loadLeads(); }
  catch (err) { toast(err.message, true); }
});

// ---------------------------------------------------------------- configurações
async function loadSettings() {
  const s = await api('/api/admin/settings');
  const f = $('#settingsForm');
  f.instagram_url.value = s.instagram_url;
  f.facebook_url.value = s.facebook_url;
  f.contact_email.value = s.contact_email;
  const l = $('#legalForm');
  l.legal_name.value = s.legal_name;
  l.legal_doc.value = s.legal_doc;
  l.legal_address.value = s.legal_address;
}

$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/admin/settings', { method: 'PUT', body: { instagram_url: f.instagram_url.value.trim(), facebook_url: f.facebook_url.value.trim(), contact_email: f.contact_email.value.trim() } });
    toast('Links salvos');
  } catch (err) { toast(err.message, true); }
});

$('#legalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/admin/settings', { method: 'PUT', body: { legal_name: f.legal_name.value.trim(), legal_doc: f.legal_doc.value.trim(), legal_address: f.legal_address.value.trim() } });
    toast('Dados salvos');
  } catch (err) { toast(err.message, true); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProduct(); });

// ---------------------------------------------------------------- start
api('/api/admin/me').then(showApp).catch(showLogin);
