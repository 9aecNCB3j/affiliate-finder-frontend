const API_BASE = String(window.AFFILIATE_API_BASE || '')
  .trim()
  .replace(/\/$/, '');

const IS_APPS_SCRIPT = /script\.google\.com/i.test(API_BASE);

const CATALOG_PROXY = String(window.CATALOG_PROXY_BASE || '')
  .trim()
  .replace(/\/$/, '');

const form = document.getElementById('search-form');
const queryInput = document.getElementById('query');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const selectedEl = document.getElementById('selected');
const selectedBody = document.getElementById('selected-body');
const searchBtn = document.getElementById('search-btn');

const PAGE_SIZE = 10;

let lastSearchId = '';
let lastQuery = '';
let lastProducts = [];
let currentPage = 1;
let lastResultMeta = null;

function searchUrl(q, opts = {}) {
  const topN = opts.topN ?? 50;
  const persist = opts.persist ?? true;
  if (IS_APPS_SCRIPT) {
    const u = new URL(API_BASE);
    u.searchParams.set('action', 'search');
    u.searchParams.set('q', q);
    u.searchParams.set('platform', 'lazada');
    u.searchParams.set('topN', String(topN));
    if (!persist) u.searchParams.set('persist', 'false');
    return u.toString();
  }
  const u = new URL(`${API_BASE}/api/search`);
  u.searchParams.set('q', q);
  u.searchParams.set('platform', 'lazada');
  u.searchParams.set('topN', String(topN));
  if (!persist) u.searchParams.set('persist', 'false');
  return u.toString();
}

function catalogProxySearchUrl(q) {
  const u = new URL(`${CATALOG_PROXY}/api/search`);
  u.searchParams.set('q', q);
  u.searchParams.set('platform', 'lazada');
  u.searchParams.set('topN', '50');
  u.searchParams.set('persist', 'false');
  return u.toString();
}

const FALLBACK_IMAGES = {
  fan: [
    'https://images.unsplash.com/photo-1585771724684-38269b663951?w=320&h=320&fit=crop',
    'https://images.unsplash.com/photo-1625869016776-94be63176578?w=320&h=320&fit=crop',
  ],
  shoes: [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=320&h=320&fit=crop',
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=320&h=320&fit=crop',
  ],
  electronics: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=320&h=320&fit=crop',
    'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=320&h=320&fit=crop',
  ],
  home: [
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=320&h=320&fit=crop',
  ],
  general: [
    'https://images.unsplash.com/photo-1472851297630-3b8a6e0c2c3f?w=320&h=320&fit=crop',
  ],
};

function fallbackImageForProduct(p) {
  const hay = `${lastQuery} ${p?.title || ''} ${p?.category || ''}`.toLowerCase();
  let pool = FALLBACK_IMAGES.general;
  if (/พัดลม|fan|ตั้งโต๊ะ/.test(hay)) pool = FALLBACK_IMAGES.fan;
  else if (/รองเท้|sneaker|shoe|ผ้าใบ/.test(hay)) pool = FALLBACK_IMAGES.shoes;
  else if (/electronics|หูฟัง|เมาส์|คีย์บอร์ด|earbuds|headphone/.test(hay)) {
    pool = FALLBACK_IMAGES.electronics;
  } else if (/home|ครัว|หม้อ|กระติก/.test(hay)) pool = FALLBACK_IMAGES.home;
  const id = String(p?.product_id || '0');
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[n % pool.length];
}

function hasRealProductImage(p) {
  const url = String(p?.image_url || '').trim();
  if (!url || /placehold\.co/i.test(url)) return false;
  return /lazcdn\.com/i.test(url);
}

