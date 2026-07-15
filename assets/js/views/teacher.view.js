/**
 * teacher.view.js — لوحة المعلم
 * يشاهد طلابه، يُجري الاختبار الداخلي (نافذة التقييم المشتركة)، ويعتمده.
 */

import { getStudentsByTeacher } from '../services/students.service.js';
import { getExamLevels } from '../services/levels.service.js';
import { approveInternalExam } from '../services/exams.service.js';
import { openExamModal } from '../components/exam-modal.js';
import { downloadCertificate } from '../certificates/certificate.service.js';
import { statusBadge, certCell, nominationBadge, scheduleLine } from '../components/ui-blocks.js';
import { statGrid } from '../components/ui-blocks.js';
import { statusOrder } from '../core/workflow.js';
import { escapeHtml, matchesAllTerms, hasValue, partsCount } from '../core/helpers.js';
import * as toast from '../core/toast.js';

let root, session, levels = [], students = [];

export async function mount(el, sess) {
  root = el; session = sess;
  root.innerHTML = '<div class="text-center py-12 text-slate-400"><span class="material-symbols-outlined animate-spin text-3xl">progress_activity</span></div>';
  levels = await getExamLevels();
  await refresh();
}

async function refresh() {
  students = await getStudentsByTeacher(session.nationalId);
  render();
}

function stats() {
  const total = students.length;
  const internalDone = students.filter((s) => statusOrder(s.status) >= statusOrder('internal_approved')).length;
  const awaiting = students.filter((s) => ['registered', 'awaiting_internal'].includes(s.status)).length;
  const upcoming = students.filter((s) => s.schedule && s.schedule.date && ['scheduled', 'awaiting_final'].includes(s.status)).length;
  return statGrid([
    { label: 'عدد الطلاب', value: total, icon: 'groups', color: 'emerald' },
    { label: 'اختبارات داخلية منجزة', value: internalDone, icon: 'task_alt', color: 'emerald' },
    { label: 'بانتظار الاعتماد', value: awaiting, icon: 'hourglass_top', color: 'amber' },
    { label: 'مواعيد قادمة', value: upcoming, icon: 'event', color: 'amber' },
  ]);
}

function render() {
  root.innerHTML = `
    <div class="flex items-center gap-3 mb-6">
      <div class="size-9 rounded bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined">school</span></div>
      <h1 class="text-xl font-bold">لوحة المعلم</h1>
    </div>
    ${stats()}
    <section class="section-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf3] px-6 py-4">
        <h2 class="text-lg font-bold">طلابي</h2>
        <input id="t_search" class="rounded-lg border border-[#e7edf3] px-4 py-2 text-sm min-w-[220px]" placeholder="بحث بالاسم..." />
      </div>
      <div class="overflow-x-auto">
        <table class="data-table" style="min-width:1040px;">
          <thead><tr><th>م</th><th>الطالب/ة</th><th>المعلم/ة</th><th>المستوى</th><th>الأجزاء</th><th>الداخلي</th><th>الحالة</th><th>الدرجة</th><th>الشهادة</th><th>إجراءات</th></tr></thead>
          <tbody id="t_body"></tbody>
        </table>
      </div>
    </section>`;
  root.querySelector('#t_search').addEventListener('input', renderRows);
  root.querySelector('#t_body').addEventListener('click', onRowClick);
  renderRows();
}

function renderRows() {
  const q = root.querySelector('#t_search').value;
  let list = q ? students.filter((s) => matchesAllTerms(s.name, q)) : students.slice();
  list.sort((a, b) => statusOrder(a.status) - statusOrder(b.status));
  const tb = root.querySelector('#t_body');
  if (!list.length) { tb.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-slate-400">لا يوجد طلاب</td></tr>'; return; }

  tb.innerHTML = list.map((s, i) => {
    const canExam = ['registered', 'awaiting_internal'].includes(s.status);
    const internalScore = s.internal && hasValue(s.internal.score) ? s.internal.score : '-';
    const finalScore = s.final && hasValue(s.final.score) ? s.final.score : '-';
    const action = canExam
      ? `<button data-exam="${escapeHtml(s.id)}" class="btn-primary px-3 py-1.5 text-xs flex items-center gap-1 mx-auto"><span class="material-symbols-outlined text-sm">play_arrow</span> بدء الاختبار الداخلي</button>`
      : `<span class="text-slate-400 text-xs">تم الاعتماد</span>`;
    return `<tr>
      <td class="text-slate-500">${i + 1}</td>
      <td class="font-bold text-secondary">${escapeHtml(s.name)}<div class="text-xs text-slate-400 font-mono">${escapeHtml(s.nationalId)}</div></td>
      <td class="text-xs text-slate-600">${escapeHtml(s.teacherName || '-')}</td>
      <td><span class="bg-slate-100 px-2 py-1 rounded text-xs">${escapeHtml(s.examLevel)}</span></td>
      <td class="text-xs">${escapeHtml(partsCount(s.parts) || '-')}</td>
      <td class="font-bold ${internalScore !== '-' ? 'text-emerald-600' : 'text-slate-300'}">${escapeHtml(String(internalScore))}</td>
      <td>${statusBadge(s.status)}${scheduleLine(s.schedule)}<div class="mt-0.5">${nominationBadge(s)}</div></td>
      <td class="font-bold ${finalScore !== '-' ? 'text-emerald-600' : 'text-slate-300'}">${escapeHtml(String(finalScore))}</td>
      <td>${certCell(s)}</td>
      <td>${action}</td>
    </tr>`;
  }).join('');
}

function onRowClick(e) {
  const certBtn = e.target.closest('[data-cert]');
  if (certBtn) {
    const s = students.find((x) => String(x.id) === certBtn.dataset.cert);
    if (s) printCert(s);
    return;
  }
  const btn = e.target.closest('[data-exam]');
  if (!btn) return;
  const s = students.find((x) => String(x.id) === btn.dataset.exam);
  if (!s) return;
  openExamModal(s, {
    mode: 'internal',
    levels,
    onApprove: async (result) => {
      toast.showLoading('جاري اعتماد الاختبار الداخلي...');
      try {
        const res = await approveInternalExam(s.id, result);
        toast.close();
        if (res.success) { toast.success('تم الاعتماد', 'أصبحت النتيجة جاهزة للإدارة.'); await refresh(); }
        else toast.error('خطأ', res.message);
      } catch (err) { toast.close(); toast.error('خطأ', err.message); }
    },
  });
}

async function printCert(s) {
  toast.showLoading('جاري تجهيز الشهادة...');
  try {
    await downloadCertificate({ name: s.name, nationalId: s.nationalId, score: s.final && s.final.score, level: s.examLevel, school: s.schoolName, parts: s.parts });
    toast.close();
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}
