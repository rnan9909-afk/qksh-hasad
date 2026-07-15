/**
 * exams.service.js — سير عمل الاختبار (Workflow) وتحوّلات الحالة
 * ------------------------------------------------------------------
 * يجمع كل الانتقالات: اعتماد الداخلي (المعلم)، إرسال الطلب (الإدارة)،
 * تحديد الموعد (المشرف)، اعتماد النهائي (المشرف)، إعادة الفتح.
 * كل عملية تُسجَّل في سجل الأحداث.
 */

import { db } from '../data/index.js';
import { COLLECTIONS, CONFIG } from '../config.js';
import { getSession } from '../core/session.js';
import { isItqanLevel } from '../core/helpers.js';
import { logEvent } from './audit.service.js';
import { notify } from './push.service.js';

const DASH = 'dashboard.html';
const recips = (st) => [st.teacherId, st.nationalId].filter(Boolean);

/** درجة النجاح حسب المستوى. */
export function passingScoreFor(level) {
  return isItqanLevel(level) ? CONFIG.PASS_SCORE_ITQAN : CONFIG.PASS_SCORE_NORMAL;
}

/**
 * اعتماد الاختبار الداخلي (المعلم).
 * @param {string} id معرّف الطالب
 * @param {{score, distinction, details}} result
 */
export async function approveInternalExam(id, result) {
  const st = await db().get(COLLECTIONS.STUDENTS, id);
  if (!st) return { success: false, message: 'السجل غير موجود' };
  const session = getSession() || {};

  const internal = {
    score: result.score,
    distinction: result.distinction || '',
    details: result.details || null,
    approvedBy: session.nationalId || '',
    approvedByName: session.name || '',
    approvedAt: new Date().toISOString(),
  };
  await db().update(COLLECTIONS.STUDENTS, id, {
    internal,
    status: 'internal_approved',
    updatedAt: new Date().toISOString(),
  });
  await logEvent('exam.internal.approve', `اعتماد الاختبار الداخلي للطالب: ${st.name} (${result.score})`, { targetType: 'student', targetId: id });
  return { success: true };
}

/**
 * إرسال طلب اختبار إلى مشرف الاختبارات (الإدارة).
 * يُسمح فقط بعد اعتماد الاختبار الداخلي.
 */
export async function sendExamRequest(id) {
  const st = await db().get(COLLECTIONS.STUDENTS, id);
  if (!st) return { success: false, message: 'السجل غير موجود' };
  if (st.status !== 'internal_approved') {
    return { success: false, message: 'لا يمكن إرسال الطلب قبل اعتماد الاختبار الداخلي' };
  }
  await db().update(COLLECTIONS.STUDENTS, id, { status: 'awaiting_schedule', nomination: 'pending', updatedAt: new Date().toISOString() });
  await logEvent('exam.request.send', `إرسال طلب اختبار للطالب: ${st.name}`, { targetType: 'student', targetId: id });
  notify({ title: 'طالب بحاجة للاختبار', body: `${st.name} — ${st.schoolName || ''}`, roles: ['exam_supervisor', 'super_admin'], schoolId: st.schoolId, url: DASH });
  return { success: true };
}

/** ترشيح الطالب للاختبار (مشرف الاختبارات) — يُتيح تحديد الموعد. */
export async function nominateStudent(id) {
  const st = await db().get(COLLECTIONS.STUDENTS, id);
  if (!st) return { success: false, message: 'السجل غير موجود' };
  await db().update(COLLECTIONS.STUDENTS, id, { nomination: 'nominated', updatedAt: new Date().toISOString() });
  await logEvent('exam.nominate', `ترشيح الطالب للاختبار: ${st.name}`, { targetType: 'student', targetId: id });
  notify({ title: 'تم ترشيح الطالب', body: `${st.name} — تم ترشيحه للاختبار`, roles: ['admin', 'super_admin'], userIds: recips(st), schoolId: st.schoolId, url: DASH });
  return { success: true };
}

