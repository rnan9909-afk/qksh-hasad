/**
 * admin.view.js — لوحة الإدارة
 * إضافة/تعديل/حذف الطلاب، إرسال طلب الاختبار، متابعة الحالة والموعد
 * والنتيجة، طباعة الشهادات، إعادة فتح الاختبار الداخلي.
 * (الإدارة لا تُدخل أي درجة إطلاقاً.)
 */

import { getAllStudents, getStudentsBySchool, createStudent, updateStudent, deleteStudent } from '../services/students.service.js';
import { getExamLevels } from '../services/levels.service.js';
import { getSchools } from '../services/schools.service.js';
import { getUsersByRole, getUser, createUser } from '../services/users.service.js';
import { getVariableOptions } from '../services/settings.service.js';
import { sendExamRequest, reopenExam } from '../services/exams.service.js';
import { searchHistoryByNationalId } from '../services/results-history.service.js';
import { openHistorySearch } from '../components/history-search.js';
import { downloadCertificate } from '../certificates/certificate.service.js';
import { statusBadge, certCell, nominationBadge, scheduleLine } from '../components/ui-blocks.js';
import { statGrid } from '../components/ui-blocks.js';
import { statusOrder } from '../core/workflow.js';
import { escapeHtml, matchesAllTerms, hasValue, toLatinDigits, partsCount } from '../core/helpers.js';
import { setSession } from '../core/session.js';
import { ROLES } from '../config.js';
import * as toast from '../core/toast.js';

let root, session, students = [], levels = [], schools = [], teachers = [], options = { stages: [], times: [] };

export async function mount(el, sess) {
  root = el; session = sess;
  root.innerHTML = loading();
  // تحديث مدرسة الإدارة من قاعدة البيانات (تفادي الجلسة القديمة إن تغيّرت المدرسة بعد الدخول)
  try {
    const fresh = await getUser(session.nationalId);
    if (fresh) session = setSession({ ...session, schoolId: fresh.schoolId || '', schools: Array.isArray(fresh.schools) ? fresh.schools : (session.schools || []) });
  } catch { /* نكتفي ببيانات الجلسة */ }
  [levels, schools, teachers, options] = await Promise.all([
    getExamLevels(), getSchools(), getUsersByRole(ROLES.TEACHER), getVariableOptions(),
  ]);
  await refresh();
}

async function refresh() {
  students = session.schoolId ? await getStudentsBySchool(session.schoolId) : await getAllStudents();
  render();
}

function stats() {
  const total = students.length;
  const sent = students.filter((s) => statusOrder(s.status) >= statusOrder('awaiting_schedule')).length;
  const waiting = students.filter((s) => s.status === 'awaiting_schedule').length;
  const certs = students.filter((s) => s.status === 'certificate_ready').length;
  return statGrid([
    { label: 'عدد الطلاب', value: total, icon: 'groups', color: 'emerald' },
    { label: 'طلبات مُرسلة', value: sent, icon: 'send', color: 'amber' },
    { label: 'طلبات منتظرة', value: waiting, icon: 'hourglass_top', color: 'amber' },
    { label: 'شهادات صادرة', value: certs, icon: 'workspace_premium', color: 'green' },
  ]);
}

