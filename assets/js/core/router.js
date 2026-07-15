/**
 * router.js — توجيه بسيط بين الصفحات والحماية
 * ------------------------------------------------------------------
 * النظام صفحتان: index.html (الدخول) و dashboard.html (التطبيق).
 * يوفّر هذا الموديول التنقّل والحراسة (guards).
 */

import { getSession } from './session.js';

const PAGES = {
  LOGIN: 'index.html',
  DASHBOARD: 'dashboard.html',
};

/** الانتقال إلى صفحة الدخول. */
export function goLogin() {
  window.location.href = PAGES.LOGIN;
}

/** الانتقال إلى لوحة التحكم. */
export function goDashboard() {
  window.location.href = PAGES.DASHBOARD;
}

/**
 * حارس صفحة الدخول: إن كان المستخدم مسجّلاً بالفعل، انقله للوحة.
 * @returns {boolean} true إن تمت إعادة التوجيه.
 */
export function redirectIfAuthenticated() {
  if (getSession()) {
    goDashboard();
    return true;
  }
  return false;
}

/**
 * حارس لوحة التحكم: إن لم يكن مسجّلاً، أعده للدخول.
 * @returns {object|null} الجلسة أو null (بعد إعادة التوجيه).
 */
export function requireSession() {
  const session = getSession();
  if (!session) {
    goLogin();
    return null;
  }
  return session;
}
