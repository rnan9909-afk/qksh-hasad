/**
 * history-search.js — نافذة بحث في قاعدة النتائج السابقة (قابلة للفتح فوق أي نافذة)
 * ------------------------------------------------------------------
 * تُستخدم في:
 *  - الإدارة: زر التحقق بجانب اسم الطالب (عرض فقط).
 *  - مشرف الاختبارات: مراجعة الترشيح (مع زرّي ترشيح/استبعاد في الأعلى).
 *
 * openHistorySearch({ title, term, mode, schools, actions })
 *   actions: [{ label, className?, style?, onClick }] تظهر أعلى النافذة.
 */

import { searchHistory } from '../services/results-history.service.js';
import { escapeHtml } from '../core/helpers.js';

let overlay = null;

export function openHistorySearch({ title = 'التحقق من الاختبارات السابقة', term = '', mode = 'name', schools = null, actions = [] } = {}) {
  close();
  overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;padding:4vh 1rem;overflow:auto;';
  overlay.innerHTML = `
    <div style="width:100%;max-width:640px;border-radius:1.5rem;padding:1.25rem;background:rgba(255,255,255,.96);backdrop-filter:blur(14px);box-shadow:0 24px 60px -18px rgba(20,51,29,.35);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h3 style="font-weight:800;color:#1E4D2B;display:flex;align-items:center;gap:.5rem;margin:0;font-size:1.05rem;"><span class="material-symbols-outlined">history</span> ${escapeHtml(title)}</h3>
        <button id="hs_close" style="border:none;background:none;cursor:pointer;color:#64748b;padding:.25rem;"><span class="material-symbols-outlined">close</span></button>
      </div>
      ${actions.length ? `<div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;">${actions.map((a, i) => `<button data-hsaction="${i}" class="${a.className || 'btn-primary'}" style="flex:1;min-width:130px;padding:.65rem 1rem;font-weight:700;${a.style || ''}">${escapeHtml(a.label)}</button>`).join('')}</div>` : ''}
      <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;">
        <select id="hs_mode" class="field-select" style="max-width:140px;">
          <option value="name" ${mode === 'name' ? 'selected' : ''}>بحث بالاسم</option>
          <option value="nid" ${mode === 'nid' ? 'selected' : ''}>رقم الهوية</option>
        </select>
        <input id="hs_term" class="field-input" style="flex:1;min-width:180px;" value="${escapeHtml(term)}" placeholder="اكتب جزءاً من الاسم أو رقم الهوية">
        <button id="hs_go" class="btn-primary" style="padding:.5rem 1.2rem;">بحث</button>
      </div>
      <div id="hs_results" style="max-height:52vh;overflow:auto;"></div>
    </div>`;
  document.body.appendChild(overlay);

  const q = (sel) => overlay.querySelector(sel);
  q('#hs_close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  q('#hs_go').addEventListener('click', run);
  q('#hs_term').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });

  actions.forEach((a, i) => {
    const b = overlay.querySelector(`[data-hsaction="${i}"]`);
    if (b) b.addEventListener('click', async () => {
      b.disabled = true;
      try { await a.onClick(); } finally { close(); }
    });
  });

  async function run() {
    const m = q('#hs_mode').value;
    const t = q('#hs_term').value.trim();
    const res = q('#hs_results');
    if (!t) { res.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#94a3b8;">اكتب نص البحث ثم اضغط «بحث»</div>'; return; }
    res.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#94a3b8;">جاري البحث...</div>';
    try {
      const rows = await searchHistory(m === 'nid' ? { nationalId: t, schools } : { name: t, schools });
      if (!rows.length) {
        res.innerHTML = '<div style="text-align:center;padding:1.75rem;color:#059669;font-weight:700;"><span class="material-symbols-outlined" style="vertical-align:middle;">check_circle</span> لا توجد نتائج سابقة — لم يُختبر من قبل</div>';
        return;
      }
      res.innerHTML = `<div style="font-size:.8rem;color:#b45309;font-weight:800;margin-bottom:.5rem;"><span class="material-symbols-outlined" style="vertical-align:middle;font-size:16px;">warning</span> سبق اختباره (${rows.length}):</div>` + rows.map(rowCard).join('');
    } catch (e) {
      res.innerHTML = `<div style="color:#dc2626;padding:1rem;">${escapeHtml(e.message)}</div>`;
    }
  }

  if (term) run();
}

function rowCard(r) {
  return `<div style="border:1px solid #e2e8f0;border-radius:.75rem;padding:.6rem .8rem;margin-bottom:.5rem;background:#fff;">
    <div style="font-weight:700;color:#0f172a;">${escapeHtml(r.name)}</div>
    <div style="font-size:.78rem;color:#475569;margin-top:.2rem;display:flex;gap:.9rem;flex-wrap:wrap;">
      <span>الفصل: <b>${escapeHtml(r.term || '-')}</b></span>
      <span>الأجزاء: <b>${escapeHtml(r.parts || '-')}</b></span>
      <span>الدرجة: <b>${escapeHtml(String(r.score || '-'))}</b></span>
      ${r.nationalId ? `<span>الهوية: <b>${escapeHtml(r.nationalId)}</b></span>` : ''}
    </div>
  </div>`;
}

export function close() {
  if (overlay) { overlay.remove(); overlay = null; }
}
