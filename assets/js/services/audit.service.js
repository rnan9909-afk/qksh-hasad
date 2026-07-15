/**
 * audit.service.js — سجل الأحداث (Audit Log)
 * ------------------------------------------------------------------
 * يسجّل العمليات المهمة (من فعل ماذا ومتى). يقرؤه المشرف العام.
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { getSession } from '../core/session.js';
import { generateId } from '../core/helpers.js';

/**
 * تسجيل حدث. لا يُفشل العملية الأساسية إن فشل التسجيل (best-effort).
 * @param {string} action رمز العملية (مثل 'student.create')
 * @param {string} summary وصف مقروء
 * @param {{targetType?:string, targetId?:string}} [meta]
 */
export async function logEvent(action, summary, meta = {}) {
  try {
    const s = getSession() || {};
    await db().create(COLLECTIONS.AUDIT_LOG, {
      timestamp: new Date().toISOString(),
      actorId: s.nationalId || '',
      actorName: s.name || '',
      actorRole: s.role || '',
      action,
      summary,
      targetType: meta.targetType || '',
      targetId: meta.targetId || '',
    }, generateId());
  } catch (err) {
    console.warn('فشل تسجيل الحدث:', err.message);
  }
}

/** جلب آخر الأحداث (الأحدث أولاً). */
export async function getAuditLog(limit = 200) {
  const rows = await db().list(COLLECTIONS.AUDIT_LOG, { orderBy: ['timestamp', 'desc'], limit });
  return rows;
}
