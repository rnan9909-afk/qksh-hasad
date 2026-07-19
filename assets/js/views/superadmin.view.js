/**
 * superadmin.view.js — لوحة المشرف العام (تبويبات)
 * نظرة عامة · المستخدمون · المدارس · المستويات · الإعدادات ·
 * قالب الشهادة · سجل الأحداث · الاختبارات (إعادة الفتح).
 */

import { CONFIG, ROLES, ROLE_LABELS } from '../config.js';
import { getAllUsers, createUser, updateUser, deleteUser, toggleUser, getUser } from '../services/users.service.js';
import { getAllStudents } from '../services/students.service.js';
import { getSchools, createSchool, updateSchool, deleteSchool } from '../services/schools.service.js';
import { getExamLevels, createLevel, updateLevel, deleteLevel } from '../services/levels.service.js';
import { getBylaws, createBylaw, updateBylaw, deleteBylaw } from '../services/bylaws.service.js';
import { getVariableOptions, addVariableOption, updateVariableOption, removeVariableOption } from '../services/settings.service.js';
import { getAuditLog } from '../services/audit.service.js';
import { getBatches, addBatch, deleteBatch, parseResultsPaste, getBatchRecords } from '../services/results-history.service.js';
import { getRewards, updateRewardAmount, computeReward } from '../services/rewards.service.js';
import { getTeacherRewardTiers, updateTeacherRewardAmount, computeProductivity, matchTier, CIRCLE_TYPES, circleLabel, circleBasis } from '../services/teacher-rewards.service.js';
import { reopenExam } from '../services/exams.service.js';
import { mountCertificateEditor } from '../components/certificate-editor.js';
import { openReport } from '../components/report.js';
import { statGrid, statusBadge } from '../components/ui-blocks.js';
import { escapeHtml, partsCount, hasValue, gradeText } from '../core/helpers.js';
import { passingScoreFor } from '../services/exams.service.js';
import * as toast from '../core/toast.js';

let root, session;
let cache = { users: [], students: [], schools: [], levels: [] };
let rwWinnersAll = [];   // مكافآت الطلاب (كل الناجحين)
let rwWinnersView = [];  // المعروض بعد التصفية بالمدرسة
let trTeachers = [], trStudents = [], trTiers = [], trView = [];  // مكافآت المعلمين
let repStudents = [], repView = [];  // التقارير (المختبَرون)
let currentBylaw = 'default';        // اللائحة المعروضة في تبويب المستويات
let bylawsList = [];
let scopeSchools = null;             // نطاق مدارس هذا المشرف (null = الكل)

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: 'dashboard' },
  { id: 'reports', label: 'التقارير', icon: 'analytics' },
  { id: 'users', label: 'المستخدمون', icon: 'group' },
  { id: 'schools', label: 'المدارس', icon: 'domain' },
  { id: 'levels', label: 'المستويات', icon: 'menu_book' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
  { id: 'certificate', label: 'قالب الشهادة', icon: 'workspace_premium' },
  { id: 'history', label: 'سجل النتائج', icon: 'database' },
  { id: 'rewards', label: 'جوائز الطلاب', icon: 'payments' },
  { id: 'teacherRewards', label: 'مكافآت المعلمين', icon: 'volunteer_activism' },
  { id: 'exams', label: 'الاختبارات', icon: 'fact_check' },
  { id: 'audit', label: 'سجل الأحداث', icon: 'history' },
];

export async function mount(el, sess) {
  root = el; session = sess;
  // جلب صلاحيات الحساب المحدّثة (التبويبات + المدارس) — تفادي الجلسة القديمة
  try {
    const me = await getUser(session.nationalId);
    if (me) {
      session = { ...session, tabs: Array.isArray(me.tabs) ? me.tabs : [], schools: Array.isArray(me.schools) ? me.schools : [] };
    }
  } catch { /* نكتفي بالجلسة */ }

  // المشرف العام الأساسي يرى كل شيء؛ غيره يُقيَّد بالتبويبات المسموحة
  const isPrimary = session.nationalId === CONFIG.SUPER_ADMIN_ID;
  const allowed = (isPrimary || !Array.isArray(session.tabs) || !session.tabs.length) ? TABS : TABS.filter((t) => session.tabs.includes(t.id));
  const tabsToShow = allowed.length ? allowed : TABS;
  // نطاق المدارس: null = الكل (للأساسي أو بلا تحديد)
  scopeSchools = (isPrimary || !Array.isArray(session.schools) || !session.schools.length) ? null : session.schools;

  root.innerHTML = `
    <div class="flex items-center gap-3 mb-6">
      <div class="size-9 rounded bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined">shield_person</span></div>
      <h1 class="text-xl font-bold">لوحة المشرف العام</h1>
    </div>
    <div class="flex gap-2 flex-wrap mb-6 border-b border-slate-200 pb-2" id="sa_tabs">
      ${tabsToShow.map((t, i) => `<button data-tab="${t.id}" class="sa-tab px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 ${i === 0 ? 'sa-tab-active' : 'text-slate-600 hover:bg-slate-100'}"><span class="material-symbols-outlined text-[18px]">${t.icon}</span> ${t.label}</button>`).join('')}
    </div>
    <div id="sa_content"></div>`;
  root.querySelector('#sa_tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    root.querySelectorAll('.sa-tab').forEach((x) => { x.classList.remove('sa-tab-active'); x.classList.add('text-slate-600', 'hover:bg-slate-100'); });
    b.classList.add('sa-tab-active'); b.classList.remove('text-slate-600', 'hover:bg-slate-100');
    renderTab(b.dataset.tab);
  });
  renderTab(tabsToShow[0].id);
}

/** تصفية قائمة بالطلاب/العناصر حسب نطاق مدارس هذا المشرف. */
function scopeStudents(list) {
  if (!scopeSchools) return list;
  const set = new Set(scopeSchools);
  return list.filter((s) => set.has(s.schoolId));
}

const content = () => root.querySelector('#sa_content');
const loading = () => (content().innerHTML = '<div class="text-center py-12 text-slate-400"><span class="material-symbols-outlined animate-spin text-3xl">progress_activity</span></div>');

