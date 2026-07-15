/**
 * ui-blocks.js — مكوّنات واجهة صغيرة قابلة لإعادة الاستخدام
 * (شارة الحالة، بطاقة إحصائية، لافتة الموعد) — تُستخدم عبر كل اللوحات.
 */

import { statusClasses, statusLabel, statusIcon } from '../core/workflow.js';
import { escapeHtml } from '../core/helpers.js';

/** شارة حالة الطالب بلونها الموحّد. */
export function statusBadge(status) {
  const c = statusClasses(status);
  return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${c.badge}">
    <span class="size-[6px] rounded-full ${c.dot}"></span>
    <span class="material-symbols-outlined text-[14px]">${statusIcon(status)}</span>
    ${statusLabel(status)}
  </span>`;
}

/** خلية الشهادة الموحّدة (زر تحميل عند الجاهزية، أو راسب، أو -). */
export function certCell(s) {
  if (s.status === 'certificate_ready') {
    return `<button data-cert="${escapeHtml(s.id)}" class="btn-primary px-3 py-1 text-xs flex items-center gap-1 mx-auto"><span class="material-symbols-outlined text-[16px]">download</span> تحميل</button>`;
  }
  if (s.status === 'failed') return '<span class="text-red-500 text-xs font-bold">راسب</span>';
  return '<span class="text-slate-300">-</span>';
}

/** شارة حالة الترشيح (مرشّح/مستبعد/بانتظار المراجعة). تُرجع '' إن لم تنطبق. */
export function nominationBadge(s) {
  const n = s.nomination || '';
  const wrap = (cls, icon, txt) => `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}"><span class="material-symbols-outlined text-[14px]">${icon}</span> ${txt}</span>`;
  if (n === 'excluded') return wrap('bg-red-50 text-red-700 border border-red-100', 'block', 'مستبعد');
  if (n === 'nominated') return wrap('bg-emerald-50 text-emerald-700 border border-emerald-100', 'how_to_reg', 'مُرشّح');
  if (s.status === 'awaiting_schedule') return wrap('bg-amber-50 text-amber-700 border border-amber-100', 'hourglass_top', 'بانتظار المراجعة');
  return '';
}

/** سطر موعد الاختبار المصغّر (للجداول). */
export function scheduleLine(schedule) {
  if (!schedule || !schedule.date) return '';
  return `<div class="text-[11px] text-red-600 font-bold mt-0.5 flex items-center gap-1 justify-center"><span class="material-symbols-outlined text-[13px]">event</span>${escapeHtml(schedule.date)}${schedule.time ? ' - ' + escapeHtml(schedule.time) : ''}</div>`;
}

/** بطاقة إحصائية. */
export function statCard({ label, value, icon, color = 'emerald' }) {
  return `<div class="stat-card">
    <div class="flex size-10 sm:size-14 items-center justify-center rounded-2xl bg-${color}-100 text-${color}-600 mb-2">
      <span class="material-symbols-outlined text-xl sm:text-3xl">${icon}</span>
    </div>
    <p class="text-[10px] sm:text-sm text-slate-500 font-medium mb-1 whitespace-nowrap">${escapeHtml(label)}</p>
    <p class="text-lg sm:text-3xl font-bold text-slate-800">${escapeHtml(String(value))}</p>
  </div>`;
}

/** شبكة بطاقات إحصائية. */
export function statGrid(cards, cols = 4) {
  return `<div class="grid grid-cols-2 md:grid-cols-${cols} gap-3 sm:gap-4 mb-8">${cards.map(statCard).join('')}</div>`;
}

/** لافتة موعد الاختبار (تظهر لدى الإدارة/المعلم/المشرف/الطالب). */
export function scheduleBanner(schedule) {
  if (!schedule || !schedule.date) return '';
  return `<div class="mt-2 border-2 border-red-400 bg-red-50 p-4 rounded-2xl glowing-red-box flex flex-wrap items-center gap-3">
    <div class="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0">
      <span class="material-symbols-outlined text-2xl">event_available</span>
    </div>
    <div>
      <div class="text-red-700 font-bold flex items-center gap-2 flex-wrap">موعد الاختبار:
        <span class="bg-white px-3 py-1 rounded-lg border border-red-200 font-black">${escapeHtml(schedule.date)}${schedule.time ? ' - ' + escapeHtml(schedule.time) : ''}</span>
      </div>
      ${schedule.supervisorName ? `<div class="text-xs text-red-600 mt-1">المشرف: ${escapeHtml(schedule.supervisorName)}</div>` : ''}
    </div>
  </div>`;
}
