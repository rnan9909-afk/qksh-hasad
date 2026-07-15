/**
 * examsupervisor.view.js — لوحة مشرف الاختبارات
 * استقبال الطلبات، تحديد/تعديل الموعد، إجراء الاختبار النهائي واعتماده،
 * طباعة الشهادة.
 */

import { getAllStudents } from '../services/students.service.js';
import { getExamLevels } from '../services/levels.service.js';
import { getSchools } from '../services/schools.service.js';
import { getUser } from '../services/users.service.js';
import { setSession } from '../core/session.js';
import { scheduleExam, approveFinalExam, nominateStudent, excludeStudent } from '../services/exams.service.js';
import { openExamModal } from '../components/exam-modal.js';
import { openHistorySearch } from '../components/history-search.js';
import { downloadCertificate } from '../certificates/certificate.service.js';
import { statusBadge, certCell, nominationBadge, scheduleLine } from '../components/ui-blocks.js';
import { statGrid } from '../components/ui-blocks.js';
import { statusOrder } from '../core/workflow.js';
import { escapeHtml, matchesAllTerms, hasValue, today, partsCount } from '../core/helpers.js';
import * as toast from '../core/toast.js';

let root, session, levels = [], students = [];
let mySchools = [];       // معرّفات مدارس المشرف المُسندة
let mySchoolNames = [];   // {id,name} لمدارسه فقط

export async function mount(el, sess) {
  root = el; session = sess;
  root.innerHTML = loading();
  // جلب مدارس المشرف الحالية من قاعدة البيانات (تفادي الجلسة القديمة إن أُسندت مدارس بعد الدخول)
  mySchools = Array.isArray(session.schools) ? session.schools : [];
  try {
    const fresh = await getUser(session.nationalId);
    if (fresh && Array.isArray(fresh.schools)) {
      mySchools = fresh.schools;
      // تحديث الجلسة كي تبقى بقية الصفحات متزامنة
      setSession({ ...session, schools: mySchools });
    }
  } catch { /* في حال تعذّر الجلب نكتفي بمدارس الجلسة */ }
  const [lv, allSchools] = await Promise.all([getExamLevels(), getSchools()]);
  levels = lv;
  mySchoolNames = allSchools.filter((s) => mySchools.includes(s.id));
  await refresh();
}

async function refresh() {
  const all = await getAllStudents();
  // الطلاب الذين وصلوا مرحلة الطلب فأكثر، وضمن مدارس المشرف المُسندة فقط
  students = all.filter((s) =>
    statusOrder(s.status) >= statusOrder('awaiting_schedule') &&
    mySchools.includes(s.schoolId));
  render();
}

function stats() {
  const t = today();
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const newReq = students.filter((s) => s.status === 'awaiting_schedule' && s.nomination !== 'excluded').length;
  const todayExams = students.filter((s) => s.schedule && s.schedule.date === t && ['scheduled', 'awaiting_final'].includes(s.status)).length;
  const weekExams = students.filter((s) => {
    if (!s.schedule || !s.schedule.date) return false;
    if (!['scheduled', 'awaiting_final'].includes(s.status)) return false;
    const d = new Date(s.schedule.date);
    return d >= new Date(t) && d <= weekEnd;
  }).length;
  const done = students.filter((s) => ['result_approved', 'certificate_ready', 'failed'].includes(s.status)).length;
  return statGrid([
    { label: 'طلبات جديدة', value: newReq, icon: 'inbox', color: 'amber' },
    { label: 'اختبارات اليوم', value: todayExams, icon: 'today', color: 'lime' },
    { label: 'اختبارات الأسبوع', value: weekExams, icon: 'date_range', color: 'emerald' },
    { label: 'اختبارات منتهية', value: done, icon: 'fact_check', color: 'emerald' },
  ]);
}

