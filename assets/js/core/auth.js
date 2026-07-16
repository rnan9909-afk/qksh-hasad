/**
 * auth.js — المصادقة برقم الهوية (5 أدوار) مع كشف الدور تلقائياً
 * ------------------------------------------------------------------
 * 1) يبحث في users عن مستخدم معرّفه = رقم الهوية:
 *    super_admin / admin / teacher / exam_supervisor → لوحته.
 * 2) وإلا يبحث في students عن nationalId = رقم الهوية → طالب.
 * 3) وإلا → خطأ.
 *
 * حساب الطالب يُنشأ تلقائياً بمجرد إضافته من الإدارة (لا تسجيل يدوي).
 */

import { db } from '../data/index.js';
import { COLLECTIONS, ROLES } from '../config.js';
import { setSession, clearSession } from './session.js';
import { toLatinDigits } from './helpers.js';
import { isValidNationalId } from './validation.js';

/**
 * تسجيل الدخول برقم الهوية.
 * @returns {Promise<{success, session?, message?}>}
 */
export async function login(rawId) {
  const nationalId = toLatinDigits(String(rawId || '').trim());
  if (!isValidNationalId(nationalId)) {
    return { success: false, message: 'رقم الهوية يجب أن يتكون من 10 أرقام' };
  }

  // 1) مستخدم مُدار (بأحد الأدوار الأربعة)
  const user = await db().get(COLLECTIONS.USERS, nationalId);
  if (user) {
    if (user.active === false) {
      return { success: false, message: 'هذا الحساب موقوف. راجع المشرف العام.' };
    }
    const session = setSession({
      role: user.role,
      name: user.name,
      nationalId,
      schoolId: user.schoolId || '',
      schools: Array.isArray(user.schools) ? user.schools : (user.schoolId ? [user.schoolId] : []),
      circleType: user.circleType || '',
    });
    return { success: true, session };
  }

  // 2) طالب له سجل
  const students = await db().list(COLLECTIONS.STUDENTS, {
    filters: [['nationalId', '==', nationalId]],
  });
  if (students.length > 0) {
    const session = setSession({
      role: ROLES.STUDENT,
      name: students[0].name || 'طالب/ـة',
      nationalId,
    });
    return { success: true, session, studentData: students };
  }

  return { success: false, message: 'لم يتم العثور على حساب أو سجل لرقم الهوية المُدخَل' };
}

export function logout() {
  clearSession();
}
