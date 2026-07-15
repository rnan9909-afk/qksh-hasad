/**
 * superadmin.view.js — لوحة المشرف العام (تبويبات)
 * نظرة عامة · المستخدمون · المدارس · المستويات · الإعدادات ·
 * قالب الشهادة · سجل الأحداث · الاختبارات (إعادة الفتح).
 */

import { CONFIG, ROLES, ROLE_LABELS } from '../config.js';
import { getAllUsers, createUser, updateUser, deleteUser, toggleUser } from '../services/users.service.js';
import { getAllStudents } from '../services/students.service.js';
import { getSchools, createSchool, updateSchool, deleteSchool } from '../services/schools.service.js';
import { getExamLevels, createLevel, updateLevel, deleteLevel } from '../services/levels.service.js';
import { getVariableOptions, addVariableOption, updateVariableOption, removeVariableOption } from '../services/settings.service.js';
import { getAuditLog } from '../services/audit.service.js';
import { getBatches, addBatch, deleteBatch, parseResultsPaste, getBatchRecords } from '../services/results-history.service.js';
import { getRewards, updateRewardAmount, computeReward } from '../services/rewards.service.js';
import { reopenExam } from '../services/exams.service.js';
import { mountCertificateEditor } from '../components/certificate-editor.js';
import { openReport } from '../components/report.js';
import { statGrid, statusBadge } from '../components/ui-blocks.js';
import { escapeHtml, partsCount } from '../core/helpers.js';
import * as toast from '../core/toast.js';

let root, session;
let cache = { users: [], students: [], schools: [], levels: [] };

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: 'dashboard' },
  { id: 'users', label: 'المستخدمون', icon: 'group' },
  { id: 'schools', label: 'المدارس', icon: 'domain' },
  { id: 'levels', label: 'المستويات', icon: 'menu_book' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
  { id: 'certificate', label: 'قالب الشهادة', icon: 'workspace_premium' },
  { id: 'history', label: 'سجل النتائج', icon: 'database' },
  { id: 'rewards', label: 'جوائز الطلاب', icon: 'payments' },
  { id: 'exams', label: 'الاختبارات', icon: 'fact_check' },
  { id: 'audit', label: 'سجل الأحداث', icon: 'history' },
];

export async function mount(el, sess) {
  root = el; session = sess;
  root.innerHTML = `
    <div class="flex items-center gap-3 mb-6">
      <div class="size-9 rounded bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined">shield_person</span></div>
      <h1 class="text-xl font-bold">لوحة المشرف العام</h1>
    </div>
    <div class="flex gap-2 flex-wrap mb-6 border-b border-slate-200 pb-2" id="sa_tabs">
      ${TABS.map((t, i) => `<button data-tab="${t.id}" class="sa-tab px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 ${i === 0 ? 'sa-tab-active' : 'text-slate-600 hover:bg-slate-100'}"><span class="material-symbols-outlined text-[18px]">${t.icon}</span> ${t.label}</button>`).join('')}
    </div>
    <div id="sa_content"></div>`;
  root.querySelector('#sa_tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    root.querySelectorAll('.sa-tab').forEach((x) => { x.classList.remove('sa-tab-active'); x.classList.add('text-slate-600', 'hover:bg-slate-100'); });
    b.classList.add('sa-tab-active'); b.classList.remove('text-slate-600', 'hover:bg-slate-100');
    renderTab(b.dataset.tab);
  });
  renderTab('overview');
}

const content = () => root.querySelector('#sa_content');
const loading = () => (content().innerHTML = '<div class="text-center py-12 text-slate-400"><span class="material-symbols-outlined animate-spin text-3xl">progress_activity</span></div>');

async function renderTab(tab) {
  loading();
  if (tab === 'overview') return renderOverview();
  if (tab === 'users') return renderUsers();
  if (tab === 'schools') return renderSchools();
  if (tab === 'levels') return renderLevels();
  if (tab === 'settings') return renderSettings();
  if (tab === 'certificate') return mountCertificateEditor(content());
  if (tab === 'history') return renderHistory();
  if (tab === 'rewards') return renderRewards();
  if (tab === 'exams') return renderExams();
  if (tab === 'audit') return renderAudit();
}

/* --------------------------- نظرة عامة --------------------------- */
async function renderOverview() {
  const [users, students, schools] = await Promise.all([getAllUsers(), getAllStudents(), getSchools()]);
  cache.users = users; cache.students = students; cache.schools = schools;
  const by = (r) => users.filter((u) => u.role === r).length;
  content().innerHTML = statGrid([
    { label: 'إجمالي الطلاب', value: students.length, icon: 'groups', color: 'emerald' },
    { label: 'المدارس', value: schools.length, icon: 'domain', color: 'lime' },
    { label: 'المستخدمون', value: users.length, icon: 'group', color: 'amber' },
    { label: 'المعلمون', value: by(ROLES.TEACHER), icon: 'school', color: 'emerald' },
    { label: 'الإداريون', value: by(ROLES.ADMIN), icon: 'admin_panel_settings', color: 'amber' },
    { label: 'مشرفو الاختبارات', value: by(ROLES.EXAM_SUPERVISOR), icon: 'rule', color: 'orange' },
    { label: 'الشهادات', value: students.filter((s) => s.status === 'certificate_ready').length, icon: 'workspace_premium', color: 'green' },
    { label: 'الاختبارات المعتمدة', value: students.filter((s) => ['result_approved', 'certificate_ready', 'failed'].includes(s.status)).length, icon: 'fact_check', color: 'red' },
  ], 4);
}