function render() {
  root.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div class="flex items-center gap-3">
        <div class="size-9 rounded bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined">admin_panel_settings</span></div>
        <h1 class="text-xl font-bold">لوحة الإدارة</h1>
      </div>
      <button id="a_add" class="btn-primary px-4 py-2.5 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[20px]">person_add</span> إضافة طالب</button>
    </div>
    ${stats()}
    <section class="section-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf3] px-6 py-4">
        <h2 class="text-lg font-bold">الطلاب</h2>
        <input id="a_search" class="rounded-lg border border-[#e7edf3] px-4 py-2 text-sm min-w-[220px]" placeholder="بحث بالاسم..." />
      </div>
      <div class="overflow-x-auto">
        <table class="data-table" style="min-width:1040px;">
          <thead><tr><th>م</th><th>الطالب/ة</th><th>المعلم/ة</th><th>المستوى</th><th>الأجزاء</th><th>الداخلي</th><th>الحالة</th><th>الدرجة</th><th>الشهادة</th><th>إجراءات</th></tr></thead>
          <tbody id="a_body"></tbody>
        </table>
      </div>
    </section>`;
  root.querySelector('#a_add').addEventListener('click', () => openForm());
  root.querySelector('#a_search').addEventListener('input', renderRows);
  root.querySelector('#a_body').addEventListener('click', onRowClick);
  renderRows();
}

function renderRows() {
  const q = root.querySelector('#a_search').value;
  let list = q ? students.filter((s) => matchesAllTerms(s.name, q)) : students.slice();
  list.sort((a, b) => statusOrder(a.status) - statusOrder(b.status));
  const tb = root.querySelector('#a_body');
  if (!list.length) { tb.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-slate-400">لا يوجد طلاب</td></tr>'; return; }

  tb.innerHTML = list.map((s, i) => {
    const internalScore = s.internal && hasValue(s.internal.score) ? s.internal.score : '-';
    const finalScore = s.final && hasValue(s.final.score) ? s.final.score : '-';
    const actions = [];
    actions.push(`<button data-edit="${escapeHtml(s.id)}" class="text-emerald-600 bg-emerald-50 p-1.5 rounded" title="تعديل"><span class="material-symbols-outlined text-[18px]">edit</span></button>`);
    actions.push(`<button data-del="${escapeHtml(s.id)}" class="text-red-500 bg-red-50 p-1.5 rounded" title="حذف"><span class="material-symbols-outlined text-[18px]">delete</span></button>`);
    if (s.status === 'internal_approved') {
      actions.push(`<button data-send="${escapeHtml(s.id)}" class="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">send</span> إرسال طلب</button>`);
      actions.push(`<button data-reopen="${escapeHtml(s.id)}" class="text-amber-600 bg-amber-50 p-1.5 rounded" title="إعادة فتح الداخلي"><span class="material-symbols-outlined text-[18px]">lock_reset</span></button>`);
    }
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
      <td><div class="flex items-center justify-center gap-1.5 flex-wrap">${actions.join('')}</div></td>
    </tr>`;
  }).join('');
}

function onRowClick(e) {
  const t = (a) => e.target.closest(`[data-${a}]`);
  if (t('edit')) return openForm(students.find((s) => String(s.id) === t('edit').dataset.edit));
  if (t('del')) return confirmDelete(t('del').dataset.del);
  if (t('send')) return doSend(t('send').dataset.send);
  if (t('reopen')) return doReopen(t('reopen').dataset.reopen);
  if (t('cert')) return printCert(t('cert').dataset.cert);
}

/* -------------------------- نموذج الطالب -------------------------- */

