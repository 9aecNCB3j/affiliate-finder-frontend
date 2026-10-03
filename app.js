const API_BASE = String(window.AFFILIATE_API_BASE || '')
  .trim()
  .replace(/\/$/, '');

const IS_APPS_SCRIPT = /script\.google\.com/i.test(API_BASE);

const form = document.getElementById('search-form');
const queryInput = document.getElementById('query');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const selectedEl = document.getElementById('selected');
const selectedBody = document.getElementById('selected-body');
const searchBtn = document.getElementById('search-btn');

const TOP_N = 10;

let lastSearchId = '';
let lastQuery = '';
let lastProducts = [];

function selectedPlatform() {
  const picked = form.querySelector('input[name="platform"]:checked');
  return picked ? picked.value : 'both';
}

function platformName(platform) {
  if (platform === 'shopee') return 'Shopee';
  if (platform === 'lazada') return 'Lazada';
  return platform || '';
}

function searchUrl(q) {
  const platform = selectedPlatform();
  if (IS_APPS_SCRIPT) {
    const u = new URL(API_BASE);
    u.searchParams.set('action', 'search');
    u.searchParams.set('q', q);
    u.searchParams.set('platform', platform);
    u.searchParams.set('topN', String(TOP_N));
    u.searchParams.set('persist', 'false');
    return u.toString();
  }
  const u = new URL(`${API_BASE}/api/search`);
  u.searchParams.set('q', q);
  u.searchParams.set('platform', platform);
  u.searchParams.set('topN', String(TOP_N));
  u.searchParams.set('persist', 'false');
  return u.toString();
}

async function fetchSearchResults(q) {
  const res = await fetch(searchUrl(q), { redirect: 'follow' });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (!res.ok) throw new Error(data.error || 'ค้นหาไม่สำเร็จ');
  return data;
}

function selectUrl() {
  if (IS_APPS_SCRIPT) return API_BASE;
  return `${API_BASE}/api/select-product`;
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

function productCardHtml(p) {
  return `
      <article class="product" data-id="${p.product_id}">
        <div>
          <h3>${escapeHtml(p.title)}</h3>
          <div class="meta">
            <span class="badge rank">#${p.rank}</span>
            <span class="badge platform platform-${escapeHtml(p.platform)}">${escapeHtml(platformName(p.platform))}</span>
            <span class="badge score">คะแนน ${p.value_score}</span>
            ${priceHtml(p)}
            <span>ลด ${p.discount_pct}%</span>
            <span>คอม ${p.commission_pct}%</span>
            <span>${p.free_shipping ? 'ส่งฟรี' : 'มีค่าส่ง'}</span>
          </div>
        </div>
        <button type="button" data-select='${escapeAttr(JSON.stringify(p))}'>เลือก & แปลงลิงก์</button>
      </article>`;
}

function renderResults(products) {
  resultsEl.innerHTML = `
    <div class="results-list">${products.map((p) => productCardHtml(p)).join('')}</div>
  `;
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

async function postSelect(payload) {
  // Apps Script: text/plain เลี่ยง CORS preflight
  if (IS_APPS_SCRIPT) {
    const res = await fetch(selectUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'select', ...payload }),
      redirect: 'follow',
    });
    return res.json();
  }
  const res = await fetch(selectUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'แปลงลิงก์ไม่สำเร็จ');
  return data;
}

