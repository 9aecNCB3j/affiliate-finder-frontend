const API_BASE = String(window.AFFILIATE_API_BASE || '')
  .trim()
  .replace(/\/$/, '');

const form = document.getElementById('search-form');
const queryInput = document.getElementById('query');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const selectedEl = document.getElementById('selected');
const selectedBody = document.getElementById('selected-body');
const searchBtn = document.getElementById('search-btn');

let lastSearchId = '';
let lastQuery = '';

function apiUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function baht(n) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function setStatus(text) {
  statusEl.textContent = text || '';
}

function priceHtml(p) {
  const price = Number(p.price) || 0;
  const original = Number(p.original_price) || 0;
  const showOriginal = original > price && original > 0;
  return `
    <span class="price">
      <span class="price-now">${baht(price)}</span>
      ${showOriginal ? `<s class="price-was">${baht(original)}</s>` : ''}
    </span>`;
}

function renderProducts(products) {
  resultsEl.innerHTML = products
    .map(
      (p) => `
      <article class="product" data-id="${p.product_id}">
        <img src="${p.image_url}" alt="" loading="lazy" />
        <div>
          <h3>${escapeHtml(p.title)}</h3>
          <div class="meta">
            <span class="badge rank">#${p.rank}</span>
            <span class="badge score">คะแนน ${p.value_score}</span>
            ${priceHtml(p)}
            <span>ลด ${p.discount_pct}%</span>
            <span>คอม ${p.commission_pct}%</span>
            <span>${p.free_shipping ? 'ส่งฟรี' : 'มีค่าส่ง'}</span>
          </div>
        </div>
        <button type="button" data-select='${escapeAttr(JSON.stringify(p))}'>เลือก & แปลงลิงก์</button>
      </article>`
    )
    .join('');
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("'", '&#39;');
}

if (!API_BASE) {
  setStatus('ยังไม่ได้ตั้ง API ใน config.js — แก้ AFFILIATE_API_BASE ก่อนค้นหา');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = queryInput.value.trim();
  if (!q) return;
  if (!API_BASE) {
    setStatus('ตั้งค่า AFFILIATE_API_BASE ใน config.js ก่อน');
    return;
  }

  searchBtn.disabled = true;
  setStatus('กำลังค้นหาและจัดอันดับคุ้มค่า…');
  selectedEl.classList.add('hidden');
  resultsEl.innerHTML = '';

  try {
    const res = await fetch(
      apiUrl(`/api/search?q=${encodeURIComponent(q)}&platform=lazada&topN=50`)
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'ค้นหาไม่สำเร็จ');

    lastSearchId = data.search_id;
    lastQuery = data.query;
    renderProducts(data.products);
    const src = data.products?.[0]?.source || '';
    const srcLabel =
      src === 'lazada-live' ? 'สินค้าจริง Lazada' : src === 'mock' ? 'mock' : src;
    setStatus(
      `พบ Top ${data.count} รายการสำหรับ “${data.query}” · ${srcLabel} · บันทึก Sheet แล้ว`
    );
  } catch (err) {
    setStatus(err.message || 'เชื่อมต่อ API ไม่ได้');
  } finally {
    searchBtn.disabled = false;
  }
});

resultsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-select]');
  if (!btn) return;
  if (!API_BASE) {
    setStatus('ตั้งค่า AFFILIATE_API_BASE ใน config.js ก่อน');
    return;
  }

  const product = JSON.parse(btn.getAttribute('data-select'));
  btn.disabled = true;
  setStatus(`กำลังแปลงลิงก์ Affiliate สำหรับ ${product.product_id}…`);

  try {
    const res = await fetch(apiUrl('/api/select-product'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...product,
        query: lastQuery,
        search_id: lastSearchId,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'แปลงลิงก์ไม่สำเร็จ');

    selectedEl.classList.remove('hidden');
    selectedBody.innerHTML = `
      <p><strong>${escapeHtml(product.title)}</strong></p>
      <p>แพลตฟอร์ม: ${escapeHtml(product.platform)} · โหมด: ${escapeHtml(data.affiliate_mode)} · ${escapeHtml(data.provider || '')}</p>
      <p>ลิงก์ Affiliate จริง:</p>
      <p><a class="aff-link" href="${escapeHtml(data.affiliate_url)}" target="_blank" rel="noopener">${escapeHtml(data.affiliate_url)}</a></p>
      ${
        data.warning
          ? `<p class="status" style="color:var(--warn)">${escapeHtml(data.warning)}</p>`
          : `<p class="status">บันทึกลง Google Sheet แล้ว</p>`
      }
    `;
    setStatus('เลือกสินค้าสำเร็จ — กดลิงก์เพื่อสั่งซื้อบนมือถือ');
    selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    setStatus(err.message || 'แปลงลิงก์ไม่สำเร็จ');
  } finally {
    btn.disabled = false;
  }
});