/** استبعاد الطالب (مشرف الاختبارات) — يلغي الموعد ويوقف مساره. */
export async function excludeStudent(id) {
  const st = await db().get(COLLECTIONS.STUDENTS, id);
  if (!st) return { success: false, message: 'السجل غير موجود' };
  await db().update(COLLECTIONS.STUDENTS, id, {
    nomination: 'excluded',
    schedule: {},
    status: 'awaiting_schedule',
    updatedAt: new Date().toISOString(),
  });
  await logEvent('exam.exclude', `استبعاد الطالب: ${st.name}`, { targetType: 'student', targetId: id });
  notify({ title: 'تم استبعاد الطالب', body: `${st.name}`, roles: ['admin', 'super_admin'], userIds: recips(st), schoolId: st.schoolId, url: DASH });
  return { success: true };
}

/**
 * تحديد/تعديل موعد الاختبار (مشرف الاختبارات).
 */
export async function scheduleExam(id, date, time) {
  const st = await db().get(COLLECTIONS.STUDENTS, id);
  if (!st) return { success: false, message: 'السجل غير موجود' };
  const session = getSession() || {};
  const schedule = {
    date, time: time || '',
    supervisorId: session.nationalId || '',
    supervisorName: session.name || '',
    setAt: new Date().toISOString(),
  };
  await db().update(COLLECTIONS.STUDENTS, id, {
    schedule, status: 'scheduled', updatedAt: new Date().toISOString(),
  });
  await logEvent('exam.schedule', `تحديد موعد اختبار للطالب: ${st.name} (${date} ${time || ''})`, { targetType: 'student', targetId: id });
  notify({ title: 'تم تحديد موعد الاختبار', body: `${st.name} — ${date}${time ? ' ' + time : ''}`, roles: ['admin', 'super_admin'], userIds: recips(st), schoolId: st.schoolId, url: DASH });
  return { success: true };
}

/**
 * اعتماد نتيجة الاختبار النهائي (مشرف الاختبارات).
 * @param {{score, distinction, details}} result — score قد تكون 'راسب'
 */
export async function approveFinalExam(id, result) {
  const st = await db().get(COLLECTIONS.STUDENTS, id);
  if (!st) return { success: false, message: 'السجل غير موجود' };
  const session = getSession() || {};

  const isFail = result.score === 'راسب';
  const numeric = isFail ? 0 : parseFloat(result.score);
  const pass = !isFail && numeric >= passingScoreFor(st.examLevel);

  const final = {
    score: result.score,
    distinction: result.distinction || '',
    details: result.details || null,
    passed: pass,
    approvedBy: session.nationalId || '',
    approvedByName: session.name || '',
    approvedAt: new Date().toISOString(),
  };
  const patch = {
    final,
    status: pass ? 'certificate_ready' : 'failed',
    certificate: { issued: pass, issuedAt: pass ? new Date().toISOString() : '' },
    updatedAt: new Date().toISOString(),
  };
  await db().update(COLLECTIONS.STUDENTS, id, patch);
  await logEvent('exam.final.approve', `اعتماد النتيجة النهائية للطالب: ${st.name} (${result.score})`, { targetType: 'student', targetId: id });
  if (pass) notify({ title: 'تم إتمام الاختبار وإصدار الشهادة', body: `${st.name} — ناجح (${result.score})`, roles: ['admin', 'super_admin', 'exam_supervisor'], userIds: recips(st), schoolId: st.schoolId, url: DASH });
  else notify({ title: 'انتهى اختبار الطالب', body: `${st.name} — لم يجتز`, roles: ['admin', 'super_admin'], userIds: recips(st), schoolId: st.schoolId, url: DASH });
  return { success: true, passed: pass };
}

/**
 * إعادة فتح الاختبار (الإدارة/المشرف العام) — يعيد الحالة لمرحلة سابقة.
 * @param {'internal'|'final'} which
 */
export async function reopenExam(id, which) {
  const st = await db().get(COLLECTIONS.STUDENTS, id);
  if (!st) return { success: false, message: 'السجل غير موجود' };

  const patch = { updatedAt: new Date().toISOString() };
  if (which === 'internal') {
    patch.status = 'awaiting_internal';
    patch.internal = {};
  } else {
    patch.status = 'scheduled';
    patch.final = {};
    patch.certificate = { issued: false };
  }
  await db().update(COLLECTIONS.STUDENTS, id, patch);
  await logEvent('exam.reopen', `إعادة فتح الاختبار (${which === 'internal' ? 'الداخلي' : 'النهائي'}) للطالب: ${st.name}`, { targetType: 'student', targetId: id });
  return { success: true };
}