if (!API_BASE) {
  setStatus('ยังไม่ได้ตั้ง API ใน config.js — ใส่ URL ของ Apps Script (/exec)');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = queryInput.value.trim();
  if (!q) return;
  if (!API_BASE) {
    setStatus('ตั้งค่า AFFILIATE_API_BASE ใน config.js ก่อน (URL Apps Script)');
    return;
  }

  searchBtn.disabled = true;
  const looking = selectedPlatform() === 'both' ? 'Lazada และ Shopee' : platformName(selectedPlatform());
  setStatus(`กำลังค้นหา ${looking}…`);
  selectedEl.classList.add('hidden');
  resultsEl.innerHTML = '';
  lastProducts = [];
  lastQuery = q;

  try {
    const data = await fetchSearchResults(q);

    lastSearchId = data.search_id;
    lastQuery = data.query || q;
    lastProducts = data.products || [];

    if (!data.count) {
      setStatus(data.warning || `ไม่พบสินค้าสำหรับ “${lastQuery}”`);
    } else {
      renderResults(lastProducts);
      const mix = `Lazada ${data.lazada_count ?? lastProducts.filter((p) => p.platform === 'lazada').length} · Shopee ${data.shopee_count ?? lastProducts.filter((p) => p.platform === 'shopee').length}`;
      setStatus(
        `พบ Top ${data.count} รายการสำหรับ “${lastQuery}” · ${mix}${data.warning ? ' · ' + data.warning : ''} · กดเลือกเพื่อแปลงลิงก์และบันทึก`
      );
    }
  } catch (err) {
    setStatus(err.message || 'เชื่อมต่อ Apps Script ไม่ได้');
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
    const data = await postSelect({
      ...product,
      query: lastQuery,
      search_id: lastSearchId,
    });
    if (data.error) throw new Error(data.error);

    const affUrl = data.affiliate_url || data.short_link || '';
    const isLazadaLink =
      data.provider === 'adsense-convert-v2' ||
      data.provider === 'adsense-convert-v1' ||
      /^https?:\/\/s\.lazada\.co\.th\//i.test(affUrl);
    const isShopeeLink =
      product.platform === 'shopee' &&
      (data.provider === 'shopee-short' ||
        data.provider === 'shopee-custom-link' ||
        /^https?:\/\/s\.shopee\.co\.th\//i.test(affUrl) ||
        /\/s\/\d+\/\d+\/?$/.test(affUrl));
    const isReal = isLazadaLink || isShopeeLink;

    selectedEl.classList.remove('hidden');
    selectedBody.innerHTML = `
      <p><strong>${escapeHtml(product.title)}</strong></p>
      <p>แพลตฟอร์ม: ${escapeHtml(platformName(product.platform))} · ${escapeHtml(data.provider || data.affiliate_mode || '')}</p>
      <p>${isReal ? 'ลิงก์ Affiliate ของคุณ (กดเพื่อสั่งซื้อ):' : 'ลิงก์:'}</p>
      <p><a class="aff-link" href="${escapeHtml(affUrl)}" target="_blank" rel="noopener">${escapeHtml(affUrl)}</a></p>
      <p class="aff-actions">
        <a class="btn-buy" href="${escapeHtml(affUrl)}" target="_blank" rel="noopener">เปิดลิงก์สั่งซื้อ</a>
        <button type="button" class="btn-copy" data-copy="${escapeAttr(affUrl)}">คัดลอกลิงก์</button>
      </p>
      ${
        data.warning
          ? `<p class="status" style="color:var(--warn)">${escapeHtml(data.warning)}</p>`
          : `<p class="status">${isReal ? 'แปลงลิงก์ Affiliate สำเร็จ · บันทึก Sheet แล้ว' : 'บันทึก Sheet แล้ว'}</p>`
      }
    `;
    setStatus(
      isReal
        ? 'ได้ลิงก์ Affiliate แล้ว — กด “เปิดลิงก์สั่งซื้อ” เพื่อซื้อด้วยตัวเอง'
        : 'เลือกสินค้าแล้ว แต่ยังไม่ใช่ลิงก์ Affiliate จริง'
    );
    selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    setStatus(err.message || 'แปลงลิงก์ไม่สำเร็จ');
  } finally {
    btn.disabled = false;
  }
});

selectedBody.addEventListener('click', async (e) => {
  const copyBtn = e.target.closest('[data-copy]');
  if (!copyBtn) return;
  const text = copyBtn.getAttribute('data-copy') || '';
  try {
    await navigator.clipboard.writeText(text);
    setStatus('คัดลอกลิงก์ Affiliate แล้ว');
  } catch {
    setStatus('คัดลอกไม่สำเร็จ — ลากเลือกลิงก์แล้วคัดลอกเอง');
  }
});
