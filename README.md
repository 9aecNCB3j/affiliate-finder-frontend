# Affiliate Finder (Frontend)

Static search UI for Lazada Affiliate Finder — hosted on **GitHub Pages**.

## Files

- `index.html` — หน้าค้นหา
- `app.js` — ปุ่มค้นหา / เลือกสินค้า / เรียก API
- `config.js` — ตั้งค่า `AFFILIATE_API_BASE` ชี้ไป backend
- `styles.css` — สไตล์หน้าบ้าน

## Setup

1. แก้ `config.js` ให้ชี้ไป Express API ที่รันอยู่ เช่น Cloudflare tunnel
2. Push ขึ้น GitHub แล้วเปิด **Settings → Pages → Deploy from branch `main` / root**
3. เปิด `https://<user>.github.io/<repo>/`

Backend ต้องเปิด CORS (โปรเจกต์นี้ใช้ `cors()` อยู่แล้ว)
