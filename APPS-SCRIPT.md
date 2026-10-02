# Affiliate Finder — Google Apps Script Backend

แทน Node.js Express ด้วย Apps Script ที่ผูกกับ Google Sheet

## Deploy

1. เปิด [affiliate-sheet-bot Sheet](https://docs.google.com/spreadsheets/d/1UAviqqNmnUGe7IJLyHOUy7IJugj4IRXKh_b7kLyP-Rc/edit)
2. **ส่วนขยาย → Apps Script**
3. ลบโค้ดเดิม แล้ววางจาก `Code.gs`
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. คัดลอก URL ที่ลงท้าย `/exec`
6. ใส่ใน `frontend-pages/config.js` → `AFFILIATE_API_BASE`
7. Push ขึ้น GitHub Pages

## API

| Action | Method | ตัวอย่าง |
|--------|--------|----------|
| search | GET | `?action=search&q=หูฟัง&topN=50` |
| select | POST `text/plain` JSON | `{ "action":"select", "product_id":"...", ... }` |

## ชีตที่ใช้

- `products` / `catalog` — คลังสินค้าสำหรับค้นหา + บันทึกผล
- `searches` — log การค้นหา
- `Video_Monitoring` — เมื่อกดเลือกซื้อ
- `config` — น้ำหนักคะแนน, `top_n`, `lazada_offer_code`

ใส่ `lazada_offer_code` ในชีต config เพื่อให้ลิงก์ Affiliate track ได้จริง
