/**
 * report.js — مولّد تقارير موحّد (معاينة + طباعة PDF + تصدير Excel)
 * ------------------------------------------------------------------
 * نافذة تقرير أنيقة بشعار حصاد وهوامش مناسبة، تُستخدم لكل تقارير النظام.
 *
 * openReport({ title, subtitle?, columns:[{label, key?|get?}], rows, fileName?, footNote? })
 */

import { CONFIG } from '../config.js';

export function openReport({ title, subtitle = '', columns = [], rows = [], fileName = 'تقرير', footNote = '' }) {
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const logoUrl = new URL(CONFIG.LOGO_URL, location.href).href;
  const dateStr = new Date().toISOString().slice(0, 10);

  const thead = columns.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const tbody = rows.length
    ? rows.map((r, i) => `<tr>${columns.map((c) => `<td>${esc(c.get ? c.get(r, i) : r[c.key])}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}">لا توجد بيانات</td></tr>`;

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>${esc(title)}</title>
    <style>
      @page { size: A4; margin: 1.6cm 1.4cm; }
      *{box-sizing:border-box;}
      body{font-family:'Segoe UI','Cairo',Tahoma,sans-serif;margin:0;padding:28px;color:#0f172a;background:#eef3ec;}
      .sheet{max-width:1000px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 10px 40px -12px rgba(20,51,29,.25);overflow:hidden;}
      .head{display:flex;align-items:center;gap:16px;padding:22px 26px;border-bottom:3px solid #1E4D2B;background:linear-gradient(135deg,#f6faf4,#eef3ec);}
      .head img{height:70px;width:auto;}
      .head .t{flex:1;}
      .head h1{margin:0;font-size:1.25rem;color:#1E4D2B;font-weight:800;}
      .head .sub{color:#64748b;font-size:.85rem;margin-top:3px;}
      .head .date{color:#94a3b8;font-size:.78rem;}
      .toolbar{display:flex;gap:10px;justify-content:flex-end;padding:14px 26px;background:#fafcf9;border-bottom:1px solid #e7edf3;}
      button{background:#1E4D2B;color:#fff;border:none;border-radius:9999px;padding:.55rem 1.15rem;font-weight:700;cursor:pointer;font-family:inherit;font-size:.85rem;display:inline-flex;align-items:center;gap:6px;}
      button.g{background:#0f766e;}
      button:hover{filter:brightness(1.08);}
      .body{padding:22px 26px 30px;}
      table{width:100%;border-collapse:collapse;font-size:.85rem;}
      th,td{border:1px solid #e2e8f0;padding:9px 10px;text-align:center;}
      th{background:#1E4D2B;color:#fff;font-weight:700;}
      tr:nth-child(even) td{background:#f7faf6;}
      .foot{padding:14px 26px 24px;color:#94a3b8;font-size:.72rem;text-align:center;border-top:1px solid #eef2f7;}
      @media print{
        body{background:#fff;padding:0;}
        .sheet{box-shadow:none;border-radius:0;max-width:none;}
        .toolbar{display:none;}
        thead{display:table-header-group;}
        tr{page-break-inside:avoid;}
        th{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      }
    </style></head><body>
    <div class="sheet">
      <div class="head">
        <img src="${logoUrl}" alt="حصاد" onerror="this.style.display='none'">
        <div class="t">
          <h1>${esc(title)}</h1>
          ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
          <div class="date">تاريخ التقرير: ${dateStr} — عدد السجلات: ${rows.length}</div>
        </div>
      </div>
      <div class="toolbar">
        <button class="g" onclick="exportExcel()">⬇ تصدير Excel</button>
        <button onclick="window.print()">🖨 طباعة / حفظ PDF</button>
      </div>
      <div class="body">
        <table id="tbl"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
      </div>
      <div class="foot">${footNote ? esc(footNote) + ' — ' : ''}${esc(CONFIG.APP_NAME)}</div>
    </div>
    <script>
      function exportExcel(){
        var h='<html dir="rtl"><head><meta charset="utf-8"><style>th{background:#1E4D2B;color:#fff;}td,th{border:1px solid #ccc;padding:4px 8px;text-align:center;}</style></head><body>'
          + '<h3>'+${JSON.stringify(title)}+'</h3>' + document.getElementById('tbl').outerHTML + '</body></html>';
        var blob=new Blob(['\\ufeff'+h],{type:'application/vnd.ms-excel'});
        var a=document.createElement('a');a.href=URL.createObjectURL(blob);
        a.download=${JSON.stringify(fileName)}+'.xls';a.click();
      }
    <\/script></body></html>`;

  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open(); win.document.write(html); win.document.close();
  return true;
}
