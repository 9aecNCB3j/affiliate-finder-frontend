/**
 * Backend = Google Apps Script Web App URL (ลงท้าย /exec)
 */
window.AFFILIATE_API_BASE =
  window.AFFILIATE_API_BASE ||
  'https://script.google.com/macros/s/AKfycbzqcBnxXvZ6Zk9ZyKs50ejKwEWxANexgffMwMHiOs8Mrl29aBfKW4fUaK4BwwGrUayD/exec';

/**
 * Node catalog (Playwright) — รูป Lazada จริงจาก img.lazcdn.com
 * ต้องรัน npm start + tunnel แล้วใส่ URL ตรงนี้ (ว่าง = ใช้แค่ Apps Script)
 */
window.CATALOG_PROXY_BASE =
  window.CATALOG_PROXY_BASE ||
  'https://hosts-coupons-epic-aud.trycloudflare.com';
