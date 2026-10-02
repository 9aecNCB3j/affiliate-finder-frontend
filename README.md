# Affiliate Finder (Frontend)

Static search UI — **GitHub Pages** + **Google Apps Script** (ไม่ต้องเปิด Node server)

## Files

- `index.html` — หน้าค้นหา
- `app.js` — ปุ่มค้นหา / เลือกสินค้า → เรียก Apps Script
- `config.js` — `AFFILIATE_API_BASE` = URL Web App (`…/exec`)
- `styles.css` — สไตล์

## Setup

1. Deploy Apps Script จาก Sheet (ดู `../apps-script/README.md`)
2. ใส่ URL ใน `config.js`
3. Push ขึ้น GitHub Pages: `https://9aecncb3j.github.io/affiliate-finder-frontend/`

สินค้าต้องมีในชีต `products` หรือ `catalog` ก่อนค้นหา