/* --------------------------- المستخدمون --------------------------- */
async function renderUsers() {
  cache.users = await getAllUsers();
  cache.schools = await getSchools();
  content().innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-bold">المستخدمون</h2>
      <button id="u_add" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">person_add</span> إضافة مستخدم</button>
    </div>
    <div class="section-card overflow-x-auto"><table class="data-table" style="min-width:760px;">
      <thead><tr><th>الاسم</th><th>رقم الهوية</th><th>الدور</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
      <tbody id="u_body"></tbody></table></div>`;
  content().querySelector('#u_add').addEventListener('click', () => userForm());
  content().querySelector('#u_body').addEventListener('click', onUserClick);
  drawUsers();
}

function drawUsers() {
  const tb = content().querySelector('#u_body');
  const list = cache.users.filter((u) => u.role !== ROLES.SUPER_ADMIN).concat(cache.users.filter((u) => u.role === ROLES.SUPER_ADMIN));
  tb.innerHTML = cache.users.length ? list.map((u) => `<tr>
    <td class="font-bold text-secondary">${escapeHtml(u.name)}</td>
    <td class="font-mono text-xs">${escapeHtml(u.id)}</td>
    <td><span class="bg-slate-100 px-2 py-1 rounded text-xs">${ROLE_LABELS[u.role] || u.role}</span></td>
    <td>${u.active === false ? '<span class="badge-status badge-red">موقوف</span>' : '<span class="badge-status badge-green">مفعّل</span>'}</td>
    <td><div class="flex items-center justify-center gap-1.5">
      ${u.id === CONFIG.SUPER_ADMIN_ID ? '<span class="text-xs text-slate-400">أساسي</span>' : `
      <button data-uedit="${escapeHtml(u.id)}" class="text-emerald-600 bg-emerald-50 p-1.5 rounded" title="تعديل"><span class="material-symbols-outlined text-[18px]">edit</span></button>
      <button data-utoggle="${escapeHtml(u.id)}" class="text-amber-600 bg-amber-50 p-1.5 rounded" title="إيقاف/تفعيل"><span class="material-symbols-outlined text-[18px]">${u.active === false ? 'toggle_off' : 'toggle_on'}</span></button>
      <button data-udel="${escapeHtml(u.id)}" class="text-red-500 bg-red-50 p-1.5 rounded" title="حذف"><span class="material-symbols-outlined text-[18px]">delete</span></button>`}
    </div></td>
  </tr>`).join('') : '<tr><td colspan="5" class="text-center py-8 text-slate-400">لا يوجد مستخدمون</td></tr>';
}

function onUserClick(e) {
  const ed = e.target.closest('[data-uedit]'); if (ed) return userForm(cache.users.find((u) => u.id === ed.dataset.uedit));
  const tg = e.target.closest('[data-utoggle]'); if (tg) return doToggle(cache.users.find((u) => u.id === tg.dataset.utoggle));
  const dl = e.target.closest('[data-udel]'); if (dl) return doDeleteUser(dl.dataset.udel);
}

async function userForm(existing = null) {
  const isEdit = !!existing;
  const roleList = [ROLES.ADMIN, ROLES.TEACHER, ROLES.EXAM_SUPERVISOR];
  const roleOpts = roleList.map((r) => `<option value="${r}" ${existing && existing.role === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('');
  const schoolOpts = ['<option value="">— بلا مدرسة —</option>', ...cache.schools.map((s) => `<option value="${escapeHtml(s.id)}" ${existing && existing.schoolId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)].join('');
  const existSchools = (existing && Array.isArray(existing.schools)) ? existing.schools : [];
  const schoolChecks = cache.schools.length
    ? cache.schools.map((s) => `
      <label class="school-check flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border cursor-pointer" style="border-color:rgba(30,77,43,0.14);background:rgba(255,255,255,0.6);">
        <span class="text-sm font-bold text-slate-700">${escapeHtml(s.name)}</span>
        <input type="checkbox" class="u-school-cb" value="${escapeHtml(s.id)}" ${existSchools.includes(s.id) ? 'checked' : ''} style="width:1.25rem;height:1.25rem;accent-color:#1E4D2B;cursor:pointer;flex:none;">
      </label>`).join('')
    : '<span class="text-xs text-slate-400 font-normal">لا توجد مدارس — أضف مدرسة أولاً</span>';
  const g = (k) => (existing && existing[k] != null ? escapeHtml(existing[k]) : '');
  const isSup = existing && existing.role === ROLES.EXAM_SUPERVISOR;

  const res = await window.Swal.fire({
    title: isEdit ? 'تعديل مستخدم' : 'إضافة مستخدم',
    html: `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
      <label class="flex flex-col gap-1 text-sm font-bold">الاسم<input id="u_name" class="field-input" value="${g('name')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">رقم الهوية<input id="u_id" class="field-input" maxlength="10" value="${g('id')}" ${isEdit ? 'readonly' : ''}></label>
      <label class="flex flex-col gap-1 text-sm font-bold">الدور<select id="u_role" class="field-select">${roleOpts}</select></label>
      <label id="u_school_wrap" class="flex flex-col gap-1 text-sm font-bold ${isSup ? 'hidden' : ''}">المدرسة<select id="u_school" class="field-select">${schoolOpts}</select></label>
      <label id="u_schools_wrap" class="flex flex-col gap-1 text-sm font-bold sm:col-span-2 ${isSup ? '' : 'hidden'}">المدارس المسؤول عنها
        <span class="text-[11px] text-slate-400 font-normal mb-1">اضغط ✔ بجانب اسم المدرسة لتوكيلها للمشرف</span>
        <div id="u_schools_list" class="flex flex-col gap-2 max-h-52 overflow-auto p-0.5">${schoolChecks}</div>
      </label>
      <label class="flex flex-col gap-1 text-sm font-bold">الجوال<input id="u_phone" class="field-input" maxlength="10" value="${g('phone')}"></label>
    </div>`,
    showCancelButton: true, confirmButtonText: isEdit ? 'حفظ' : 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#1E4D2B',
    didOpen: () => {
      const roleSel = document.getElementById('u_role');
      const toggle = () => {
        const sup = roleSel.value === ROLES.EXAM_SUPERVISOR;
        document.getElementById('u_schools_wrap').classList.toggle('hidden', !sup);
        document.getElementById('u_school_wrap').classList.toggle('hidden', sup);
      };
      roleSel.addEventListener('change', toggle);
      toggle();
    },
    preConfirm: () => {
      const role = document.getElementById('u_role').value;
      const data = {
        id: document.getElementById('u_id').value.trim(),
        name: document.getElementById('u_name').value.trim(),
        role,
        phone: document.getElementById('u_phone').value.trim(),
      };
      if (role === ROLES.EXAM_SUPERVISOR) {
        data.schools = Array.from(document.querySelectorAll('#u_schools_list .u-school-cb:checked')).map((c) => c.value);
        data.schoolId = '';
      } else {
        data.schoolId = document.getElementById('u_school').value;
        data.schools = [];
      }
      if (!data.name || !data.id) { window.Swal.showValidationMessage('الاسم ورقم الهوية مطلوبان'); return false; }
      if (role === ROLES.EXAM_SUPERVISOR && data.schools.length === 0) { window.Swal.showValidationMessage('اختر مدرسة واحدة على الأقل للمشرف'); return false; }
      return data;
    },
  });
  if (!res.isConfirmed) return;
  toast.showLoading('جاري الحفظ...');
  try {
    if (isEdit) await updateUser(existing.id, res.value);
    else await createUser(res.value);
    toast.close(); toast.toast('تم الحفظ', 'success'); renderUsers();
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

async function doToggle(u) {
  if (!u) return;
  toast.showLoading('...');
  try { await toggleUser(u.id, u.active === false); toast.close(); renderUsers(); }
  catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

async function doDeleteUser(id) {
  const ok = await toast.confirm('حذف المستخدم؟', 'لا يمكن التراجع.', { confirmText: 'نعم، حذف', danger: true });
  if (!ok) return;
  toast.showLoading('...');
  try { await deleteUser(id); toast.close(); toast.toast('تم الحذف', 'success'); renderUsers(); }
  catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

/* --------------------------- المدارس --------------------------- */
async function renderSchools() {
  cache.schools = await getSchools();
  content().innerHTML = `
    <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold">المدارس</h2>
      <button id="sc_add" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">add</span> إضافة مدرسة</button></div>
    <div class="section-card overflow-x-auto"><table class="data-table" style="min-width:500px;">
      <thead><tr><th>الاسم</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody id="sc_body"></tbody></table></div>`;
  content().querySelector('#sc_add').addEventListener('click', async () => {
    const name = await toast.prompt('اسم المدرسة/المجمع', { label: 'أدخل الاسم' });
    if (!name) return;
    toast.showLoading('...');
    try { await createSchool(name); toast.close(); renderSchools(); } catch (e) { toast.close(); toast.error('خطأ', e.message); }
  });
  content().querySelector('#sc_body').addEventListener('click', onSchoolClick);
  const tb = content().querySelector('#sc_body');
  tb.innerHTML = cache.schools.length ? cache.schools.map((s) => `<tr>
    <td class="font-bold text-secondary">${escapeHtml(s.name)}</td>
    <td>${s.active === false ? '<span class="badge-status badge-red">موقوفة</span>' : '<span class="badge-status badge-green">نشطة</span>'}</td>
    <td><div class="flex justify-center gap-1.5">
      <button data-sedit="${escapeHtml(s.id)}" class="text-emerald-600 bg-emerald-50 p-1.5 rounded"><span class="material-symbols-outlined text-[18px]">edit</span></button>
      <button data-sdel="${escapeHtml(s.id)}" class="text-red-500 bg-red-50 p-1.5 rounded"><span class="material-symbols-outlined text-[18px]">delete</span></button>
    </div></td></tr>`).join('') : '<tr><td colspan="3" class="text-center py-8 text-slate-400">لا توجد مدارس</td></tr>';
}

async function onSchoolClick(e) {
  const ed = e.target.closest('[data-sedit]');
  if (ed) {
    const s = cache.schools.find((x) => x.id === ed.dataset.sedit);
    const name = await toast.prompt('تعديل اسم المدرسة', { label: 'الاسم' });
    if (!name) return;
    toast.showLoading('...'); try { await updateSchool(s.id, { name }); toast.close(); renderSchools(); } catch (er) { toast.close(); toast.error('خطأ', er.message); }
    return;
  }
  const dl = e.target.closest('[data-sdel]');
  if (dl) {
    const ok = await toast.confirm('حذف المدرسة؟', '', { confirmText: 'حذف', danger: true });
    if (!ok) return;
    toast.showLoading('...'); try { await deleteSchool(dl.dataset.sdel); toast.close(); renderSchools(); } catch (er) { toast.close(); toast.error('خطأ', er.message); }
  }
}

/* --------------------------- المستويات --------------------------- */
async function renderLevels() {
  cache.levels = await getExamLevels();
  const dash = (v) => (v === '' || v === 0 || v == null ? '<span class="text-slate-300">-</span>' : escapeHtml(String(v)));
  content().innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <div>
        <h2 class="text-lg font-bold">لائحة الاختبارات المعتمدة</h2>
        <p class="text-xs text-slate-500 mt-0.5">المستويات وتوزيع أجزاء الاختبار وعدد الأسئلة.</p>
      </div>
      <button id="lv_add" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">add</span> إضافة مستوى</button></div>
    <div class="section-card overflow-x-auto"><table class="data-table text-center" style="min-width:1000px;">
      <thead><tr>
        <th>المستوى</th><th>الأجزاء</th><th>بيان بأرقام أجزاء الاختبار</th>
        <th>عدد أجزاء الاختبار الفعلية</th><th>عدد الأسئلة</th>
        <th>3 أسئلة في</th><th>سؤالين في</th><th>سؤال في</th><th>سؤال في كل جزئين</th>
        <th>الإجراءات</th>
      </tr></thead><tbody id="lv_body"></tbody></table></div>`;
  content().querySelector('#lv_add').addEventListener('click', () => levelForm());
  content().querySelector('#lv_body').addEventListener('click', onLevelClick);
  const tb = content().querySelector('#lv_body');
  tb.innerHTML = cache.levels.length ? cache.levels.map((l) => `<tr>
    <td class="font-bold text-secondary">${escapeHtml(l.level)}${l.note ? `<div class="text-[11px] text-emerald-600 font-normal mt-0.5">${escapeHtml(l.note)}</div>` : ''}</td>
    <td class="font-bold">${dash(l.ajza)}</td>
    <td class="text-xs">${dash(l.parts)}</td>
    <td>${dash(l.examPartsCount)}</td>
    <td class="font-bold text-emerald-600">${dash(l.questionCount)}</td>
    <td class="text-xs">${dash(l.q3)}</td>
    <td class="text-xs">${dash(l.q2)}</td>
    <td class="text-xs">${dash(l.q1)}</td>
    <td class="text-xs">${dash(l.qHalf)}</td>
    <td><div class="flex justify-center gap-1.5">
      <button data-ledit="${escapeHtml(l.id)}" class="text-emerald-600 bg-emerald-50 p-1.5 rounded"><span class="material-symbols-outlined text-[18px]">edit</span></button>
      <button data-ldel="${escapeHtml(l.id)}" class="text-red-500 bg-red-50 p-1.5 rounded"><span class="material-symbols-outlined text-[18px]">delete</span></button>
    </div></td></tr>`).join('') : '<tr><td colspan="10" class="text-center py-8 text-slate-400">لا توجد مستويات</td></tr>';
}

function onLevelClick(e) {
  const ed = e.target.closest('[data-ledit]'); if (ed) return levelForm(cache.levels.find((l) => l.id === ed.dataset.ledit));
  const dl = e.target.closest('[data-ldel]'); if (dl) return doDeleteLevel(dl.dataset.ldel);
}

async function levelForm(existing = null) {
  const isEdit = !!existing;
  const g = (k) => (existing && existing[k] != null ? escapeHtml(existing[k]) : '');
  const n = (k, d) => (existing && existing[k] != null && existing[k] !== '' ? existing[k] : d);
  const res = await window.Swal.fire({
    title: isEdit ? 'تعديل مستوى' : 'إضافة مستوى',
    width: 640,
    html: `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
      <label class="flex flex-col gap-1 text-sm font-bold">المستوى<input id="l_level" class="field-input" value="${g('level')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">الاسم/الملاحظة<input id="l_note" class="field-input" value="${g('note')}" placeholder="مثال: ختمة المفصّل"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">الأجزاء<input id="l_ajza" type="number" class="field-input" value="${n('ajza', '')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">عدد أجزاء الاختبار الفعلية<input id="l_epc" type="number" class="field-input" value="${n('examPartsCount', '')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold sm:col-span-2">بيان بأرقام أجزاء الاختبار<input id="l_parts" class="field-input" value="${g('parts')}" placeholder="مثال: 26، 27، 28، 29، 30"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">عدد الأسئلة<input id="l_qc" type="number" class="field-input" value="${n('questionCount', 5)}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">3 أسئلة في<input id="l_q3" class="field-input" value="${g('q3')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">سؤالين في<input id="l_q2" class="field-input" value="${g('q2')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">سؤال في<input id="l_q1" class="field-input" value="${g('q1')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold sm:col-span-2">سؤال في كل جزئين<input id="l_qhalf" class="field-input" value="${g('qHalf')}"></label>
    </div>
    <p class="text-[11px] text-slate-400 mt-3 text-right">تنبيه: قيمة «المستوى» تُستخدم في احتساب الدرجة؛ استخدم <b>1</b> و<b>2</b> للمستويين الأول والثاني و<b>الإتقان</b> لاختبار الإتقان.</p>`,
    showCancelButton: true, confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء', confirmButtonColor: '#1E4D2B',
    preConfirm: () => {
      const v = (id) => document.getElementById(id).value.trim();
      const d = {
        level: v('l_level'), note: v('l_note'),
        ajza: v('l_ajza'), examPartsCount: v('l_epc'),
        parts: v('l_parts'), questionCount: v('l_qc'),
        q3: v('l_q3'), q2: v('l_q2'), q1: v('l_q1'), qHalf: v('l_qhalf'),
      };
      if (!d.level) { window.Swal.showValidationMessage('حقل المستوى مطلوب'); return false; }
      return d;
    },
  });
  if (!res.isConfirmed) return;
  toast.showLoading('...');
  try { if (isEdit) await updateLevel(existing.id, res.value); else await createLevel(res.value); toast.close(); renderLevels(); }
  catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

async function doDeleteLevel(id) {
  const ok = await toast.confirm('حذف المستوى؟', '', { confirmText: 'حذف', danger: true });
  if (!ok) return;
  toast.showLoading('...'); try { await deleteLevel(id); toast.close(); renderLevels(); } catch (e) { toast.close(); toast.error('خطأ', e.message); }
}

/* --------------------------- الإعدادات --------------------------- */
const VAR_META = {
  stages: { title: 'المراحل التعليمية', single: 'المرحلة', icon: 'school' },
  times: { title: 'فئات الحلقات', single: 'فئة الحلقة', icon: 'schedule' },
};

async function renderSettings() {
  const opts = await getVariableOptions();
  content().innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      ${varCard('stages', opts.stages)}
      ${varCard('times', opts.times)}
    </div>`;
  content().querySelectorAll('[data-var-add]').forEach((b) =>
    b.addEventListener('click', () => addVar(b.dataset.varAdd)));
  content().querySelectorAll('[data-var-body]').forEach((tb) =>
    tb.addEventListener('click', onVarClick));
}

function varCard(type, items) {
  const m = VAR_META[type];
  const rows = items.length
    ? items.map((v, i) => `<tr>
        <td class="text-slate-400 w-10">${i + 1}</td>
        <td class="font-bold text-secondary">${escapeHtml(v)}</td>
        <td><div class="flex justify-center gap-1.5">
          <button data-var-edit="${type}" data-val="${escapeHtml(v)}" class="text-emerald-600 bg-emerald-50 p-1.5 rounded" title="تعديل"><span class="material-symbols-outlined text-[18px]">edit</span></button>
          <button data-var-del="${type}" data-val="${escapeHtml(v)}" class="text-red-500 bg-red-50 p-1.5 rounded" title="حذف"><span class="material-symbols-outlined text-[18px]">delete</span></button>
        </div></td></tr>`).join('')
    : `<tr><td colspan="3" class="text-center py-8 text-slate-400">لا توجد عناصر</td></tr>`;
  return `<div class="section-card">
    <div class="flex justify-between items-center px-5 py-4 border-b border-[#e7edf3]">
      <h2 class="text-base font-bold flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[20px]">${m.icon}</span> ${m.title}</h2>
      <button data-var-add="${type}" class="btn-primary px-3.5 py-1.5 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">add</span> إضافة ${m.single}</button>
    </div>
    <div class="overflow-x-auto"><table class="data-table" style="min-width:320px;">
      <thead><tr><th>#</th><th>${m.single}</th><th>الإجراءات</th></tr></thead>
      <tbody data-var-body="${type}">${rows}</tbody>
    </table></div>
  </div>`;
}

async function addVar(type) {
  const m = VAR_META[type];
  const val = await toast.prompt(`إضافة ${m.single}`, { label: m.single });
  if (!val) return;
  toast.showLoading('...');
  try { await addVariableOption(type, val); toast.close(); renderSettings(); }
  catch (e) { toast.close(); toast.error('خطأ', e.message); }
}

async function onVarClick(e) {
  const ed = e.target.closest('[data-var-edit]');
  if (ed) {
    const type = ed.dataset.varEdit; const old = ed.dataset.val; const m = VAR_META[type];
    const val = await toast.prompt(`تعديل ${m.single}`, { label: m.single, value: old });
    if (!val || val === old) return;
    toast.showLoading('...');
    try { await updateVariableOption(type, old, val); toast.close(); renderSettings(); }
    catch (er) { toast.close(); toast.error('خطأ', er.message); }
    return;
  }
  const dl = e.target.closest('[data-var-del]');
  if (dl) {
    const type = dl.dataset.varDel; const val = dl.dataset.val; const m = VAR_META[type];
    const ok = await toast.confirm(`حذف «${val}»؟`, `سيُحذف من قائمة ${m.title}.`, { confirmText: 'حذف', danger: true });
    if (!ok) return;
    toast.showLoading('...');
    try { await removeVariableOption(type, val); toast.close(); renderSettings(); }
    catch (er) { toast.close(); toast.error('خطأ', er.message); }
  }
}

/* --------------------------- سجل النتائج السابقة --------------------------- */
async function renderHistory() {
  const [batches, schools] = await Promise.all([getBatches(), getSchools()]);
  cache.schools = schools;
  const schoolName = (id) => { const s = schools.find((x) => x.id === id); return s ? s.name : id; };
  content().innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <div>
        <h2 class="text-lg font-bold">قاعدة النتائج السابقة</h2>
        <p class="text-xs text-slate-500 mt-0.5">لاستيراد سجلات الطلاب السابقة والتأكد من اختبارهم مسبقاً. كل دفعة تظهر لمدارسها فقط.</p>
      </div>
      <button id="rh_add" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">upload_file</span> إضافة / تحديث دفعة</button>
    </div>
    <div class="section-card overflow-x-auto"><table class="data-table" style="min-width:760px;">
      <thead><tr><th>الدفعة</th><th>المدارس المرتبطة</th><th>عدد السجلات</th><th>التاريخ</th><th>الإجراءات</th></tr></thead>
      <tbody id="rh_body">${batches.length ? batches.map((b) => `<tr>
        <td class="font-bold text-secondary">${escapeHtml(b.label || '-')}</td>
        <td class="text-xs"><div class="flex flex-wrap gap-1">${(b.schools || []).map((id) => `<span class="bg-primary/10 text-primary px-2 py-0.5 rounded-full">${escapeHtml(schoolName(id))}</span>`).join('') || '-'}</div></td>
        <td class="font-bold text-emerald-600">${b.count || 0}</td>
        <td class="text-xs text-slate-500">${escapeHtml(String(b.createdAt || '').slice(0, 10))}</td>
        <td><div class="flex justify-center gap-1.5">
          <button data-rhview="${escapeHtml(b.id)}" data-label="${escapeHtml(b.label || '')}" class="text-primary bg-primary/10 p-1.5 rounded" title="معاينة / تصدير"><span class="material-symbols-outlined text-[18px]">visibility</span></button>
          <button data-rhdel="${escapeHtml(b.id)}" class="text-red-500 bg-red-50 p-1.5 rounded" title="حذف الدفعة"><span class="material-symbols-outlined text-[18px]">delete</span></button>
        </div></td>
      </tr>`).join('') : '<tr><td colspan="5" class="text-center py-8 text-slate-400">لا توجد دفعات — اضغط «إضافة / تحديث دفعة»</td></tr>'}</tbody>
    </table></div>`;
  content().querySelector('#rh_add').addEventListener('click', historyForm);
  content().querySelector('#rh_body').addEventListener('click', async (e) => {
    const vw = e.target.closest('[data-rhview]');
    if (vw) return previewBatch(vw.dataset.rhview, vw.dataset.label);
    const dl = e.target.closest('[data-rhdel]'); if (!dl) return;
    const ok = await toast.confirm('حذف الدفعة؟', 'ستُحذف كل سجلاتها نهائياً.', { confirmText: 'نعم، حذف', danger: true });
    if (!ok) return;
    toast.showLoading('جاري الحذف...');
    try { await deleteBatch(dl.dataset.rhdel); toast.close(); renderHistory(); }
    catch (er) { toast.close(); toast.error('خطأ', er.message); }
  });
}

/** معاينة سجلات دفعة في نافذة تقرير مع تصدير Excel / PDF. */
async function previewBatch(batchId, label) {
  toast.showLoading('جاري تجهيز المعاينة...');
  let rows;
  try { rows = await getBatchRecords(batchId); }
  catch (e) { toast.close(); return toast.error('خطأ', e.message); }
  toast.close();
  rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));

  const ok = openReport({
    title: label || 'سجل النتائج',
    subtitle: 'قاعدة النتائج السابقة',
    fileName: label || 'سجل النتائج',
    columns: [
      { label: 'م', get: (r, i) => i + 1 },
      { label: 'الاسم', key: 'name' },
      { label: 'الأجزاء', key: 'parts' },
      { label: 'الدرجة', key: 'score' },
      { label: 'الفصل', key: 'term' },
      { label: 'رقم الهوية', key: 'nationalId' },
    ],
    rows,
  });
  if (!ok) toast.error('تعذّر فتح النافذة', 'يرجى السماح بالنوافذ المنبثقة لهذا الموقع.');
}

async function historyForm() {
  const schools = cache.schools.length ? cache.schools : await getSchools();
  const schoolChecks = schools.length
    ? schools.map((s) => `
      <label class="school-check flex items-center justify-between gap-3 px-3 py-2 rounded-xl border cursor-pointer" style="border-color:rgba(30,77,43,0.14);background:rgba(255,255,255,0.6);">
        <span class="text-sm font-bold text-slate-700">${escapeHtml(s.name)}</span>
        <input type="checkbox" class="rh-school-cb" value="${escapeHtml(s.id)}" style="width:1.2rem;height:1.2rem;accent-color:#1E4D2B;cursor:pointer;flex:none;">
      </label>`).join('')
    : '<span class="text-xs text-slate-400 font-normal">لا توجد مدارس — أضف مدرسة أولاً</span>';

  const res = await window.Swal.fire({
    title: 'إضافة / تحديث دفعة نتائج',
    width: 780,
    html: `<div class="text-right flex flex-col gap-3">
      <label class="flex flex-col gap-1 text-sm font-bold">اسم الدفعة / الفصل
        <input id="rh_label" class="field-input" placeholder="مثال: الفصل الأول لعام 1447هـ"></label>

      <div class="text-sm font-bold">المدارس المرتبطة (تظهر لها فقط)
        <span class="block text-[11px] text-slate-400 font-normal mb-1">اضغط ✔ بجانب المدرسة لربط الدفعة بها</span>
        <div id="rh_schools" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-auto p-0.5">${schoolChecks}</div>
      </div>

      <label class="flex flex-col gap-1 text-sm font-bold">الصق البيانات من Excel
        <span class="block text-[11px] text-slate-400 font-normal">انسخ الأعمدة بالترتيب: <b>م (اختياري)</b> · الاسم · الأجزاء · الدرجة · الفصل · رقم الهوية — ثم الصقها هنا</span>
        <textarea id="rh_paste" rows="9" class="field-input font-mono text-xs" dir="ltr" placeholder="1&#9;طالب مبارك طالب الكربي&#9;1&#9;100&#9;1447-1&#9;10xxxxxxxx"></textarea>
      </label>
      <div id="rh_count" class="text-xs text-primary font-bold"></div>
    </div>`,
    showCancelButton: true, confirmButtonText: 'استيراد', cancelButtonText: 'إلغاء', confirmButtonColor: '#1E4D2B',
    didOpen: () => {
      const paste = document.getElementById('rh_paste');
      const countEl = document.getElementById('rh_count');
      const upd = () => { const n = parseResultsPaste(paste.value).length; countEl.textContent = n ? `عدد السجلات المقروءة: ${n}` : ''; };
      paste.addEventListener('input', upd);
    },
    preConfirm: () => {
      const label = document.getElementById('rh_label').value.trim();
      const schoolsSel = Array.from(document.querySelectorAll('#rh_schools .rh-school-cb:checked')).map((c) => c.value);
      const rows = parseResultsPaste(document.getElementById('rh_paste').value);
      if (!label) { window.Swal.showValidationMessage('اسم الدفعة مطلوب'); return false; }
      if (!schoolsSel.length) { window.Swal.showValidationMessage('اختر مدرسة واحدة على الأقل'); return false; }
      if (!rows.length) { window.Swal.showValidationMessage('لا توجد بيانات صالحة في اللصق'); return false; }
      return { label, schools: schoolsSel, rows };
    },
  });
  if (!res.isConfirmed) return;
  toast.showLoading(`جاري استيراد ${res.value.rows.length} سجلاً...`);
  try {
    const r = await addBatch(res.value);
    toast.close(); toast.success('تم الاستيراد', `أُضيفت ${r.count} سجلاً.`); renderHistory();
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

/* --------------------------- جوائز الطلاب --------------------------- */
async function renderRewards() {
  const [rewards, students] = await Promise.all([getRewards(), getAllStudents()]);
  cache.students = students;
  const winners = students
    .filter((s) => ['result_approved', 'certificate_ready'].includes(s.status) && s.final && s.final.score)
    .map((s) => ({ s, r: computeReward(s.examLevel, s.final.score, rewards) }))
    .filter((x) => x.r);
  const total = winners.reduce((sum, x) => sum + (Number(x.r.amount) || 0), 0);

  content().innerHTML = `
    <div class="space-y-6">
      <div class="section-card">
        <div class="flex flex-wrap justify-between items-center gap-3 border-b border-[#e7edf3] px-6 py-4">
          <div><h2 class="text-lg font-bold">مكافآت الطلاب</h2><p class="text-xs text-slate-500 mt-0.5">تُحتسب تلقائياً للطلاب الناجحين حسب المستوى والدرجة.</p></div>
          <div class="flex gap-2 items-center flex-wrap">
            <span class="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">الإجمالي: ${total} ريال</span>
            <button id="rw_report" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">summarize</span> معاينة / تصدير</button>
          </div>
        </div>
        <div class="overflow-x-auto"><table class="data-table" style="min-width:820px;">
          <thead><tr><th>م</th><th>الطالب/ة</th><th>المدرسة</th><th>المستوى</th><th>الأجزاء</th><th>الدرجة</th><th>التقدير</th><th>مقدار الجائزة</th></tr></thead>
          <tbody>${winners.length ? winners.map((x, i) => `<tr>
            <td class="text-slate-500">${i + 1}</td>
            <td class="font-bold text-secondary">${escapeHtml(x.s.name)}</td>
            <td class="text-xs">${escapeHtml(x.s.schoolName || '-')}</td>
            <td class="text-xs">${escapeHtml(x.s.examLevel)}</td>
            <td class="text-xs">${escapeHtml(partsCount(x.s.parts) || '-')}</td>
            <td class="font-bold text-emerald-600">${escapeHtml(String(x.s.final.score))}</td>
            <td class="text-xs">${escapeHtml(x.r.grade)}</td>
            <td class="font-bold text-primary">${x.r.amount} ريال</td>
          </tr>`).join('') : '<tr><td colspan="8" class="text-center py-8 text-slate-400">لا توجد مكافآت بعد — تظهر تلقائياً بعد اجتياز الطلاب</td></tr>'}</tbody>
        </table></div>
      </div>

      <div class="section-card">
        <div class="border-b border-[#e7edf3] px-6 py-4"><h2 class="text-lg font-bold">جدول الجوائز</h2><p class="text-xs text-slate-500 mt-0.5">المبالغ قابلة للتعديل (اضغط ✎).</p></div>
        <div class="overflow-x-auto"><table class="data-table" style="min-width:640px;">
          <thead><tr><th>المستوى</th><th>الجزء</th><th>التقدير</th><th>النسبة</th><th>مقدار الجائزة</th><th>تعديل</th></tr></thead>
          <tbody id="rw_cfg">${rewards.map((r) => `<tr>
            <td class="font-bold text-secondary">${escapeHtml(r.levelLabel)}</td>
            <td>${escapeHtml(String(r.juz))}</td>
            <td class="text-xs">${escapeHtml(r.grade)}</td>
            <td class="text-xs text-slate-500">${escapeHtml(r.percentLabel)}</td>
            <td class="font-bold text-primary">${r.amount} ريال</td>
            <td><button data-rwedit="${escapeHtml(r.id)}" data-amt="${r.amount}" class="text-emerald-600 bg-emerald-50 p-1.5 rounded" title="تعديل المبلغ"><span class="material-symbols-outlined text-[18px]">edit</span></button></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>
    </div>`;

  content().querySelector('#rw_report').addEventListener('click', () => rewardsReport(winners));
  content().querySelector('#rw_cfg').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-rwedit]'); if (!ed) return;
    const val = await toast.prompt('تعديل مبلغ الجائزة', { label: 'المبلغ (ريال)', value: String(ed.dataset.amt) });
    if (val == null) return;
    toast.showLoading('...');
    try { await updateRewardAmount(ed.dataset.rwedit, val); toast.close(); renderRewards(); }
    catch (er) { toast.close(); toast.error('خطأ', er.message); }
  });
}

function rewardsReport(winners) {
  const ok = openReport({
    title: 'مكافآت الطلاب المالية',
    subtitle: 'الطلاب الناجحون ومقدار مكافأة كل منهم',
    fileName: 'مكافآت الطلاب',
    columns: [
      { label: 'م', get: (x, i) => i + 1 },
      { label: 'الطالب/ة', get: (x) => x.s.name },
      { label: 'المدرسة', get: (x) => x.s.schoolName || '-' },
      { label: 'المستوى', get: (x) => x.s.examLevel },
      { label: 'الأجزاء', get: (x) => partsCount(x.s.parts) || '-' },
      { label: 'الدرجة', get: (x) => x.s.final.score },
      { label: 'التقدير', get: (x) => x.r.grade },
      { label: 'مقدار الجائزة (ريال)', get: (x) => x.r.amount },
    ],
    rows: winners,
    footNote: 'إجمالي المكافآت: ' + winners.reduce((s, x) => s + (Number(x.r.amount) || 0), 0) + ' ريال',
  });
  if (!ok) toast.error('تعذّر فتح النافذة', 'اسمح بالنوافذ المنبثقة.');
}

/* --------------------------- الاختبارات --------------------------- */
async function renderExams() {
  cache.students = await getAllStudents();
  content().innerHTML = `<div class="section-card overflow-x-auto"><table class="data-table" style="min-width:820px;">
    <thead><tr><th>الطالب</th><th>المدرسة</th><th>المستوى</th><th>الحالة</th><th>الداخلي</th><th>النهائي</th><th>إعادة فتح</th></tr></thead>
    <tbody id="ex_body"></tbody></table></div>`;
  const tb = content().querySelector('#ex_body');
  tb.innerHTML = cache.students.length ? cache.students.map((s) => `<tr>
    <td class="font-bold text-secondary">${escapeHtml(s.name)}</td>
    <td class="text-xs">${escapeHtml(s.schoolName || '-')}</td>
    <td class="text-xs">${escapeHtml(s.examLevel)}</td>
    <td>${statusBadge(s.status)}</td>
    <td class="font-bold text-emerald-600">${escapeHtml(String((s.internal && s.internal.score) || '-'))}</td>
    <td class="font-bold text-emerald-600">${escapeHtml(String((s.final && s.final.score) || '-'))}</td>
    <td><div class="flex justify-center gap-1.5">
      <button data-ropen-internal="${escapeHtml(s.id)}" class="btn-primary px-3 py-1 text-xs">الداخلي</button>
      <button data-ropen-final="${escapeHtml(s.id)}" class="btn-primary px-3 py-1 text-xs">النهائي</button>
    </div></td></tr>`).join('') : '<tr><td colspan="7" class="text-center py-8 text-slate-400">لا توجد اختبارات</td></tr>';
  tb.addEventListener('click', async (e) => {
    const ri = e.target.closest('[data-ropen-internal]'); const rf = e.target.closest('[data-ropen-final]');
    const id = ri ? ri.dataset.ropenInternal : rf ? rf.dataset.ropenFinal : null;
    if (!id) return;
    const ok = await toast.confirm('إعادة فتح الاختبار؟', '', { icon: 'warning', confirmText: 'إعادة الفتح' });
    if (!ok) return;
    toast.showLoading('...');
    try { await reopenExam(id, ri ? 'internal' : 'final'); toast.close(); renderExams(); } catch (er) { toast.close(); toast.error('خطأ', er.message); }
  });
}

/* --------------------------- سجل الأحداث --------------------------- */
async function renderAudit() {
  const logs = await getAuditLog(200);
  content().innerHTML = `<div class="section-card overflow-x-auto"><table class="data-table" style="min-width:760px;">
    <thead><tr><th>الوقت</th><th>المستخدم</th><th>الدور</th><th>العملية</th><th>التفاصيل</th></tr></thead>
    <tbody>${logs.length ? logs.map((l) => `<tr>
      <td class="text-xs font-mono">${escapeHtml((l.timestamp || '').replace('T', ' ').slice(0, 16))}</td>
      <td class="text-xs font-bold">${escapeHtml(l.actorName || '-')}</td>
      <td class="text-xs">${ROLE_LABELS[l.actorRole] || l.actorRole}</td>
      <td class="text-xs"><span class="bg-slate-100 px-2 py-0.5 rounded">${escapeHtml(l.action)}</span></td>
      <td class="text-xs text-slate-600">${escapeHtml(l.summary || '')}</td>
    </tr>`).join('') : '<tr><td colspan="5" class="text-center py-8 text-slate-400">لا توجد أحداث</td></tr>'}</tbody></table></div>`;
}