async function fetchSearchResults(q) {
  if (CATALOG_PROXY) {
    try {
      const res = await fetch(catalogProxySearchUrl(q));
      const data = await res.json();
      const products = data.products || [];
      const liveOk =
        !data.error &&
        products.length >= 3 &&
        products.some((p) => p.source === 'lazada-live' && hasRealProductImage(p));
      if (liveOk) {
        return { ...data, searchVia: 'catalog-proxy' };
      }
    } catch {
      /* ใช้ Apps Script ต่อ */
    }
  }

  const res = await fetch(searchUrl(q), { redirect: 'follow' });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (!res.ok) throw new Error(data.error || 'ค้นหาไม่สำเร็จ');
  return { ...data, searchVia: 'apps-script' };
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

function productImageSrc(p) {
  let url = String(p?.image_url || '').trim();
  if (!url || /placehold\.co/i.test(url)) url = fallbackImageForProduct(p);
  if (/lazcdn\.com/i.test(url)) {
    return url.replace(/_\d+x\d+q\d+\.jpg/i, '_320x320q80.jpg');
  }
  return url || fallbackImageForProduct(p);
}

function productThumbHtml(p) {
  return `<img src="${escapeHtml(productImageSrc(p))}" alt="" loading="lazy" decoding="async" />`;
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

function totalPages_() {
  return Math.max(1, Math.ceil(lastProducts.length / PAGE_SIZE));
}

function productCardHtml(p) {
  return `
      <article class="product" data-id="${p.product_id}">
        ${productThumbHtml(p)}
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
      </article>`;
}

function paginationHtml(page, pages, total) {
  if (pages <= 1) return '';
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const prevDisabled = page <= 1 ? ' disabled' : '';
  const nextDisabled = page >= pages ? ' disabled' : '';

  let pageButtons = '';
  for (let i = 1; i <= pages; i += 1) {
    const current = i === page ? ' aria-current="page"' : '';
    pageButtons += `<button type="button" class="pager-num" data-page="${i}"${current}>${i}</button>`;
  }

  return `
    <nav class="results-pager" aria-label="เปลี่ยนหน้ารายการสินค้า">
      <p class="pager-summary">แสดง ${from}–${to} จาก ${total} รายการ · หน้า ${page}/${pages}</p>
      <div class="pager-controls">
        <button type="button" class="pager-prev" data-page="${page - 1}"${prevDisabled} aria-label="หน้าก่อน">ก่อนหน้า</button>
        <div class="pager-nums">${pageButtons}</div>
        <button type="button" class="pager-next" data-page="${page + 1}"${nextDisabled} aria-label="หน้าถัดไป">ถัดไป</button>
      </div>
    </nav>`;
}

function renderResultsView() {
  const pages = totalPages_();
  if (currentPage > pages) currentPage = pages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = lastProducts.slice(start, start + PAGE_SIZE);
  const listHtml = slice.map((p) => productCardHtml(p)).join('');

  resultsEl.innerHTML = `
    <div class="results-list">${listHtml}</div>
    ${paginationHtml(currentPage, pages, lastProducts.length)}
  `;

  if (lastResultMeta?.count) {
    refreshStatusWithPage_();
  }
}

function refreshStatusWithPage_() {
  const { query, count, srcLabel, savedNote } = lastResultMeta;
  const pages = totalPages_();
  const from = (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, count);
  setStatus(
    `พบ Top ${count} รายการสำหรับ “${query}” · ${srcLabel} · ${savedNote} · แสดง ${from}–${to} (หน้า ${currentPage}/${pages}) — กดเลือกเพื่อได้ลิงก์ Affiliate`
  );
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
  setStatus(
    CATALOG_PROXY
      ? 'กำลังดึงสินค้า Lazada (รูปจริง)…'
      : 'กำลังค้นหาและจัดอันดับคุ้มค่าจาก Google Sheet…'
  );
  selectedEl.classList.add('hidden');
  resultsEl.innerHTML = '';
  lastProducts = [];
  currentPage = 1;
  lastResultMeta = null;
  lastQuery = q;

  try {
    const data = await fetchSearchResults(q);

    lastSearchId = data.search_id;
    lastQuery = data.query || q;
    lastProducts = data.products || [];
    currentPage = 1;

    const src = data.products?.[0]?.source || 'catalog';
    const srcLabel =
      data.searchVia === 'catalog-proxy' || src === 'lazada-live'
        ? 'สินค้าจริง Lazada'
        : src === 'sheet'
          ? 'Google Sheet'
          : src === 'catalog'
            ? 'จัดอันดับคุ้มค่า'
            : src;
    const savedNote =
      data.searchVia === 'catalog-proxy'
        ? 'เลือกสินค้าแล้วบันทึกลง Sheet ตอนแปลงลิงก์'
        : 'บันทึก Sheet แล้ว';

    if (!data.count) {
      setStatus(`ไม่พบสินค้าสำหรับ “${lastQuery}”`);
    } else {
      lastResultMeta = {
        query: lastQuery,
        count: data.count,
        srcLabel,
        savedNote,
      };
      renderResultsView();
    }
  } catch (err) {
    setStatus(err.message || 'เชื่อมต่อ Apps Script ไม่ได้');
  } finally {
    searchBtn.disabled = false;
  }
});

resultsEl.addEventListener('click', async (e) => {
  const pageBtn = e.target.closest('button[data-page]');
  if (pageBtn && !pageBtn.disabled) {
    const page = Number(pageBtn.getAttribute('data-page'));
    const pages = totalPages_();
    if (page >= 1 && page <= pages && page !== currentPage) {
      currentPage = page;
      renderResultsView();
      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }

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

    selectedEl.classList.remove('hidden');
    selectedBody.innerHTML = `
      <p><strong>${escapeHtml(product.title)}</strong></p>
      <p>แพลตฟอร์ม: ${escapeHtml(product.platform)} · โหมด: ${escapeHtml(data.affiliate_mode)} · ${escapeHtml(data.provider || '')}</p>
      <p>ลิงก์ Affiliate:</p>
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
