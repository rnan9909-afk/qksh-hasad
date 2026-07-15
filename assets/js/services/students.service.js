/**
 * students.service.js — إدارة سجلات الطلاب (v2)
 * ------------------------------------------------------------------
 * الإدارة تُنشئ/تعدّل/تحذف الطلاب. لا تُدخل أي درجة (الدرجات من المعلم
 * والمشرف عبر exams.service). حساب الطالب يُنشأ تلقائياً هنا.
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { INITIAL_STATUS } from '../core/workflow.js';
import { generateId, toLatinDigits } from '../core/helpers.js';
import { getSession } from '../core/session.js';
import { isValidNationalId, isValidMobile } from '../core/validation.js';
import { logEvent } from './audit.service.js';
import { notify } from './push.service.js';

/** جلب كل الطلاب. */
export function getAllStudents() {
  return db().list(COLLECTIONS.STUDENTS);
}

/** طلاب مدرسة. */
export function getStudentsBySchool(schoolId) {
  return db().list(COLLECTIONS.STUDENTS, { filters: [['schoolId', '==', schoolId]] });
}

/** طلاب معلم. */
export function getStudentsByTeacher(teacherId) {
  return db().list(COLLECTIONS.STUDENTS, { filters: [['teacherId', '==', teacherId]] });
}

/** سجلات طالب برقم الهوية. */
export function getStudentsByNationalId(nid) {
  return db().list(COLLECTIONS.STUDENTS, { filters: [['nationalId', '==', toLatinDigits(nid)]] });
}

/** جلب طالب واحد. */
export function getStudent(id) {
  return db().get(COLLECTIONS.STUDENTS, id);
}

/**
 * إنشاء طالب جديد (من الإدارة).
 * لا يقبل أي درجة. الحالة الابتدائية = تم التسجيل.
 */
export async function createStudent(data) {
  const nationalId = toLatinDigits(String(data.nationalId || '').trim());
  if (!data.name || !data.name.trim()) throw new Error('اسم الطالب مطلوب');
  if (!isValidNationalId(nationalId)) throw new Error('رقم هوية الطالب يجب أن يكون 10 أرقام');
  if (data.mobile && !isValidMobile(data.mobile)) throw new Error('رقم الجوال يجب أن يكون 10 أرقام');
  if (!data.examLevel) throw new Error('الرجاء اختيار مستوى الاختبار');

  const session = getSession() || {};
  const record = {
    id: generateId(),
    nationalId,
    name: data.name.trim(),
    schoolId: data.schoolId || session.schoolId || '',
    schoolName: data.schoolName || '',
    className: data.className || '',
    classTime: data.classTime || '',
    eduStage: data.eduStage || '',
    mobile: toLatinDigits(data.mobile || ''),
    teacherId: data.teacherId || '',
    teacherName: data.teacherName || '',
    examLevel: data.examLevel || '',
    parts: data.parts || '',
    status: INITIAL_STATUS,
    internal: {},
    final: {},
    schedule: {},
    certificate: { issued: false },
    createdBy: session.nationalId || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db().create(COLLECTIONS.STUDENTS, record, record.id);
  await logEvent('student.create', `إضافة طالب: ${record.name}`, { targetType: 'student', targetId: record.id });
  // إشعار المعلم (والمشرف العام) بأن لديه طالباً بحاجة للاختبار الداخلي
  notify({
    title: 'لديك طالب بحاجة للاختبار',
    body: `${record.name}${record.examLevel ? ' — ' + record.examLevel : ''}`,
    roles: ['super_admin'],
    userIds: record.teacherId ? [record.teacherId] : [],
    schoolId: record.schoolId,
    url: 'dashboard.html',
  });
  return { success: true, id: record.id };
}

/** تعديل بيانات طالب (بيانات فقط، لا درجات). */
export async function updateStudent(id, patch) {
  const existing = await db().get(COLLECTIONS.STUDENTS, id);
  if (!existing) return { success: false, message: 'السجل غير موجود' };

  if (patch.nationalId && !isValidNationalId(toLatinDigits(patch.nationalId))) {
    return { success: false, message: 'رقم الهوية يجب أن يكون 10 أرقام' };
  }
  if (patch.mobile && !isValidMobile(patch.mobile)) {
    return { success: false, message: 'رقم الجوال يجب أن يكون 10 أرقام' };
  }

  const allowed = ['name', 'nationalId', 'schoolId', 'schoolName', 'className', 'classTime',
    'eduStage', 'mobile', 'teacherId', 'teacherName', 'examLevel', 'parts'];
  const clean = {};
  for (const k of allowed) if (patch[k] !== undefined) clean[k] = patch[k];
  if (clean.nationalId) clean.nationalId = toLatinDigits(clean.nationalId);
  if (clean.mobile) clean.mobile = toLatinDigits(clean.mobile);
  clean.updatedAt = new Date().toISOString();

  await db().update(COLLECTIONS.STUDENTS, id, clean);
  await logEvent('student.update', `تعديل بيانات طالب: ${existing.name}`, { targetType: 'student', targetId: id });
  return { success: true };
}

/** حذف طالب. */
export async function deleteStudent(id) {
  const existing = await db().get(COLLECTIONS.STUDENTS, id);
  if (!existing) return { success: false, message: 'السجل غير موجود' };
  await db().remove(COLLECTIONS.STUDENTS, id);
  await logEvent('student.delete', `حذف طالب: ${existing.name}`, { targetType: 'student', targetId: id });
  return { success: true };
}
