/**
 * session.js — إدارة جلسة المستخدم الحالية
 * ------------------------------------------------------------------
 * تُحفظ الجلسة في sessionStorage مع طابع زمني للانتهاء.
 * الجلسة تحمل: role, name, وبيانات إضافية حسب الدور.
 */

import { CONFIG } from '../config.js';

const KEY = 'exam_system_session';

/**
 * @typedef {Object} Session
 * @property {'supervisor'|'school'|'student'} role
 * @property {string} name
 * @property {string} [nationalId]
 * @property {string} [schoolName]      // للمدرسة
 * @property {string[]} [schools]       // للمشرف
 * @property {number} expiresAt
 */

/** حفظ الجلسة. */
export function setSession(data) {
  const session = { ...data, expiresAt: Date.now() + CONFIG.SESSION_TTL };
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

/** جلب الجلسة الحالية (أو null إن انتهت/غير موجودة). */
export function getSession() {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s.expiresAt && Date.now() > s.expiresAt) {
      clearSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

/** إنهاء الجلسة. */
export function clearSession() {
  sessionStorage.removeItem(KEY);
}

/** هل يوجد مستخدم مسجّل حالياً؟ */
export function isAuthenticated() {
  return getSession() !== null;
}
