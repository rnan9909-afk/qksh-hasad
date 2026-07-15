/**
 * rbac.js — نظام الصلاحيات المبني على الأدوار (Role-Based Access Control)
 * ------------------------------------------------------------------
 * مصدر واحد لكل الصلاحيات. الواجهات تستدعي can(cap) لإظهار/إخفاء العناصر.
 * (التطبيق على مستوى قاعدة البيانات يُشدّد لاحقاً عبر Supabase Auth + RLS.)
 */

import { getSession } from './session.js';

/** كل القدرات (Capabilities) في النظام. */
export const CAP = {
  USERS_MANAGE: 'users.manage',
  STUDENTS_CREATE: 'students.create',
  STUDENTS_EDIT: 'students.edit',
  STUDENTS_DELETE: 'students.delete',
  STUDENTS_VIEW: 'students.view',
  INTERNAL_EXAM: 'exam.internal',        // إجراء الاختبار الداخلي (المعلم)
  FINAL_EXAM: 'exam.final',              // إجراء الاختبار النهائي (مشرف الاختبارات)
  REQUEST_SEND: 'request.send',          // إرسال طلب اختبار (الإدارة)
  SCHEDULE_MANAGE: 'schedule.manage',    // تحديد/تعديل المواعيد
  CERT_PRINT: 'certificate.print',       // طباعة/تنزيل الشهادة
  CERT_TEMPLATE: 'certificate.template', // إدارة قالب الشهادة
  EXAM_REOPEN: 'exam.reopen',            // إعادة فتح اختبار
  SETTINGS_MANAGE: 'settings.manage',    // إعدادات النظام والمستويات
  AUDIT_VIEW: 'audit.view',              // سجل الأحداث
  STATS_ALL: 'stats.all',                // إحصائيات شاملة
  EXPORT: 'data.export',                 // تصدير البيانات
  SCHOOLS_MANAGE: 'schools.manage',      // إدارة المدارس
};

/** مصفوفة الصلاحيات: الدور → القدرات الممنوحة. */
const MATRIX = {
  super_admin: new Set(Object.values(CAP)), // كل الصلاحيات

  admin: new Set([
    CAP.STUDENTS_CREATE, CAP.STUDENTS_EDIT, CAP.STUDENTS_DELETE, CAP.STUDENTS_VIEW,
    CAP.REQUEST_SEND, CAP.CERT_PRINT, CAP.EXAM_REOPEN,
  ]),

  teacher: new Set([
    CAP.STUDENTS_VIEW, CAP.INTERNAL_EXAM,
  ]),

  exam_supervisor: new Set([
    CAP.STUDENTS_VIEW, CAP.SCHEDULE_MANAGE, CAP.FINAL_EXAM, CAP.CERT_PRINT,
  ]),

  student: new Set([
    CAP.CERT_PRINT, // طباعة شهادته فقط (يُقيَّد على سجله)
  ]),
};

/**
 * هل يملك الدور الحالي (أو دور محدد) هذه القدرة؟
 * @param {string} cap من CAP
 * @param {string} [role] افتراضياً دور الجلسة الحالية
 */
export function can(cap, role = null) {
  const r = role || (getSession() && getSession().role);
  if (!r) return false;
  const set = MATRIX[r];
  return !!set && set.has(cap);
}

/** كل قدرات دور معيّن (للعرض/التشخيص). */
export function capabilitiesOf(role) {
  return [...(MATRIX[role] || [])];
}