async function openForm(existing = null) {
  const isEdit = !!existing;
  const g = (k) => (existing && existing[k] != null ? escapeHtml(existing[k]) : '');

  // المدرسة: تلقائية حسب مدرسة الإدارة، وإلا قائمة اختيار (مشرف عام / مدرسة غير محددة أو محذوفة)
  const fixedSchoolId = isEdit ? existing.schoolId : session.schoolId;
  const fixedSchool = schools.find((s) => s.id === fixedSchoolId);
  const useDropdown = !fixedSchool;
  const schoolOpts = ['<option value="">اختر المدرسة..</option>', ...schools.map((s) => `<option value="${escapeHtml(s.id)}" ${fixedSchoolId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)].join('');

  const lvlLabel = (l) => `${/^\d+$/.test(String(l.level)) ? 'المستوى ' + l.level : l.level}${l.note ? ' — ' + l.note : ''}`;
  const levelOpts = ['<option value="">اختر المستوى..</option>', ...levels.map((l) => `<option value="${escapeHtml(l.level)}" ${existing && existing.examLevel === l.level ? 'selected' : ''}>${escapeHtml(lvlLabel(l))}</option>`)].join('');
  const timeOpts = ['<option value="">اختر..</option>', ...options.times.map((t) => `<option ${existing && existing.classTime === t ? 'selected' : ''}>${escapeHtml(t)}</option>`)].join('');
  const stageOpts = ['<option value="">اختر..</option>', ...options.stages.map((t) => `<option ${existing && existing.eduStage === t ? 'selected' : ''}>${escapeHtml(t)}</option>`)].join('');

  // قوائم الاستدعاء التلقائي: طلاب مسجّلون (بدون تكرار الهوية) + معلمون
  const uniqStudents = [];
  const seenNid = new Set();
  for (const s of students) { if (s.nationalId && !seenNid.has(s.nationalId)) { seenNid.add(s.nationalId); uniqStudents.push(s); } }
  const studentsDL = uniqStudents.map((s) => `<option value="${escapeHtml(s.name)}"></option>`).join('');
  const teachersDL = teachers.map((t) => `<option value="${escapeHtml(t.name)}"></option>`).join('');

  const sec = (icon, title) => `<div class="sm:col-span-3 flex items-center gap-2 mt-1 mb-0.5 pb-1 border-b border-primary/15">
    <span class="material-symbols-outlined text-primary text-[20px]">${icon}</span><h3 class="font-bold text-primary text-[15px]">${title}</h3></div>`;

  const res = await window.Swal.fire({
    title: isEdit ? 'تعديل بيانات طالب' : 'إضافة طالب',
    width: 820,
    html: `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
      ${sec('domain', 'بيانات الطالب/ة والمجمع')}
      <label class="flex flex-col gap-1 text-sm font-bold">المجمع / المدرسة
        ${useDropdown
          ? `<select id="f_school" class="field-select">${schoolOpts}</select>`
          : `<input class="field-input bg-slate-50 text-primary font-bold" value="${escapeHtml(fixedSchool ? fixedSchool.name : '')}" readonly>`}
      </label>
      <label class="flex flex-col gap-1 text-sm font-bold">اسم الطالب/ة (الرباعي) *
        <div class="flex gap-1.5">
          <input id="f_name" list="f_studentsDL" autocomplete="off" class="field-input flex-1" value="${g('name')}" placeholder="اكتب للاختيار من المسجّلين">
          <button type="button" id="f_histbtn" class="btn-primary px-2.5 shrink-0 flex items-center" title="التحقق من الاختبارات السابقة"><span class="material-symbols-outlined text-[18px]">manage_search</span></button>
        </div>
      </label>
      <label class="flex flex-col gap-1 text-sm font-bold">السجل المدني *<input id="f_nid" class="field-input" maxlength="10" value="${g('nationalId')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">رقم الجوال<input id="f_mobile" class="field-input" maxlength="10" value="${g('mobile')}" placeholder="05xxxxxxxx"></label>
      <div id="f_hist" class="sm:col-span-3 text-xs"></div>
      <label class="flex flex-col gap-1 text-sm font-bold">فئة الحلقة<select id="f_time" class="field-select">${timeOpts}</select></label>
      <label class="flex flex-col gap-1 text-sm font-bold">المرحلة التعليمية<select id="f_stage" class="field-select">${stageOpts}</select></label>

      ${sec('person', 'بيانات المعلم/ة والحلقة')}
      <label class="flex flex-col gap-1 text-sm font-bold">اسم المعلم/ة
        <div class="relative">
          <input id="f_tname" list="f_teachersDL" autocomplete="off" class="field-input w-full" value="${g('teacherName')}" placeholder="اكتب للاختيار من المسجّلين">
          <span class="material-symbols-outlined text-slate-300 text-[18px] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
        </div>
      </label>
      <label class="flex flex-col gap-1 text-sm font-bold">السجل المدني للمعلم/ة<input id="f_tnid" class="field-input" maxlength="10" value="${g('teacherId')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">اسم الحلقة<input id="f_class" class="field-input" value="${g('className')}"></label>

      ${sec('fact_check', 'تفاصيل الاختبار')}
      <label class="flex flex-col gap-1 text-sm font-bold">مستوى الاختبار *<select id="f_level" class="field-select">${levelOpts}</select></label>
      <div class="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
        <span>الأجزاء</span>
        <input id="f_partscount" class="field-input bg-slate-50" readonly>
        <span id="f_partshint" class="text-[11px] text-red-600 font-normal"></span>
      </div>
    </div>
    <datalist id="f_studentsDL">${studentsDL}</datalist>
    <datalist id="f_teachersDL">${teachersDL}</datalist>`,
    showCancelButton: true, confirmButtonText: isEdit ? 'حفظ' : 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#1E4D2B',
    didOpen: () => {
      const $ = (id) => document.getElementById(id);
      const nameEl = $('f_name'), nidEl = $('f_nid'), mobileEl = $('f_mobile');
      const stageEl = $('f_stage'), timeEl = $('f_time'), classEl = $('f_class');
      const tNameEl = $('f_tname'), tNidEl = $('f_tnid');
      const lvlEl = $('f_level'), pcEl = $('f_partscount'), phEl = $('f_partshint');

      // استدعاء بيانات طالب مسجّل
      const fillFromStudent = (s) => {
        nidEl.value = s.nationalId || '';
        mobileEl.value = s.mobile || '';
        if (s.eduStage) stageEl.value = s.eduStage;
        if (s.classTime) timeEl.value = s.classTime;
        classEl.value = s.className || '';
        tNameEl.value = s.teacherName || '';
        tNidEl.value = s.teacherId || '';
      };
      nameEl.addEventListener('change', () => {
        const s = uniqStudents.find((x) => x.name === nameEl.value.trim());
        if (s) fillFromStudent(s);
      });
      nidEl.addEventListener('change', () => {
        const s = uniqStudents.find((x) => x.nationalId === toLatinDigits(nidEl.value.trim()));
        if (s) { nameEl.value = s.name; fillFromStudent(s); }
        checkHistory(nidEl.value.trim());
      });

      // التحقق من اختبار الطالب سابقاً (سجل النتائج المرتبط بمدرسة الإدارة)
      const histEl = $('f_hist');
      const mySchools = Array.isArray(session.schools) && session.schools.length
        ? session.schools : (session.schoolId ? [session.schoolId] : []);
      const checkHistory = async (nid) => {
        histEl.innerHTML = '';
        if (!/^\d{10}$/.test(toLatinDigits(nid))) return;
        try {
          const recs = await searchHistoryByNationalId(nid, mySchools.length ? mySchools : null);
          if (!recs.length) return;
          const items = recs.map((r) => `<span class="inline-block bg-white border border-amber-200 rounded px-2 py-0.5 mx-0.5">${escapeHtml(r.term || '')}: ${escapeHtml(r.parts || '')} — ${escapeHtml(String(r.score || ''))}</span>`).join(' ');
          histEl.innerHTML = `<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5">
            <b><span class="material-symbols-outlined text-[16px]" style="vertical-align:middle;">history</span> سبق اختبار هذا الطالب (${recs.length}):</b> ${items}</div>`;
        } catch { /* تجاهل */ }
      };
      if (isEdit && existing.nationalId) checkHistory(existing.nationalId);

      // زر التحقق من الاختبارات السابقة (بحث بالاسم أو الهوية)
      $('f_histbtn').addEventListener('click', () => {
        const nm = nameEl.value.trim();
        const nid = toLatinDigits(nidEl.value.trim());
        openHistorySearch({
          title: 'التحقق من الاختبارات السابقة',
          term: nid && /^\d{6,}$/.test(nid) ? nid : nm,
          mode: nid && /^\d{6,}$/.test(nid) && !nm ? 'nid' : 'name',
          schools: mySchools.length ? mySchools : null,
        });
      });

      // استدعاء بيانات معلم مسجّل
      tNameEl.addEventListener('change', () => {
        const t = teachers.find((x) => x.name === tNameEl.value.trim());
        if (t) tNidEl.value = t.id;
      });
      tNidEl.addEventListener('change', () => {
        const t = teachers.find((x) => x.id === toLatinDigits(tNidEl.value.trim()));
        if (t) tNameEl.value = t.name;
      });

      // مزامنة أجزاء الاختبار حسب المستوى
      const syncLevel = () => {
        const f = levels.find((l) => l.level === lvlEl.value);
        pcEl.value = f ? (f.ajza || '') : '';
        phEl.textContent = f && f.parts ? ('بيان أجزاء الاختبار: ' + f.parts) : '';
      };
      lvlEl.addEventListener('change', syncLevel);
      syncLevel();
    },
    preConfirm: () => {
      const $ = (id) => document.getElementById(id);
      const data = {
        name: $('f_name').value.trim(),
        nationalId: $('f_nid').value.trim(),
        mobile: $('f_mobile').value.trim(),
        classTime: $('f_time').value,
        eduStage: $('f_stage').value,
        teacherName: $('f_tname').value.trim(),
        teacherNid: $('f_tnid').value.trim(),
        className: $('f_class').value.trim(),
        examLevel: $('f_level').value,
        schoolId: useDropdown ? $('f_school').value : fixedSchoolId,
      };
      if (!data.name || !data.nationalId || !data.examLevel) { window.Swal.showValidationMessage('اسم الطالب والسجل المدني ومستوى الاختبار مطلوبة'); return false; }
      if (data.teacherName && !/^\d{10}$/.test(toLatinDigits(data.teacherNid))) { window.Swal.showValidationMessage('السجل المدني للمعلم يجب أن يكون 10 أرقام'); return false; }
      return data;
    },
  });
  if (!res.isConfirmed) return;
  const v = res.value;

  toast.showLoading('جاري الحفظ...');
  try {
    // المدرسة
    const schoolIdToUse = v.schoolId || '';
    const sc = schools.find((s) => s.id === schoolIdToUse);
    const schoolNameToUse = sc ? sc.name : (isEdit ? existing.schoolName : '');

    // المعلم: استخدم حسابه إن وُجد، وإلا أنشئ حساب معلم تلقائياً (ليتمكن من الدخول والتقييم)
    let teacherId = '', teacherName = '';
    if (v.teacherName) {
      const tnid = toLatinDigits(v.teacherNid);
      let t = teachers.find((x) => x.id === tnid) || await getUser(tnid);
      if (!t) {
        await createUser({ id: tnid, name: v.teacherName, role: ROLES.TEACHER, schoolId: schoolIdToUse });
        teachers = await getUsersByRole(ROLES.TEACHER);
        t = teachers.find((x) => x.id === tnid);
      }
      teacherId = tnid;
      teacherName = (t && t.name) || v.teacherName;
    }

    const lvl = levels.find((l) => l.level === v.examLevel);
    const payload = {
      name: v.name, nationalId: v.nationalId, mobile: v.mobile,
      schoolId: schoolIdToUse, schoolName: schoolNameToUse,
      className: v.className, classTime: v.classTime, eduStage: v.eduStage,
      teacherId, teacherName,
      // الأجزاء = عدد الأجزاء (هي الأساس في الجداول والشهادة)، لا أرقام الأجزاء
      examLevel: v.examLevel, parts: lvl ? String(lvl.ajza) : '',
    };

    if (isEdit) await updateStudent(existing.id, payload);
    else await createStudent(payload);
    toast.close();
    toast.toast('تم الحفظ', 'success');
    await refresh();
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

async function confirmDelete(id) {
  const ok = await toast.confirm('حذف الطالب؟', 'لا يمكن التراجع.', { confirmText: 'نعم، حذف', danger: true });
  if (!ok) return;
  toast.showLoading('جاري الحذف...');
  try { await deleteStudent(id); toast.close(); toast.toast('تم الحذف', 'success'); await refresh(); }
  catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

async function doSend(id) {
  const ok = await toast.confirm('إرسال طلب اختبار؟', 'سينتقل الطالب إلى قائمة انتظار مشرف الاختبارات.', { icon: 'question', confirmText: 'إرسال' });
  if (!ok) return;
  toast.showLoading('جاري الإرسال...');
  try {
    const res = await sendExamRequest(id);
    toast.close();
    if (res.success) { toast.success('تم الإرسال', 'انتقل الطلب لمشرف الاختبارات.'); await refresh(); }
    else toast.error('تعذّر', res.message);
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

async function doReopen(id) {
  const ok = await toast.confirm('إعادة فتح الاختبار الداخلي؟', 'سيتمكن المعلم من إعادة التقييم.', { icon: 'warning', confirmText: 'إعادة الفتح' });
  if (!ok) return;
  toast.showLoading('...');
  try { await reopenExam(id, 'internal'); toast.close(); toast.toast('تمت إعادة الفتح', 'success'); await refresh(); }
  catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

async function printCert(id) {
  const s = students.find((x) => String(x.id) === id);
  if (!s) return;
  toast.showLoading('جاري تجهيز الشهادة...');
  try {
    await downloadCertificate({ name: s.name, nationalId: s.nationalId, score: s.final && s.final.score, level: s.examLevel, school: s.schoolName, parts: s.parts });
    toast.close();
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

function loading() { return '<div class="text-center py-12 text-slate-400"><span class="material-symbols-outlined animate-spin text-3xl">progress_activity</span></div>'; }
