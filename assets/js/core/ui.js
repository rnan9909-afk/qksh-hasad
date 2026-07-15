/**
 * ui.js — أدوات DOM مساعدة
 * ------------------------------------------------------------------
 * اختصارات لإظهار/إخفاء العناصر والوصول إليها وبناء صفوف التحميل.
 */

/** اختيار عنصر واحد. */
export const qs = (sel, root = document) => root.querySelector(sel);

/** اختيار عدة عناصر (كمصفوفة). */
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** الوصول بالمعرّف. */
export const byId = (id) => document.getElementById(id);

/** إظهار عنصر. */
export function show(elOrId) {
  const el = typeof elOrId === 'string' ? byId(elOrId) : elOrId;
  if (el) el.classList.remove('hidden-area');
}

/** إخفاء عنصر. */
export function hide(elOrId) {
  const el = typeof elOrId === 'string' ? byId(elOrId) : elOrId;
  if (el) el.classList.add('hidden-area');
}

/** تبديل الإظهار حسب شرط. */
export function toggle(elOrId, condition) {
  condition ? show(elOrId) : hide(elOrId);
}

/** تعيين نص عنصر بأمان. */
export function setText(elOrId, text) {
  const el = typeof elOrId === 'string' ? byId(elOrId) : elOrId;
  if (el) el.textContent = text;
}

/** تعيين قيمة حقل. */
export function setValue(elOrId, value) {
  const el = typeof elOrId === 'string' ? byId(elOrId) : elOrId;
  if (el) el.value = value;
}

/** بناء صف تحميل داخل جدول. */
export function loadingRow(colspan, message = 'جاري التحميل...') {
  return `<tr><td colspan="${colspan}" class="text-center py-6 text-slate-400">
    <span class="material-symbols-outlined animate-spin text-2xl align-middle ml-2">progress_activity</span> ${message}
  </td></tr>`;
}

/** بناء صف "لا توجد بيانات". */
export function emptyRow(colspan, message = 'لا توجد بيانات', icon = 'search_off') {
  return `<tr><td colspan="${colspan}" class="text-center py-8 text-slate-400">
    <span class="material-symbols-outlined text-4xl mb-2 opacity-50 block">${icon}</span>${message}
  </td></tr>`;
}

/** ملء عنصر <select> بخيارات من مصفوفة. */
export function fillSelect(elOrId, items, { placeholder = null, getValue = (x) => x, getLabel = (x) => x, selected = null } = {}) {
  const el = typeof elOrId === 'string' ? byId(elOrId) : elOrId;
  if (!el) return;
  let html = placeholder != null ? `<option value="">${placeholder}</option>` : '';
  for (const item of items) {
    const v = getValue(item);
    const l = getLabel(item);
    const sel = selected != null && String(v) === String(selected) ? 'selected' : '';
    html += `<option value="${v}" ${sel}>${l}</option>`;
  }
  el.innerHTML = html;
}

/** تعطيل/تفعيل زر مع أيقونة تحميل، وإرجاع دالة الاستعادة. */
export function busyButton(btn, loadingHtml = '<span class="material-symbols-outlined animate-spin">progress_activity</span> جاري...') {
  if (!btn) return () => {};
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = loadingHtml;
  return () => {
    btn.disabled = false;
    btn.innerHTML = original;
  };
}
