/**
 * bylaws.service.js — لوائح الاختبار المتعددة
 * ------------------------------------------------------------------
 * كل لائحة لها مستوياتها الخاصة (نسخة من الأساسية عند الإنشاء) وقواعد
 * تقييمها. تُربط بأنواع حلقات ومشرفين، فيُطبّق تقييمها تلقائياً على
 * طلاب تلك الحلقات عند هؤلاء المشرفين. اللائحة الأساسية = bylawId فارغ.
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { generateId } from '../core/helpers.js';
import { getExamLevels } from './levels.service.js';
import { logEvent } from './audit.service.js';

/** جلب كل اللوائح المُنشأة (عدا الأساسية). */
export async function getBylaws() {
  const list = await db().list(COLLECTIONS.BYLAWS);
  return list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

/** إنشاء لائحة جديدة كنسخة من الأساسية. */
export async function createBylaw({ name, circleTypes = [], supervisors = [] }) {
  if (!name || !name.trim()) throw new Error('اسم اللائحة مطلوب');
  const id = 'bylaw_' + generateId();
  const createdAt = new Date().toISOString();
  await db().set(COLLECTIONS.BYLAWS, id, { name: name.trim(), circleTypes, supervisors, createdAt });

  // نسخ مستويات اللائحة الأساسية إلى اللائحة الجديدة
  const base = await getExamLevels('default');
  const copies = base.map((l, i) => ({
    id: id + '_' + i,
    level: l.level, note: l.note, ajza: l.ajza, parts: l.parts,
    examPartsCount: l.examPartsCount, questionCount: l.questionCount,
    q3: l.q3, q2: l.q2, q1: l.q1, qHalf: l.qHalf,
    evalCfg: l.evalCfg || {}, bylawId: id,
  }));
  if (copies.length) await db().bulkCreate(COLLECTIONS.EXAM_LEVELS, copies);

  await logEvent('bylaw.create', `إضافة لائحة اختبار: ${name} (${copies.length} مستوى)`, { targetType: 'bylaw', targetId: id });
  return { success: true, id, levels: copies.length };
}

/** تعديل بيانات لائحة (الاسم/الحلقات/المشرفون). */
export async function updateBylaw(id, patch) {
  const clean = {};
  for (const k of ['name', 'circleTypes', 'supervisors']) if (patch[k] !== undefined) clean[k] = patch[k];
  await db().update(COLLECTIONS.BYLAWS, id, clean);
  await logEvent('bylaw.update', 'تعديل لائحة اختبار', { targetType: 'bylaw', targetId: id });
  return { success: true };
}

/** حذف لائحة ومستوياتها. */
export async function deleteBylaw(id) {
  await db().removeWhere(COLLECTIONS.EXAM_LEVELS, ['bylawId', '==', id]);
  await db().remove(COLLECTIONS.BYLAWS, id);
  await logEvent('bylaw.delete', 'حذف لائحة اختبار', { targetType: 'bylaw', targetId: id });
  return { success: true };
}

/**
 * تحديد لائحة الطالب حسب نوع حلقة معلمه، مع تفضيل تطابق المشرف إن مُرّر.
 * @returns {string} bylawId ('default' إن لا تطابق)
 */
export function resolveBylawId(circleType, bylaws, supervisorId = null) {
  if (!circleType || !Array.isArray(bylaws) || !bylaws.length) return 'default';
  const byCircle = bylaws.filter((b) => Array.isArray(b.circleTypes) && b.circleTypes.includes(circleType));
  if (!byCircle.length) return 'default';
  if (supervisorId) {
    const withSup = byCircle.find((b) => Array.isArray(b.supervisors) && b.supervisors.includes(supervisorId));
    if (withSup) return withSup.id;
  }
  return byCircle[0].id;
}