async function renderTab(tab) {
  loading();
  if (tab === 'overview') return renderOverview();
  if (tab === 'reports') return renderReports();
  if (tab === 'users') return renderUsers();
  if (tab === 'schools') return renderSchools();
  if (tab === 'levels') return renderLevels();
  if (tab === 'settings') return renderSettings();
  if (tab === 'certificate') return mountCertificateEditor(content());
  if (tab === 'history') return renderHistory();
  if (tab === 'rewards') return renderRewards();
  if (tab === 'teacherRewards') return renderTeacherRewards();
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
  const allUsers = await getAllUsers();
  cache.schools = await getSchools();
  // نطاق المدارس: أظهر مستخدمي مدارس النطاق فقط (المشرفون حسب تقاطع مدارسهم)
  cache.users = !scopeSchools ? allUsers : allUsers.filter((u) => {
    if (u.role === ROLES.EXAM_SUPERVISOR || u.role === ROLES.SUPER_ADMIN) return Array.isArray(u.schools) && u.schools.some((s) => scopeSchools.includes(s));
    return scopeSchools.includes(u.schoolId);
  });
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
  const roleList = [ROLES.ADMIN, ROLES.TEACHER, ROLES.EXAM_SUPERVISOR, ROLES.SUPER_ADMIN];
  const roleOpts = roleList.map((r) => `<option value="${r}" ${existing && existing.role === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('');
  const exTabs = (existing && Array.isArray(existing.tabs)) ? existing.tabs : [];
  const tabsChecks = TABS.map((t) => `
    <label class="school-check flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer" style="border-color:rgba(30,77,43,0.14);background:rgba(255,255,255,0.6);">
      <span class="text-xs font-bold text-slate-700">${escapeHtml(t.label)}</span>
      <input type="checkbox" class="u-tab-cb" value="${t.id}" ${exTabs.length === 0 || exTabs.includes(t.id) ? 'checked' : ''} style="width:1.1rem;height:1.1rem;accent-color:#1E4D2B;">
    </label>`).join('');
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
  const isTeacher = existing && existing.role === ROLES.TEACHER;
  const isSuper = existing && existing.role === ROLES.SUPER_ADMIN;
  const circleOpts = ['<option value="">— غير محدّد —</option>', ...CIRCLE_TYPES.map((c) => `<option value="${c.key}" ${existing && existing.circleType === c.key ? 'selected' : ''}>${escapeHtml(c.label)}</option>`)].join('');

  const res = await window.Swal.fire({
    title: isEdit ? 'تعديل مستخدم' : 'إضافة مستخدم',
    html: `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
      <label class="flex flex-col gap-1 text-sm font-bold">الاسم<input id="u_name" class="field-input" value="${g('name')}"></label>
      <label class="flex flex-col gap-1 text-sm font-bold">رقم الهوية<input id="u_id" class="field-input" maxlength="10" value="${g('id')}" ${isEdit ? 'readonly' : ''}></label>
      <label class="flex flex-col gap-1 text-sm font-bold">الدور<select id="u_role" class="field-select">${roleOpts}</select></label>
      <label id="u_school_wrap" class="flex flex-col gap-1 text-sm font-bold ${isSup || isSuper ? 'hidden' : ''}">المدرسة<select id="u_school" class="field-select">${schoolOpts}</select></label>
      <label id="u_circle_wrap" class="flex flex-col gap-1 text-sm font-bold ${isTeacher ? '' : 'hidden'}">نوع الحلقة (لائحة الحوافز)<select id="u_circle" class="field-select">${circleOpts}</select></label>
      <label class="flex flex-col gap-1 text-sm font-bold">الجوال<input id="u_phone" class="field-input" maxlength="10" value="${g('phone')}"></label>
      <label id="u_schools_wrap" class="flex flex-col gap-1 text-sm font-bold sm:col-span-2 ${isSup || isSuper ? '' : 'hidden'}"><span id="u_schools_lbl">المدارس المتاحة</span>
        <span id="u_schools_hint" class="text-[11px] text-slate-400 font-normal mb-1">اضغط ✔ بجانب المدرسة</span>
        <div id="u_schools_list" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-auto p-0.5">${schoolChecks}</div>
      </label>
      <label id="u_tabs_wrap" class="flex flex-col gap-1 text-sm font-bold sm:col-span-2 ${isSuper ? '' : 'hidden'}">التبويبات التي تظهر له
        <span class="text-[11px] text-slate-400 font-normal mb-1">اختر ما يظهر لهذا المشرف العام</span>
        <div id="u_tabs_list" class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-auto p-0.5">${tabsChecks}</div>
      </label>
    </div>`,
    showCancelButton: true, confirmButtonText: isEdit ? 'حفظ' : 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#1E4D2B',
    didOpen: () => {
      const roleSel = document.getElementById('u_role');
      const toggle = () => {
        const sup = roleSel.value === ROLES.EXAM_SUPERVISOR;
        const teacher = roleSel.value === ROLES.TEACHER;
        const superA = roleSel.value === ROLES.SUPER_ADMIN;
        document.getElementById('u_schools_wrap').classList.toggle('hidden', !(sup || superA));
        document.getElementById('u_school_wrap').classList.toggle('hidden', sup || superA);
        document.getElementById('u_circle_wrap').classList.toggle('hidden', !teacher);
        document.getElementById('u_tabs_wrap').classList.toggle('hidden', !superA);
        document.getElementById('u_schools_lbl').textContent = superA ? 'المدارس التي يرى نتائجها (فارغ = كل المدارس)' : 'المدارس المسؤول عنها';
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
        circleType: role === ROLES.TEACHER ? document.getElementById('u_circle').value : '',
      };
      if (role === ROLES.EXAM_SUPERVISOR || role === ROLES.SUPER_ADMIN) {
        data.schools = Array.from(document.querySelectorAll('#u_schools_list .u-school-cb:checked')).map((c) => c.value);
        data.schoolId = '';
      } else {
        data.schoolId = document.getElementById('u_school').value;
        data.schools = [];
      }
      if (role === ROLES.SUPER_ADMIN) {
        data.tabs = Array.from(document.querySelectorAll('#u_tabs_list .u-tab-cb:checked')).map((c) => c.value);
        if (!data.tabs.length) { window.Swal.showValidationMessage('اختر تبويباً واحداً على الأقل يظهر له'); return false; }
      } else {
        data.tabs = [];
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
  const allSchools = await getSchools();
  cache.schools = !scopeSchools ? allSchools : allSchools.filter((s) => scopeSchools.includes(s.id));
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

/* --------------------------- المستويات واللوائح --------------------------- */
async function renderLevels() {
  bylawsList = await getBylaws();
  if (currentBylaw !== 'default' && !bylawsList.some((b) => b.id === currentBylaw)) currentBylaw = 'default';
  cache.levels = await getExamLevels(currentBylaw);
  const dash = (v) => (v === '' || v === 0 || v == null ? '<span class="text-slate-300">-</span>' : escapeHtml(String(v)));
  const bylawOpts = ['<option value="default">اللائحة الأساسية</option>', ...bylawsList.map((b) => `<option value="${escapeHtml(b.id)}" ${currentBylaw === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`)].join('');
  const isDefault = currentBylaw === 'default';
  content().innerHTML = `
    <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
      <div>
        <h2 class="text-lg font-bold">لائحة الاختبارات المعتمدة</h2>
        <p class="text-xs text-slate-500 mt-0.5">اختر اللائحة لعرض/تعديل مستوياتها. كل لائحة تُطبَّق على حلقاتها ومشرفيها تلقائياً.</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <select id="lv_bylaw" class="rounded-lg border border-[#e7edf3] px-3 py-2 text-sm font-bold">${bylawOpts}</select>
        <button id="lv_addbylaw" class="btn-gold px-3 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">library_add</span> إضافة لائحة</button>
        ${isDefault ? '' : `<button id="lv_editbylaw" class="text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">tune</span> إعدادات اللائحة</button>
        <button id="lv_delbylaw" class="text-red-500 bg-red-50 px-3 py-2 rounded-lg text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">delete</span> حذف اللائحة</button>`}
        <button id="lv_add" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">add</span> إضافة مستوى</button>
      </div>
    </div>
    ${isDefault ? '' : `<div class="mb-3 text-xs bg-amber-50 border border-amber-100 text-amber-800 rounded-lg p-2.5"><span class="material-symbols-outlined text-[15px]" style="vertical-align:middle;">info</span> أنت تعرض لائحة خاصة — تعديلاتك على المستويات هنا تخص هذه اللائحة فقط.</div>`}
    <div class="section-card overflow-x-auto"><table class="data-table text-center" style="min-width:1000px;">
      <thead><tr>
        <th>المستوى</th><th>الأجزاء</th><th>بيان بأرقام أجزاء الاختبار</th>
        <th>عدد أجزاء الاختبار الفعلية</th><th>عدد الأسئلة</th>
        <th>3 أسئلة في</th><th>سؤالين في</th><th>سؤال في</th><th>سؤال في كل جزئين</th>
        <th>الإجراءات</th>
      </tr></thead><tbody id="lv_body"></tbody></table></div>`;
  content().querySelector('#lv_add').addEventListener('click', () => levelForm());
  content().querySelector('#lv_body').addEventListener('click', onLevelClick);
  content().querySelector('#lv_bylaw').addEventListener('change', (e) => { currentBylaw = e.target.value; renderLevels(); });
  content().querySelector('#lv_addbylaw').addEventListener('click', () => bylawForm());
  const eb = content().querySelector('#lv_editbylaw'); if (eb) eb.addEventListener('click', () => bylawForm(bylawsList.find((b) => b.id === currentBylaw)));
  const db2 = content().querySelector('#lv_delbylaw'); if (db2) db2.addEventListener('click', doDeleteBylaw);
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
  const ec = (existing && existing.evalCfg) || {};
  const ev = (k, d) => (ec[k] != null && ec[k] !== '' ? ec[k] : d);
  const evb = (k, d) => (ec[k] != null ? !!ec[k] : d);
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

      <details class="sm:col-span-2 mt-1 border border-slate-200 rounded-xl p-3" ${isEdit ? '' : 'open'}>
        <summary class="cursor-pointer font-bold text-sm text-primary select-none flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">rule_settings</span> إعدادات التقييم (قواعد الدرجات والرسوب)</summary>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <label class="flex flex-col gap-1 text-xs font-bold">درجة السؤال الواحد<input id="ev_qValue" type="number" step="0.25" class="field-input" value="${ev('qValue', 16)}"></label>
          <label class="flex flex-col gap-1 text-xs font-bold">درجة التجويد العملي (الكلية)<input id="ev_tajweedPot" type="number" step="0.25" class="field-input" value="${ev('tajweedPot', 15)}"></label>
          <label class="flex flex-col gap-1 text-xs font-bold">خصم التلقين (لكل مرة)<input id="ev_talqinDed" type="number" step="0.25" class="field-input" value="${ev('talqinDed', 2)}"></label>
          <label class="flex flex-col gap-1 text-xs font-bold">خصم التنبيه (لكل مرة)<input id="ev_tanbihDed" type="number" step="0.25" class="field-input" value="${ev('tanbihDed', 0.25)}"></label>
          <label class="flex flex-col gap-1 text-xs font-bold">خصم خطأ التجويد (لكل مرة)<input id="ev_tajweedDed" type="number" step="0.25" class="field-input" value="${ev('tajweedDed', 0.25)}"></label>
          <label class="flex flex-col gap-1 text-xs font-bold">حدّ حرق السؤال (عدد أخطاء التلقين)<input id="ev_burnLimit" type="number" step="0.5" class="field-input" value="${ev('burnLimit', 5)}"></label>
          <label class="flex flex-col gap-1 text-xs font-bold">عدد الأسئلة المحروقة للرسوب<input id="ev_failTotal" type="number" class="field-input" value="${ev('failLimitTotal', 2)}"></label>
          <label class="flex flex-col gap-1 text-xs font-bold">المحروقة المتتالية للرسوب<input id="ev_failCons" type="number" class="field-input" value="${ev('failLimitConsecutive', 99)}"></label>
          <label class="flex flex-col gap-1 text-xs font-bold">أقصى خصم للتجويد<input id="ev_maxTaj" type="number" step="0.25" class="field-input" value="${ev('maxTajweedDeduction', 15)}"></label>
          <label class="flex flex-col gap-1 text-xs font-bold">درجة النجاح<input id="ev_pass" type="number" class="field-input" value="${ev('passScore', 70)}"></label>
          <label class="flex items-center gap-2 text-xs font-bold"><input id="ev_theory" type="checkbox" ${evb('hasTheory', true) ? 'checked' : ''} style="width:1.1rem;height:1.1rem;accent-color:#1E4D2B;"> يُحتسب التجويد النظري</label>
          <label class="flex items-center gap-2 text-xs font-bold"><input id="ev_itqan" type="checkbox" ${evb('isItqan', false) ? 'checked' : ''} style="width:1.1rem;height:1.1rem;accent-color:#1E4D2B;"> نمط الإتقان (لجنة + حرق بالنقاط)</label>
        </div>
        <p class="text-[11px] text-slate-400 mt-2">مثال: «عدد الأسئلة المحروقة للرسوب = 1» يعني رسوب الطالب بحرق سؤال واحد. و«حدّ حرق السؤال = 5» يعني حرق السؤال عند 5 أخطاء تلقين.</p>
      </details>
    </div>
    <p class="text-[11px] text-slate-400 mt-3 text-right">تنبيه: قيمة «المستوى» تُستخدم في احتساب الدرجة؛ استخدم <b>1</b> و<b>2</b> للمستويين الأول والثاني و<b>الإتقان</b> لاختبار الإتقان.</p>`,
    showCancelButton: true, confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء', confirmButtonColor: '#1E4D2B',
    preConfirm: () => {
      const v = (id) => document.getElementById(id).value.trim();
      const num = (id, d) => { const x = parseFloat(document.getElementById(id).value); return isNaN(x) ? d : x; };
      const d = {
        level: v('l_level'), note: v('l_note'),
        ajza: v('l_ajza'), examPartsCount: v('l_epc'),
        parts: v('l_parts'), questionCount: v('l_qc'),
        q3: v('l_q3'), q2: v('l_q2'), q1: v('l_q1'), qHalf: v('l_qhalf'),
        evalCfg: {
          qValue: num('ev_qValue', 16), tajweedPot: num('ev_tajweedPot', 15),
          talqinDed: num('ev_talqinDed', 2), tanbihDed: num('ev_tanbihDed', 0.25), tajweedDed: num('ev_tajweedDed', 0.25),
          burnLimit: num('ev_burnLimit', 5), failLimitTotal: num('ev_failTotal', 2), failLimitConsecutive: num('ev_failCons', 99),
          maxTajweedDeduction: num('ev_maxTaj', 15), passScore: num('ev_pass', 70),
          hasTheory: document.getElementById('ev_theory').checked, isItqan: document.getElementById('ev_itqan').checked,
        },
      };
      if (!d.level) { window.Swal.showValidationMessage('حقل المستوى مطلوب'); return false; }
      return d;
    },
  });
  if (!res.isConfirmed) return;
  toast.showLoading('...');
  try {
    if (isEdit) await updateLevel(existing.id, res.value);
    else await createLevel({ ...res.value, bylawId: currentBylaw === 'default' ? '' : currentBylaw });
    toast.close(); renderLevels();
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

/* --------------------------- إدارة اللوائح --------------------------- */
async function bylawForm(existing = null) {
  const isEdit = !!existing;
  const supervisors = (await getAllUsers()).filter((u) => u.role === ROLES.EXAM_SUPERVISOR);
  const exCircles = (existing && Array.isArray(existing.circleTypes)) ? existing.circleTypes : [];
  const exSups = (existing && Array.isArray(existing.supervisors)) ? existing.supervisors : [];
  const circleChecks = CIRCLE_TYPES.map((c) => `
    <label class="school-check flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer" style="border-color:rgba(30,77,43,0.14);background:rgba(255,255,255,0.6);">
      <span class="text-xs font-bold text-slate-700">${escapeHtml(c.label)}</span>
      <input type="checkbox" class="bl-circle" value="${c.key}" ${exCircles.includes(c.key) ? 'checked' : ''} style="width:1.1rem;height:1.1rem;accent-color:#1E4D2B;">
    </label>`).join('');
  const supChecks = supervisors.length ? supervisors.map((u) => `
    <label class="school-check flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer" style="border-color:rgba(30,77,43,0.14);background:rgba(255,255,255,0.6);">
      <span class="text-xs font-bold text-slate-700">${escapeHtml(u.name)}</span>
      <input type="checkbox" class="bl-sup" value="${escapeHtml(u.id)}" ${exSups.includes(u.id) ? 'checked' : ''} style="width:1.1rem;height:1.1rem;accent-color:#1E4D2B;">
    </label>`).join('') : '<span class="text-xs text-slate-400">لا يوجد مشرفون</span>';

  const res = await window.Swal.fire({
    title: isEdit ? 'إعدادات اللائحة' : 'إضافة لائحة اختبار',
    width: 720,
    html: `<div class="text-right flex flex-col gap-3">
      <label class="flex flex-col gap-1 text-sm font-bold">اسم اللائحة<input id="bl_name" class="field-input" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="مثال: لائحة الحلقات النوعية"></label>
      <div class="text-sm font-bold">أنواع الحلقات التابعة لهذه اللائحة
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 max-h-40 overflow-auto p-0.5">${circleChecks}</div>
      </div>
      <div class="text-sm font-bold">المشرفون على هذه اللائحة
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 max-h-40 overflow-auto p-0.5">${supChecks}</div>
      </div>
      ${isEdit ? '' : '<p class="text-[11px] text-slate-400">ستُنسخ مستويات اللائحة الأساسية إلى اللائحة الجديدة لتعدّلها لاحقاً.</p>'}
    </div>`,
    showCancelButton: true, confirmButtonText: isEdit ? 'حفظ' : 'إنشاء اللائحة', cancelButtonText: 'إلغاء', confirmButtonColor: '#1E4D2B',
    preConfirm: () => {
      const name = document.getElementById('bl_name').value.trim();
      const circleTypes = Array.from(document.querySelectorAll('.bl-circle:checked')).map((c) => c.value);
      const sups = Array.from(document.querySelectorAll('.bl-sup:checked')).map((c) => c.value);
      if (!name) { window.Swal.showValidationMessage('اسم اللائحة مطلوب'); return false; }
      return { name, circleTypes, supervisors: sups };
    },
  });
  if (!res.isConfirmed) return;
  toast.showLoading(isEdit ? 'جاري الحفظ...' : 'جاري إنشاء اللائحة ونسخ المستويات...');
  try {
    if (isEdit) await updateBylaw(existing.id, res.value);
    else { const r = await createBylaw(res.value); currentBylaw = r.id; }
    toast.close(); toast.success('تم', isEdit ? 'حُفظت إعدادات اللائحة.' : 'أُنشئت اللائحة.'); renderLevels();
  } catch (err) { toast.close(); toast.error('خطأ', err.message); }
}

async function doDeleteBylaw() {
  const b = bylawsList.find((x) => x.id === currentBylaw); if (!b) return;
  const ok = await toast.confirm(`حذف لائحة «${b.name}»؟`, 'ستُحذف مستوياتها الخاصة نهائياً.', { confirmText: 'نعم، حذف', danger: true });
  if (!ok) return;
  toast.showLoading('جاري الحذف...');
  try { await deleteBylaw(currentBylaw); currentBylaw = 'default'; toast.close(); renderLevels(); }
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
  const [allBatches, schools] = await Promise.all([getBatches(), getSchools()]);
  cache.schools = schools;
  const batches = !scopeSchools ? allBatches : allBatches.filter((b) => Array.isArray(b.schools) && b.schools.some((s) => scopeSchools.includes(s)));
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
const rwKey = (s) => s.schoolId || s.schoolName || '—';

async function renderRewards() {
  const [rewards, allStudents] = await Promise.all([getRewards(), getAllStudents()]);
  const students = scopeStudents(allStudents);
  cache.students = students;
  rwWinnersAll = students
    .filter((s) => ['result_approved', 'certificate_ready'].includes(s.status) && s.final && s.final.score)
    .map((s) => ({ s, r: computeReward(s.examLevel, s.final.score, rewards) }))
    .filter((x) => x.r);

  // المدارس التي لديها فائزون (لأداة التصفية)
  const schoolMap = new Map();
  rwWinnersAll.forEach((x) => { schoolMap.set(rwKey(x.s), x.s.schoolName || '—'); });
  const schoolChips = [...schoolMap.entries()].map(([id, name]) => `
    <label class="school-check inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-xs" style="border-color:rgba(30,77,43,0.16);background:rgba(255,255,255,0.6);">
      <input type="checkbox" class="rw-fs" value="${escapeHtml(id)}" checked style="width:1rem;height:1rem;accent-color:#1E4D2B;">
      <span class="font-bold text-slate-700">${escapeHtml(name)}</span>
    </label>`).join('');

  content().innerHTML = `
    <div class="space-y-6">
      <div class="section-card">
        <div class="flex flex-wrap justify-between items-center gap-3 border-b border-[#e7edf3] px-6 py-4">
          <div><h2 class="text-lg font-bold">مكافآت الطلاب</h2><p class="text-xs text-slate-500 mt-0.5">تُحتسب تلقائياً للطلاب الناجحين حسب المستوى والدرجة.</p></div>
          <div class="flex gap-2 items-center flex-wrap">
            <span id="rw_total" class="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full"></span>
            <button id="rw_report" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">summarize</span> معاينة / تصدير</button>
          </div>
        </div>
        ${schoolMap.size ? `<div class="px-6 py-3 border-b border-[#eef2f7] bg-slate-50/60 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">event</span> التاريخ من:</span>
            <input type="date" id="rw_from" class="rounded-lg border border-[#e7edf3] px-2 py-1 text-xs">
            <span class="text-xs font-bold text-slate-600">إلى:</span>
            <input type="date" id="rw_to" class="rounded-lg border border-[#e7edf3] px-2 py-1 text-xs">
            <button id="rw_dclear" class="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full font-bold">مسح التاريخ</button>
          </div>
          <div>
            <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
              <span class="text-xs font-bold text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">filter_alt</span> تصفية بالمدرسة (يمكن اختيار أكثر من مدرسة)</span>
              <div class="flex gap-2">
                <button id="rw_all" class="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full font-bold">تحديد الكل</button>
                <button id="rw_none" class="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full font-bold">إلغاء الكل</button>
              </div>
            </div>
            <div id="rw_filter" class="flex flex-wrap gap-2">${schoolChips}</div>
          </div>
        </div>` : ''}
        <div class="overflow-x-auto"><table class="data-table" style="min-width:820px;">
          <thead><tr><th>م</th><th>الطالب/ة</th><th>المدرسة</th><th>المستوى</th><th>الأجزاء</th><th>الدرجة</th><th>التقدير</th><th>مقدار الجائزة</th></tr></thead>
          <tbody id="rw_body"></tbody>
        </table></div>
      </div>

      <details class="section-card group">
        <summary class="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between px-6 py-4">
          <div><h2 class="text-lg font-bold">جدول الجوائز</h2><p class="text-xs text-slate-500 mt-0.5">المبالغ قابلة للتعديل (اضغط ✎). — اضغط للعرض/الإخفاء</p></div>
          <span class="material-symbols-outlined text-slate-400 transition-transform group-open:rotate-180">expand_more</span>
        </summary>
        <div class="overflow-x-auto border-t border-[#e7edf3]"><table class="data-table" style="min-width:640px;">
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
      </details>
    </div>`;

  const filterEl = content().querySelector('#rw_filter');
  if (filterEl) {
    filterEl.addEventListener('change', paintRewards);
    content().querySelector('#rw_all').addEventListener('click', () => { filterEl.querySelectorAll('.rw-fs').forEach((c) => (c.checked = true)); paintRewards(); });
    content().querySelector('#rw_none').addEventListener('click', () => { filterEl.querySelectorAll('.rw-fs').forEach((c) => (c.checked = false)); paintRewards(); });
    content().querySelector('#rw_from').addEventListener('change', paintRewards);
    content().querySelector('#rw_to').addEventListener('change', paintRewards);
    content().querySelector('#rw_dclear').addEventListener('click', () => {
      content().querySelector('#rw_from').value = '';
      content().querySelector('#rw_to').value = '';
      paintRewards();
    });
  }
  content().querySelector('#rw_report').addEventListener('click', () => rewardsReport(rwWinnersView));
  content().querySelector('#rw_cfg').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-rwedit]'); if (!ed) return;
    const val = await toast.prompt('تعديل مبلغ الجائزة', { label: 'المبلغ (ريال)', value: String(ed.dataset.amt) });
    if (val == null) return;
    toast.showLoading('...');
    try { await updateRewardAmount(ed.dataset.rwedit, val); toast.close(); renderRewards(); }
    catch (er) { toast.close(); toast.error('خطأ', er.message); }
  });

  paintRewards();
}