function render() {
  if (!mySchools.length) {
    root.innerHTML = `<div class="section-card p-10 text-center text-slate-500">
      <span class="material-symbols-outlined text-5xl text-slate-300 block mb-3">domain_disabled</span>
      <h2 class="text-lg font-bold mb-1">لم تُسند إليك أي مدرسة بعد</h2>
      <p class="text-sm">يرجى مراجعة المشرف العام لإسناد مدرسة أو أكثر لك.</p>
    </div>`;
    return;
  }
  root.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <div class="flex items-center gap-3">
        <div class="size-9 rounded bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined">rule</span></div>
        <h1 class="text-xl font-bold">لوحة مشرف الاختبارات</h1>
      </div>
      <button id="s_appointments" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">calendar_month</span> مواعيد الاختبارات</button>
    </div>
    <div class="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
      <span class="material-symbols-outlined text-[18px] text-primary">domain</span> مدارسي:
      ${mySchoolNames.map((s) => `<span class="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">${escapeHtml(s.name)}</span>`).join('')}
    </div>
    ${stats()}
    <section class="section-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf3] px-6 py-4">
        <h2 class="text-lg font-bold">طلبات الاختبار</h2>
        <div class="flex gap-2 flex-wrap">
          <select id="s_school" class="rounded-lg border border-[#e7edf3] px-3 py-2 text-sm">
            <option value="all">كل مدارسي</option>
            ${mySchoolNames.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
          <select id="s_filter" class="rounded-lg border border-[#e7edf3] px-3 py-2 text-sm">
            <option value="all">كل الحالات</option>
            <option value="awaiting_schedule">طلبات جديدة</option>
            <option value="scheduled">مجدولة</option>
            <option value="done">منتهية</option>
          </select>
          <input id="s_search" class="rounded-lg border border-[#e7edf3] px-4 py-2 text-sm min-w-[200px]" placeholder="بحث بالاسم..." />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table" style="min-width:1080px;">
          <thead><tr><th>م</th><th>الطالب/ة</th><th>المعلم/ة</th><th>المستوى</th><th>الأجزاء</th><th>الداخلي</th><th>الترشيح</th><th>الحالة</th><th>الدرجة</th><th>الشهادة</th><th>إجراءات</th></tr></thead>
          <tbody id="s_body"></tbody>
        </table>
      </div>
    </section>`;
  root.querySelector('#s_search').addEventListener('input', renderRows);
  root.querySelector('#s_filter').addEventListener('change', renderRows);
  root.querySelector('#s_school').addEventListener('change', renderRows);
  root.querySelector('#s_body').addEventListener('click', onRowClick);
  root.querySelector('#s_appointments').addEventListener('click', showAppointments);
  renderRows();
}

function renderRows() {
  const q = root.querySelector('#s_search').value;
  const f = root.querySelector('#s_filter').value;
  const sch = root.querySelector('#s_school').value;
  let list = students.slice();
  if (sch && sch !== 'all') list = list.filter((s) => s.schoolId === sch);
  if (q) list = list.filter((s) => matchesAllTerms(s.name, q));
  if (f === 'awaiting_schedule') list = list.filter((s) => s.status === 'awaiting_schedule');
  else if (f === 'scheduled') list = list.filter((s) => ['scheduled', 'awaiting_final'].includes(s.status));
  else if (f === 'done') list = list.filter((s) => ['result_approved', 'certificate_ready', 'failed'].includes(s.status));
  list.sort((a, b) => statusOrder(a.status) - statusOrder(b.status));

  const tb = root.querySelector('#s_body');
  if (!list.length) { tb.innerHTML = '<tr><td colspan="11" class="text-center py-8 text-slate-400">لا توجد طلبات</td></tr>'; return; }

  tb.innerHTML = list.map((s, i) => {
    const internalScore = s.internal && hasValue(s.internal.score) ? s.internal.score : '-';
    const finalScore = s.final && hasValue(s.final.score) ? s.final.score : '-';
    const nom = s.nomination || 'pending';
    const actions = [];
    // زر المراجعة (بحث في القاعدة + ترشيح/استبعاد) متاح دائماً قبل الاختبار النهائي
    if (s.status === 'awaiting_schedule' || nom === 'excluded') {
      actions.push(`<button data-review="${escapeHtml(s.id)}" class="text-primary bg-primary/10 px-3 py-1.5 text-xs rounded flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">fact_check</span> مراجعة الترشيح</button>`);
    }
    if (s.status === 'awaiting_schedule' && nom === 'nominated') {
      actions.push(`<button data-schedule="${escapeHtml(s.id)}" class="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">calendar_month</span> تحديد موعد</button>`);
    } else if (['scheduled', 'awaiting_final'].includes(s.status)) {
      actions.push(`<button data-schedule="${escapeHtml(s.id)}" class="text-emerald-600 bg-emerald-50 p-1.5 rounded" title="تعديل الموعد"><span class="material-symbols-outlined text-[18px]">edit_calendar</span></button>`);
      actions.push(`<button data-final="${escapeHtml(s.id)}" class="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">play_arrow</span> الاختبار النهائي</button>`);
    }
    return `<tr>
      <td class="text-slate-500">${i + 1}</td>
      <td class="font-bold text-secondary">${escapeHtml(s.name)}<div class="text-xs text-slate-400">${escapeHtml(s.schoolName || '')}</div></td>
      <td class="text-xs text-slate-600">${escapeHtml(s.teacherName || '-')}</td>
      <td><span class="bg-slate-100 px-2 py-1 rounded text-xs">${escapeHtml(s.examLevel)}</span></td>
      <td class="text-xs">${escapeHtml(partsCount(s.parts) || '-')}</td>
      <td class="font-bold ${internalScore !== '-' ? 'text-emerald-600' : 'text-slate-300'}">${escapeHtml(String(internalScore))}</td>
      <td>${nominationBadge(s)}</td>
      <td>${statusBadge(s.status)}${scheduleLine(s.schedule)}</td>
      <td class="font-bold ${finalScore !== '-' ? 'text-emerald-600' : 'text-slate-300'}">${escapeHtml(String(finalScore))}</td>
      <td>${certCell(s)}</td>
      <td><div class="flex items-center justify-center gap-1.5 flex-wrap">${actions.join('')}</div></td>
    </tr>`;
  }).join('');
}

function onRowClick(e) {
  const rev = e.target.closest('[data-review]');
  if (rev) return openReview(students.find((s) => String(s.id) === rev.dataset.review));
  const sch = e.target.closest('[data-schedule]');
  if (sch) return openSchedule(students.find((s) => String(s.id) === sch.dataset.schedule));
  const fin = e.target.closest('[data-final]');
  if (fin) return startFinal(students.find((s) => String(s.id) === fin.dataset.final));
  const cert = e.target.closest('[data-cert]');
  if (cert) return printCert(students.find((s) => String(s.id) === cert.dataset.cert));
}

/** مراجعة الترشيح: بحث في قاعدة النتائج السابقة + ترشيح/استبعاد. */
function openReview(s) {
  if (!s) return;
  openHistorySearch({
    title: `مراجعة ترشيح: ${s.name}`,
    term: s.name,
    schools: mySchools,
    actions: [
      {
        label: 'ترشيح', className: 'btn-primary',
        onClick: async () => {
          toast.showLoading('جاري الترشيح...');
          try { await nominateStudent(s.id); toast.close(); toast.success('تم الترشيح', 'يمكنك الآن تحديد موعد الاختبار.'); await refresh(); }
          catch (err) { toast.close(); toast.error('خطأ', err.message); }
        },
      },
      {
        label: 'استبعاد', style: 'background:#dc2626;color:#fff;border:none;border-radius:9999px;box-shadow:0 8px 20px -8px rgba(220,38,38,.5);',
        onClick: async () => {
          toast.showLoading('جاري الاستبعاد...');
          try { await excludeStudent(s.id); toast.close(); toast.info('تم الاستبعاد', 'أُلغي موعد الطالب (إن وُجد) وظهرت الحالة للإدارة والمعلم.'); await refresh(); }
          catch (err) { toast.close(); toast.error('خطأ', err.message); }
        },
      },
    ],
  });
}

/** عرض كل مواعيد الاختبارات التي حدّدها المشرف لمدارسه. */
async function showAppointments() {
  const appts = students
    .filter((s) => s.schedule && s.schedule.date && ['scheduled', 'awaiting_final'].includes(s.status))
    .sort((a, b) => String(a.schedule.date + (a.schedule.time || '')).localeCompare(String(b.schedule.date + (b.schedule.time || ''))));
  const rows = appts.length
    ? appts.map((s, i) => `<tr>
        <td style="padding:.4rem .5rem;color:#64748b;">${i + 1}</td>
        <td style="padding:.4rem .5rem;font-weight:700;">${escapeHtml(s.name)}</td>
        <td style="padding:.4rem .5rem;font-size:.8rem;">${escapeHtml(s.schoolName || '-')}</td>
        <td style="padding:.4rem .5rem;font-size:.8rem;">${escapeHtml(s.examLevel || '-')}</td>
        <td style="padding:.4rem .5rem;font-weight:700;color:#b91c1c;white-space:nowrap;">${escapeHtml(s.schedule.date)}${s.schedule.time ? '<br>' + escapeHtml(s.schedule.time) : ''}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#94a3b8;">لا توجد مواعيد محدّدة حالياً</td></tr>';
  await window.Swal.fire({
    title: 'مواعيد الاختبارات',
    width: 720,
    html: `<div style="overflow:auto;"><table style="width:100%;border-collapse:collapse;text-align:right;font-family:inherit;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:.5rem;">م</th><th style="padding:.5rem;">الطالب/ة</th><th style="padding:.5rem;">المدرسة</th><th style="padding:.5rem;">المستوى</th><th style="padding:.5rem;">الموعد</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
    confirmButtonText: 'إغلاق', confirmButtonColor: '#1E4D2B',
  });
}

async function openSchedule(s) {
  if (!s) return;
  const res = await window.Swal.fire({
    title: 'تحديد موعد الاختبار',
    html: `<div class="flex flex-col gap-3 text-right">
      <div class="text-sm text-slate-500">الطالب: <b>${escapeHtml(s.name)}</b></div>
      <label class="flex flex-col gap-1.5 text-sm font-bold">تاريخ الاختبار
        <input type="date" id="sc_date" dir="ltr" value="${escapeHtml((s.schedule && s.schedule.date) || '')}"
          style="width:100%;border:1.5px solid rgba(30,77,43,0.18);border-radius:1rem;padding:.8rem 1rem;text-align:center;font-weight:700;font-size:1.05rem;color:#1E4D2B;background:rgba(255,255,255,0.9);box-shadow:inset 0 1px 2px rgba(20,51,29,0.04);cursor:pointer;">
      </label>
    </div>`,
    showCancelButton: true, confirmButtonText: 'حفظ الموعد', cancelButtonText: 'إلغاء', confirmButtonColor: '#1E4D2B',
    preConfirm: () => {
      const date = document.getElementById('sc_date').value;
      if (!date) { window.Swal.showValidationMessage('التاريخ مطلوب'); return false; }
      return { date, time: '' };
    },
  });
  if (!res.isConfirmed) return;
  toast.showLoading('جاري حفظ الموعد...');
  try {
    await scheduleExam(s.id, res.value.date, res.value.time);
    toast.close(); toast.toast('تم حفظ الموعد', 'success'); await refresh();
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

function startFinal(s) {
  if (!s) return;
  openExamModal(s, {
    mode: 'final', levels,
    onApprove: async (result) => {
      toast.showLoading('جاري اعتماد النتيجة...');
      try {
        const res = await approveFinalExam(s.id, result);
        toast.close();
        if (res.success) {
          if (res.passed) toast.success('تم الاعتماد', 'الطالب ناجح — الشهادة جاهزة.');
          else toast.info('تم الاعتماد', 'الطالب لم يجتز الاختبار.');
          await refresh();
        } else toast.error('خطأ', res.message);
      } catch (err) { toast.close(); toast.error('خطأ', err.message); }
    },
  });
}

async function printCert(s) {
  if (!s) return;
  toast.showLoading('جاري تجهيز الشهادة...');
  try {
    await downloadCertificate({ name: s.name, nationalId: s.nationalId, score: s.final && s.final.score, level: s.examLevel, school: s.schoolName, parts: s.parts });
    toast.close();
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

function loading() { return '<div class="text-center py-12 text-slate-400"><span class="material-symbols-outlined animate-spin text-3xl">progress_activity</span></div>'; }
