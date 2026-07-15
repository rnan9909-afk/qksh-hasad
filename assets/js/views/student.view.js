/**
 * student.view.js — عرض الطالب (بياناته + الحالة + النتيجة + الشهادة)
 */

import { getStudentsByNationalId } from '../services/students.service.js';
import { downloadCertificate } from '../certificates/certificate.service.js';
import { statusBadge, scheduleBanner } from '../components/ui-blocks.js';
import { escapeHtml } from '../core/helpers.js';
import { passingScoreFor } from '../services/exams.service.js';
import * as toast from '../core/toast.js';

let records = [];

export async function mount(root, session) {
  root.innerHTML = '<div class="text-center py-12 text-slate-400"><span class="material-symbols-outlined animate-spin text-3xl">progress_activity</span></div>';
  records = await getStudentsByNationalId(session.nationalId);

  if (!records.length) {
    root.innerHTML = emptyState();
    return;
  }
  render(root, session.nationalId);

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="download-cert"]');
    if (!btn) return;
    const r = records[Number(btn.dataset.i)];
    if (!r) return;
    toast.showLoading('جاري تجهيز الشهادة...');
    try {
      await downloadCertificate({
        name: r.name, nationalId: r.nationalId, score: (r.final && r.final.score) || '',
        level: r.examLevel, school: r.schoolName, parts: r.parts,
      });
      toast.close();
    } catch (err) { toast.close(); toast.error('تعذّر توليد الشهادة', err.message); }
  });
}

function render(root, nid) {
  root.innerHTML = `<div class="w-full max-w-4xl mx-auto space-y-6">${records.map((r, i) => card(r, i, nid)).join('')}</div>`;
}

function card(r, i, nid) {
  const final = r.final || {};
  const hasResult = ['result_approved', 'certificate_ready', 'failed'].includes(r.status);
  const passed = r.status === 'certificate_ready';
  const failed = r.status === 'failed';
  const score = hasResult ? (final.score || '--') : '--';
  const theme = passed ? 'green' : failed ? 'red' : 'amber';
  const grade = (() => {
    if (failed) return 'لم يجتز';
    if (!passed) return 'قيد الإجراء';
    const s = Number(score);
    if (s >= 90) return 'ممتاز'; if (s >= 80) return 'جيد جداً'; if (s >= 70) return 'جيد'; return 'مقبول';
  })();

  return `<div class="result-card">
    <div class="bg-${theme}-50 border-b border-${theme}-100 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
      ${statusBadge(r.status)}
      <span class="text-slate-500 text-sm font-mono">هوية: ${escapeHtml(nid)}</span>
    </div>
    <div class="p-8 grid lg:grid-cols-12 gap-8">
      <div class="lg:col-span-8 flex flex-col gap-5 order-2 lg:order-1 text-right">
        <h2 class="text-3xl font-black text-slate-800">${escapeHtml(r.name)}</h2>
        ${r.nomination === 'excluded' ? `<div class="border-2 border-red-300 bg-red-50 text-red-700 p-3 rounded-2xl flex items-center gap-2 font-bold"><span class="material-symbols-outlined">block</span> تم استبعاد هذا الطالب من الاختبار (سبق اختباره).</div>` : ''}
        ${scheduleBanner(r.schedule)}
        <div class="grid sm:grid-cols-2 gap-4">
          ${infoBox('domain', 'المجمع / المدرسة', r.schoolName)}
          ${infoBox('menu_book', 'مستوى الاختبار', r.examLevel + (r.parts ? ' — ' + r.parts : ''))}
          ${infoBox('person', 'المعلم/ة', r.teacherName || '-')}
          ${infoBox('groups', 'الحلقة', r.className || '-')}
        </div>
      </div>
      <div class="lg:col-span-4 order-1 lg:order-2 flex flex-col justify-center items-center bg-slate-50 rounded-2xl p-6 border border-slate-100">
        <p class="text-slate-400 text-sm font-bold mb-2">الدرجة النهائية</p>
        <div class="flex items-baseline gap-1 mb-2">
          <span class="text-6xl font-black text-${theme}-600">${score}</span><span class="text-xl text-slate-400 font-bold">/ 100</span>
        </div>
        <span class="bg-${theme}-100 text-${theme}-700 px-3 py-1 rounded-full text-sm font-bold mb-5">${grade}</span>
        ${passed
      ? `<button data-action="download-cert" data-i="${i}" class="btn-primary w-full py-3 flex items-center justify-center gap-2"><span class="material-symbols-outlined">download</span> تحميل الشهادة</button>`
      : `<button disabled class="w-full bg-slate-100 text-slate-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-not-allowed"><span class="material-symbols-outlined">lock</span> الشهادة غير متاحة</button>`}
      </div>
    </div>
  </div>`;
}

function infoBox(icon, label, value) {
  return `<div class="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-start gap-3">
    <div class="bg-white p-2 rounded-lg text-primary shadow-sm"><span class="material-symbols-outlined">${icon}</span></div>
    <div><p class="text-xs text-slate-400 font-bold mb-1">${escapeHtml(label)}</p><p class="font-bold text-slate-700 text-sm">${escapeHtml(value)}</p></div>
  </div>`;
}

function emptyState() {
  return `<div class="text-center py-12"><div class="bg-white rounded-3xl shadow-sm p-12 max-w-md mx-auto">
    <span class="material-symbols-outlined text-6xl text-slate-200 mb-4">search_off</span>
    <h3 class="text-xl font-bold text-slate-700">لا توجد نتائج</h3>
    <p class="text-slate-500 mt-2">لم يتم العثور على أي سجل لرقم هويتك</p>
  </div></div>`;
}