/** إعادة رسم جدول المكافآت حسب المدارس المحددة. */
function paintRewards() {
  const filterEl = content().querySelector('#rw_filter');
  let list = rwWinnersAll;
  if (filterEl) {
    const sel = new Set(Array.from(filterEl.querySelectorAll('.rw-fs:checked')).map((c) => c.value));
    list = rwWinnersAll.filter((x) => sel.has(rwKey(x.s)));
  }
  // تصفية بنطاق التاريخ (تاريخ اعتماد النتيجة النهائية)
  const from = (content().querySelector('#rw_from') || {}).value || '';
  const to = (content().querySelector('#rw_to') || {}).value || '';
  if (from || to) {
    list = list.filter((x) => {
      const d = (x.s.final && x.s.final.approvedAt) ? String(x.s.final.approvedAt).slice(0, 10) : '';
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  rwWinnersView = list;
  const total = list.reduce((sum, x) => sum + (Number(x.r.amount) || 0), 0);
  const totalEl = content().querySelector('#rw_total');
  if (totalEl) totalEl.textContent = `الإجمالي: ${total} ريال (${list.length})`;
  const tb = content().querySelector('#rw_body');
  if (!tb) return;
  tb.innerHTML = list.length ? list.map((x, i) => `<tr>
    <td class="text-slate-500">${i + 1}</td>
    <td class="font-bold text-secondary">${escapeHtml(x.s.name)}</td>
    <td class="text-xs">${escapeHtml(x.s.schoolName || '-')}</td>
    <td class="text-xs">${escapeHtml(x.s.examLevel)}</td>
    <td class="text-xs">${escapeHtml(partsCount(x.s.parts) || '-')}</td>
    <td class="font-bold text-emerald-600">${escapeHtml(String(x.s.final.score))}</td>
    <td class="text-xs">${escapeHtml(x.r.grade)}</td>
    <td class="font-bold text-primary">${x.r.amount} ريال</td>
  </tr>`).join('') : '<tr><td colspan="8" class="text-center py-8 text-slate-400">لا توجد مكافآت مطابقة</td></tr>';
}

function rewardsReport(winners) {
  if (!winners.length) { toast.info('لا توجد بيانات', 'اختر مدرسة واحدة على الأقل بها مكافآت.'); return; }
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

/* --------------------------- التقارير --------------------------- */
const GRADES = ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'راسب'];
const GRADE_COLOR = { 'ممتاز': 'emerald', 'جيد جداً': 'lime', 'جيد': 'amber', 'مقبول': 'orange', 'راسب': 'red' };
const isPassed = (s) => !!(s.final && s.final.passed);
const gradeOf = (s) => (isPassed(s) ? gradeText(Number(s.final.score), passingScoreFor(s.examLevel)) : 'راسب');

async function renderReports() {
  const [allStudents, schools] = await Promise.all([getAllStudents(), getSchools()]);
  cache.schools = schools;
  repStudents = scopeStudents(allStudents).filter((s) => s.final && hasValue(s.final.score)); // المختبَرون (له نتيجة نهائية)

  const smap = new Map();
  repStudents.forEach((s) => { const sc = schools.find((x) => x.id === s.schoolId); smap.set(s.schoolId || '—', sc ? sc.name : (s.schoolName || '—')); });
  const schoolChips = [...smap.entries()].map(([id, name]) => `
    <label class="school-check inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-xs" style="border-color:rgba(30,77,43,0.16);background:rgba(255,255,255,0.6);">
      <input type="checkbox" class="rep-fs" value="${escapeHtml(id)}" checked style="width:1rem;height:1rem;accent-color:#1E4D2B;">
      <span class="font-bold text-slate-700">${escapeHtml(name)}</span>
    </label>`).join('');

  content().innerHTML = `
    <div class="space-y-6">
      <div id="rep_cards"></div>

      <div class="section-card">
        <div class="border-b border-[#e7edf3] px-6 py-4 flex flex-wrap justify-between items-center gap-3">
          <div><h2 class="text-lg font-bold">تقرير المختبَرين</h2><p class="text-xs text-slate-500 mt-0.5">المتقدمون للاختبار النهائي ونتائجهم.</p></div>
          <button id="rep_export" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">summarize</span> تصدير قائمة المختبَرين</button>
        </div>
        <div class="px-6 py-3 border-b border-[#eef2f7] bg-slate-50/60 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">event</span> من:</span>
            <input type="date" id="rep_from" class="rounded-lg border border-[#e7edf3] px-2 py-1 text-xs">
            <span class="text-xs font-bold text-slate-600">إلى:</span>
            <input type="date" id="rep_to" class="rounded-lg border border-[#e7edf3] px-2 py-1 text-xs">
            <span class="text-xs font-bold text-slate-600 mr-2 flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">grade</span> التقدير:</span>
            <select id="rep_grade" class="rounded-lg border border-[#e7edf3] px-2 py-1 text-xs">
              <option value="all">الكل</option>${GRADES.map((g) => `<option value="${g}">${g}</option>`).join('')}
            </select>
            <button id="rep_dclear" class="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full font-bold">مسح</button>
          </div>
          ${smap.size ? `<div>
            <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
              <span class="text-xs font-bold text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">filter_alt</span> تصفية بالمدرسة</span>
              <div class="flex gap-2"><button id="rep_all" class="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full font-bold">الكل</button><button id="rep_none" class="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full font-bold">لا شيء</button></div>
            </div>
            <div id="rep_filter" class="flex flex-wrap gap-2">${schoolChips}</div>
          </div>` : ''}
          <div id="rep_dist" class="flex flex-wrap gap-2"></div>
        </div>
        <div class="overflow-x-auto"><table class="data-table" style="min-width:900px;">
          <thead><tr><th>م</th><th>الطالب/ة</th><th>المدرسة</th><th>المعلم/ة</th><th>المستوى</th><th>الدرجة</th><th>التقدير</th><th>النتيجة</th></tr></thead>
          <tbody id="rep_body"></tbody>
        </table></div>
      </div>

      <details class="section-card group">
        <summary class="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between px-6 py-4">
          <div><h2 class="text-lg font-bold">مقارنة المدارس</h2><p class="text-xs text-slate-500 mt-0.5">عدد المختبَرين والناجحين ونسبة النجاح لكل مدرسة. — اضغط للعرض</p></div>
          <span class="material-symbols-outlined text-slate-400 transition-transform group-open:rotate-180">expand_more</span>
        </summary>
        <div class="px-6 py-3 flex justify-end"><button id="rep_export_schools" class="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">download</span> تصدير المقارنة</button></div>
        <div class="overflow-x-auto border-t border-[#e7edf3]"><table class="data-table" style="min-width:640px;">
          <thead><tr><th>المدرسة</th><th>المختبَرون</th><th>الناجحون</th><th>الراسبون</th><th>نسبة النجاح</th><th>متوسط الدرجة</th></tr></thead>
          <tbody id="rep_schools"></tbody>
        </table></div>
      </details>
    </div>`;

  const bind = (id, ev, fn) => { const el = content().querySelector(id); if (el) el.addEventListener(ev, fn); };
  bind('#rep_from', 'change', paintReports); bind('#rep_to', 'change', paintReports);
  bind('#rep_grade', 'change', paintReports);
  bind('#rep_dclear', 'click', () => { ['#rep_from', '#rep_to'].forEach((s) => { const e = content().querySelector(s); if (e) e.value = ''; }); const g = content().querySelector('#rep_grade'); if (g) g.value = 'all'; paintReports(); });
  const fEl = content().querySelector('#rep_filter');
  if (fEl) {
    fEl.addEventListener('change', paintReports);
    bind('#rep_all', 'click', () => { fEl.querySelectorAll('.rep-fs').forEach((c) => (c.checked = true)); paintReports(); });
    bind('#rep_none', 'click', () => { fEl.querySelectorAll('.rep-fs').forEach((c) => (c.checked = false)); paintReports(); });
  }
  bind('#rep_export', 'click', reportsExport);
  bind('#rep_export_schools', 'click', reportsSchoolsExport);

  paintReports();
}

/** المجموعة الأساسية بعد تصفية المدرسة + التاريخ. */
function reportsBase() {
  const fEl = content().querySelector('#rep_filter');
  const from = (content().querySelector('#rep_from') || {}).value || '';
  const to = (content().querySelector('#rep_to') || {}).value || '';
  const sel = fEl ? new Set(Array.from(fEl.querySelectorAll('.rep-fs:checked')).map((c) => c.value)) : null;
  const inDate = (d0) => {
    if (!from && !to) return true;
    const d = d0 ? String(d0).slice(0, 10) : '';
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  return repStudents.filter((s) => (!sel || sel.has(s.schoolId || '—')) && inDate(s.final && s.final.approvedAt));
}

function paintReports() {
  const base = reportsBase();
  const passed = base.filter(isPassed);
  const failed = base.length - passed.length;
  const rate = base.length ? Math.round((passed.length / base.length) * 100) : 0;
  const nums = passed.map((s) => Number(s.final.score)).filter((n) => !isNaN(n));
  const avg = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;

  content().querySelector('#rep_cards').innerHTML = statGrid([
    { label: 'المختبَرون', value: base.length, icon: 'groups', color: 'emerald' },
    { label: 'الناجحون', value: passed.length, icon: 'task_alt', color: 'green' },
    { label: 'الراسبون', value: failed, icon: 'cancel', color: 'red' },
    { label: 'نسبة النجاح', value: rate + '%', icon: 'trending_up', color: 'lime' },
    { label: 'متوسط درجة الناجحين', value: avg, icon: 'grade', color: 'amber' },
  ], 5);

  // توزيع التقديرات
  const dist = {}; GRADES.forEach((g) => (dist[g] = 0));
  base.forEach((s) => { const g = gradeOf(s); dist[g] = (dist[g] || 0) + 1; });
  content().querySelector('#rep_dist').innerHTML = '<span class="text-xs font-bold text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">donut_small</span> التقديرات:</span>' +
    GRADES.map((g) => `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-${GRADE_COLOR[g]}-50 text-${GRADE_COLOR[g]}-700 border border-${GRADE_COLOR[g]}-100">${g}: ${dist[g]}</span>`).join('');

  // الجدول (بعد تصفية التقدير)
  const gradeSel = (content().querySelector('#rep_grade') || {}).value || 'all';
  repView = gradeSel === 'all' ? base : base.filter((s) => gradeOf(s) === gradeSel);
  const schoolName = (id) => { const s = cache.schools.find((x) => x.id === id); return s ? s.name : '-'; };
  const tb = content().querySelector('#rep_body');
  tb.innerHTML = repView.length ? repView.map((s, i) => {
    const g = gradeOf(s);
    return `<tr>
      <td class="text-slate-500">${i + 1}</td>
      <td class="font-bold text-secondary">${escapeHtml(s.name)}</td>
      <td class="text-xs">${escapeHtml(schoolName(s.schoolId) || s.schoolName || '-')}</td>
      <td class="text-xs">${escapeHtml(s.teacherName || '-')}</td>
      <td class="text-xs">${escapeHtml(s.examLevel)}</td>
      <td class="font-bold text-emerald-600">${escapeHtml(String(s.final.score))}</td>
      <td class="text-xs"><span class="px-2 py-0.5 rounded-full bg-${GRADE_COLOR[g]}-50 text-${GRADE_COLOR[g]}-700 text-[11px] font-bold">${g}</span></td>
      <td>${isPassed(s) ? '<span class="text-emerald-600 text-xs font-bold">ناجح</span>' : '<span class="text-red-600 text-xs font-bold">راسب</span>'}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="text-center py-8 text-slate-400">لا توجد نتائج مطابقة</td></tr>';

  // مقارنة المدارس
  const bySchool = new Map();
  base.forEach((s) => {
    const k = s.schoolId || '—';
    if (!bySchool.has(k)) bySchool.set(k, { name: schoolName(s.schoolId) || s.schoolName || '-', tested: 0, passed: 0, sum: 0, cnt: 0 });
    const o = bySchool.get(k); o.tested++;
    if (isPassed(s)) { o.passed++; const n = Number(s.final.score); if (!isNaN(n)) { o.sum += n; o.cnt++; } }
  });
  const sb = content().querySelector('#rep_schools');
  const arr = [...bySchool.values()].sort((a, b) => b.tested - a.tested);
  sb.innerHTML = arr.length ? arr.map((o) => `<tr>
    <td class="font-bold text-secondary text-xs">${escapeHtml(o.name)}</td>
    <td>${o.tested}</td>
    <td class="text-emerald-600 font-bold">${o.passed}</td>
    <td class="text-red-600">${o.tested - o.passed}</td>
    <td class="font-bold">${o.tested ? Math.round((o.passed / o.tested) * 100) : 0}%</td>
    <td>${o.cnt ? Math.round(o.sum / o.cnt) : 0}</td>
  </tr>`).join('') : '<tr><td colspan="6" class="text-center py-6 text-slate-400">لا توجد بيانات</td></tr>';
}

function reportsExport() {
  if (!repView.length) { toast.info('لا توجد بيانات', 'لا يوجد مختبَرون مطابقون.'); return; }
  const schoolName = (id) => { const s = cache.schools.find((x) => x.id === id); return s ? s.name : '-'; };
  openReport({
    title: 'تقرير المختبَرين', subtitle: 'المتقدمون للاختبار النهائي ونتائجهم', fileName: 'تقرير المختبرين',
    columns: [
      { label: 'م', get: (s, i) => i + 1 },
      { label: 'الطالب/ة', get: (s) => s.name },
      { label: 'المدرسة', get: (s) => schoolName(s.schoolId) || s.schoolName || '-' },
      { label: 'المعلم/ة', get: (s) => s.teacherName || '-' },
      { label: 'المستوى', get: (s) => s.examLevel },
      { label: 'الدرجة', get: (s) => s.final.score },
      { label: 'التقدير', get: (s) => gradeOf(s) },
      { label: 'النتيجة', get: (s) => (isPassed(s) ? 'ناجح' : 'راسب') },
    ],
    rows: repView,
  });
}

function reportsSchoolsExport() {
  const base = reportsBase();
  const schoolName = (id) => { const s = cache.schools.find((x) => x.id === id); return s ? s.name : '-'; };
  const m = new Map();
  base.forEach((s) => {
    const k = s.schoolId || '—';
    if (!m.has(k)) m.set(k, { name: schoolName(s.schoolId) || s.schoolName || '-', tested: 0, passed: 0, sum: 0, cnt: 0 });
    const o = m.get(k); o.tested++;
    if (isPassed(s)) { o.passed++; const n = Number(s.final.score); if (!isNaN(n)) { o.sum += n; o.cnt++; } }
  });
  const rows = [...m.values()].sort((a, b) => b.tested - a.tested);
  if (!rows.length) { toast.info('لا توجد بيانات', ''); return; }
  openReport({
    title: 'مقارنة المدارس', subtitle: 'المختبَرون والناجحون ونسبة النجاح لكل مدرسة', fileName: 'مقارنة المدارس',
    columns: [
      { label: 'المدرسة', get: (o) => o.name },
      { label: 'المختبَرون', get: (o) => o.tested },
      { label: 'الناجحون', get: (o) => o.passed },
      { label: 'الراسبون', get: (o) => o.tested - o.passed },
      { label: 'نسبة النجاح', get: (o) => (o.tested ? Math.round((o.passed / o.tested) * 100) : 0) + '%' },
      { label: 'متوسط الدرجة', get: (o) => (o.cnt ? Math.round(o.sum / o.cnt) : 0) },
    ],
    rows,
  });
}

/* --------------------------- مكافآت المعلمين --------------------------- */
const trRangeLabel = (t) => (t.maxVal == null ? `${t.minVal} فأكثر` : (t.minVal === 0 ? `${t.maxVal} فأقل` : `${t.minVal} - ${t.maxVal}`));

async function renderTeacherRewards() {
  const [users, students, tiers, schools] = await Promise.all([getAllUsers(), getAllStudents(), getTeacherRewardTiers(), getSchools()]);
  cache.schools = schools;
  trTeachers = users.filter((u) => u.role === ROLES.TEACHER && (!scopeSchools || scopeSchools.includes(u.schoolId)));
  trStudents = scopeStudents(students);
  trTiers = tiers;

  // مدارس المعلمين (لأداة التصفية)
  const smap = new Map();
  trTeachers.forEach((t) => { const s = schools.find((x) => x.id === t.schoolId); smap.set(t.schoolId || '—', s ? s.name : '—'); });
  const schoolChips = [...smap.entries()].map(([id, name]) => `
    <label class="school-check inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-xs" style="border-color:rgba(30,77,43,0.16);background:rgba(255,255,255,0.6);">
      <input type="checkbox" class="tr-fs" value="${escapeHtml(id)}" checked style="width:1rem;height:1rem;accent-color:#1E4D2B;">
      <span class="font-bold text-slate-700">${escapeHtml(name)}</span>
    </label>`).join('');

  const noCircle = trTeachers.filter((t) => !t.circleType).length;

  content().innerHTML = `
    <div class="space-y-6">
      <div class="section-card">
        <div class="flex flex-wrap justify-between items-center gap-3 border-b border-[#e7edf3] px-6 py-4">
          <div><h2 class="text-lg font-bold">مكافآت المعلمين</h2><p class="text-xs text-slate-500 mt-0.5">تُحتسب الإنتاجية والأداء والحافز تلقائياً حسب لائحة الإنتاجية.</p></div>
          <div class="flex gap-2 items-center flex-wrap">
            <span id="tr_total" class="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full"></span>
            <button id="tr_report" class="btn-primary px-4 py-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">summarize</span> معاينة / تصدير</button>
          </div>
        </div>
        ${noCircle ? `<div class="px-6 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100"><span class="material-symbols-outlined text-[15px]" style="vertical-align:middle;">info</span> ${noCircle} معلم/ة بلا «نوع حلقة» — حدّده من تبويب المستخدمين ليُحتسب حافزه.</div>` : ''}
        ${smap.size ? `<div class="px-6 py-3 border-b border-[#eef2f7] bg-slate-50/60 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">event</span> التاريخ من:</span>
            <input type="date" id="tr_from" class="rounded-lg border border-[#e7edf3] px-2 py-1 text-xs">
            <span class="text-xs font-bold text-slate-600">إلى:</span>
            <input type="date" id="tr_to" class="rounded-lg border border-[#e7edf3] px-2 py-1 text-xs">
            <button id="tr_dclear" class="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full font-bold">مسح التاريخ</button>
          </div>
          <div>
            <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
              <span class="text-xs font-bold text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">filter_alt</span> تصفية بالمدرسة</span>
              <div class="flex gap-2">
                <button id="tr_all" class="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full font-bold">تحديد الكل</button>
                <button id="tr_none" class="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full font-bold">إلغاء الكل</button>
              </div>
            </div>
            <div id="tr_filter" class="flex flex-wrap gap-2">${schoolChips}</div>
          </div>
        </div>` : ''}
        <div class="overflow-x-auto"><table class="data-table" style="min-width:900px;">
          <thead><tr><th>م</th><th>المعلم/ة</th><th>المدرسة</th><th>نوع الحلقة</th><th>الإنتاجية</th><th>الأداء</th><th>الحافز</th></tr></thead>
          <tbody id="tr_body"></tbody>
        </table></div>
      </div>

      <details class="section-card group">
        <summary class="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between px-6 py-4">
          <div><h2 class="text-lg font-bold">لائحة الحوافز</h2><p class="text-xs text-slate-500 mt-0.5">المبالغ قابلة للتعديل (اضغط ✎). — اضغط للعرض/الإخفاء</p></div>
          <span class="material-symbols-outlined text-slate-400 transition-transform group-open:rotate-180">expand_more</span>
        </summary>
        <div class="overflow-x-auto border-t border-[#e7edf3]"><table class="data-table" style="min-width:720px;">
          <thead><tr><th>نوع الحلقة</th><th>الأداء</th><th>النسبة</th><th>الإنتاجية</th><th>الحافز</th><th>تعديل</th></tr></thead>
          <tbody id="tr_cfg">${tiers.map((t) => `<tr>
            <td class="text-xs font-bold text-secondary">${escapeHtml(t.circleLabel)}</td>
            <td class="text-xs">${escapeHtml(t.level)}</td>
            <td class="text-xs text-slate-500">${escapeHtml(t.pctLabel)}</td>
            <td class="text-xs">${escapeHtml(trRangeLabel(t))} ${t.basis === 'juz' ? 'جزء' : 'طالب'}</td>
            <td class="font-bold ${t.action === 'حافز' ? 'text-primary' : 'text-amber-600'}">${t.action === 'حافز' ? t.amount + ' ريال' : escapeHtml(t.action)}</td>
            <td>${t.action === 'حافز' ? `<button data-tredit="${escapeHtml(t.id)}" data-amt="${t.amount}" class="text-emerald-600 bg-emerald-50 p-1.5 rounded" title="تعديل المبلغ"><span class="material-symbols-outlined text-[18px]">edit</span></button>` : '-'}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </details>
    </div>`;

  const filterEl = content().querySelector('#tr_filter');
  if (filterEl) {
    filterEl.addEventListener('change', paintTeacherRewards);
    content().querySelector('#tr_all').addEventListener('click', () => { filterEl.querySelectorAll('.tr-fs').forEach((c) => (c.checked = true)); paintTeacherRewards(); });
    content().querySelector('#tr_none').addEventListener('click', () => { filterEl.querySelectorAll('.tr-fs').forEach((c) => (c.checked = false)); paintTeacherRewards(); });
    content().querySelector('#tr_from').addEventListener('change', paintTeacherRewards);
    content().querySelector('#tr_to').addEventListener('change', paintTeacherRewards);
    content().querySelector('#tr_dclear').addEventListener('click', () => { content().querySelector('#tr_from').value = ''; content().querySelector('#tr_to').value = ''; paintTeacherRewards(); });
  }
  content().querySelector('#tr_report').addEventListener('click', () => teacherRewardsReport(trView));
  content().querySelector('#tr_cfg').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-tredit]'); if (!ed) return;
    const val = await toast.prompt('تعديل مبلغ الحافز', { label: 'المبلغ (ريال)', value: String(ed.dataset.amt) });
    if (val == null) return;
    toast.showLoading('...');
    try { await updateTeacherRewardAmount(ed.dataset.tredit, val); toast.close(); renderTeacherRewards(); }
    catch (er) { toast.close(); toast.error('خطأ', er.message); }
  });

  paintTeacherRewards();
}

/** حساب صفوف المعلمين حسب التصفية (مدرسة + تاريخ). */
function computeTeacherRows() {
  const filterEl = content().querySelector('#tr_filter');
  const from = (content().querySelector('#tr_from') || {}).value || '';
  const to = (content().querySelector('#tr_to') || {}).value || '';
  const sel = filterEl ? new Set(Array.from(filterEl.querySelectorAll('.tr-fs:checked')).map((c) => c.value)) : null;
  const inDate = (d0) => {
    if (!from && !to) return true;
    const d = d0 ? String(d0).slice(0, 10) : '';
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  let teachers = trTeachers;
  if (sel) teachers = teachers.filter((t) => sel.has(t.schoolId || '—'));

  return teachers.map((t) => {
    const passed = trStudents.filter((s) => s.teacherId === t.id && s.final && s.final.passed && inDate(s.final.approvedAt));
    const productivity = t.circleType ? computeProductivity(t.circleType, passed) : 0;
    const tier = t.circleType ? matchTier(t.circleType, productivity, trTiers) : null;
    return { t, productivity, tier, basis: t.circleType ? circleBasis(t.circleType) : '', passedCount: passed.length };
  });
}

function paintTeacherRewards() {
  trView = computeTeacherRows();
  const total = trView.reduce((sum, r) => sum + (r.tier && r.tier.action === 'حافز' ? Number(r.tier.amount) || 0 : 0), 0);
  const totalEl = content().querySelector('#tr_total');
  if (totalEl) totalEl.textContent = `إجمالي الحوافز: ${total} ريال (${trView.length})`;
  const tb = content().querySelector('#tr_body');
  if (!tb) return;
  const schoolName = (id) => { const s = cache.schools.find((x) => x.id === id); return s ? s.name : '-'; };
  tb.innerHTML = trView.length ? trView.map((r, i) => {
    const perf = r.tier ? r.tier.level : '—';
    const perfColor = !r.tier ? 'text-slate-400' : (r.tier.action === 'حافز' ? 'text-emerald-600' : (r.tier.action === 'تنبيه' ? 'text-amber-600' : 'text-red-600'));
    const reward = !r.t.circleType ? '<span class="text-amber-600 text-xs">حدّد نوع الحلقة</span>'
      : (r.tier && r.tier.action === 'حافز' ? `<span class="font-bold text-primary">${r.tier.amount} ريال</span>` : `<span class="text-xs ${perfColor}">${escapeHtml(r.tier ? r.tier.action : '-')}</span>`);
    return `<tr>
      <td class="text-slate-500">${i + 1}</td>
      <td class="font-bold text-secondary">${escapeHtml(r.t.name)}</td>
      <td class="text-xs">${escapeHtml(schoolName(r.t.schoolId))}</td>
      <td class="text-xs">${escapeHtml(circleLabel(r.t.circleType) || '—')}</td>
      <td class="font-bold text-emerald-600">${r.t.circleType ? r.productivity + (r.basis === 'juz' ? ' جزء' : ' طالب') : '-'}</td>
      <td class="text-xs font-bold ${perfColor}">${escapeHtml(perf)}</td>
      <td>${reward}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="text-center py-8 text-slate-400">لا يوجد معلمون مطابقون</td></tr>';
}

function teacherRewardsReport(rows) {
  if (!rows.length) { toast.info('لا توجد بيانات', 'لا يوجد معلمون مطابقون للتصفية.'); return; }
  const schoolName = (id) => { const s = cache.schools.find((x) => x.id === id); return s ? s.name : '-'; };
  const ok = openReport({
    title: 'مكافآت المعلمين',
    subtitle: 'الإنتاجية والأداء والحافز حسب لائحة الإنتاجية',
    fileName: 'مكافآت المعلمين',
    columns: [
      { label: 'م', get: (r, i) => i + 1 },
      { label: 'المعلم/ة', get: (r) => r.t.name },
      { label: 'المدرسة', get: (r) => schoolName(r.t.schoolId) },
      { label: 'نوع الحلقة', get: (r) => circleLabel(r.t.circleType) || '—' },
      { label: 'الإنتاجية', get: (r) => (r.t.circleType ? r.productivity + (r.basis === 'juz' ? ' جزء' : ' طالب') : '-') },
      { label: 'الأداء', get: (r) => (r.tier ? r.tier.level : '—') },
      { label: 'الحافز (ريال)', get: (r) => (r.tier && r.tier.action === 'حافز' ? r.tier.amount : (r.tier ? r.tier.action : '-')) },
    ],
    rows,
    footNote: 'إجمالي الحوافز: ' + rows.reduce((s, r) => s + (r.tier && r.tier.action === 'حافز' ? Number(r.tier.amount) || 0 : 0), 0) + ' ريال',
  });
  if (!ok) toast.error('تعذّر فتح النافذة', 'اسمح بالنوافذ المنبثقة.');
}

/* --------------------------- الاختبارات --------------------------- */
async function renderExams() {
  cache.students = scopeStudents(await getAllStudents());
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
