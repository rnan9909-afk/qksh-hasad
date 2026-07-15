/**
 * notifications.service.js — جلب إشعارات المستخدم الحالي من سجل الإشعارات.
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';

/** هل يستهدف الإشعار هذا المستخدم؟ (نفس منطق دالة الدفع). */
function targetsMe(n, s) {
  const roles = Array.isArray(n.roles) ? n.roles : [];
  const userIds = Array.isArray(n.userIds) ? n.userIds : [];
  if (s.nationalId && userIds.includes(s.nationalId)) return true;
  if (roles.includes(s.role)) {
    if (!n.schoolId) return true;
    if (s.role === 'super_admin') return true;
    if (s.role === 'exam_supervisor') return Array.isArray(s.schools) && s.schools.includes(n.schoolId);
    return s.schoolId === n.schoolId;
  }
  return false;
}

/** إشعارات المستخدم الحالي (الأحدث أولاً). */
export async function getMyNotifications(session, limit = 100) {
  const all = await db().list(COLLECTIONS.NOTIFICATIONS, { orderBy: ['createdAt', 'desc'], limit });
  return all.filter((n) => targetsMe(n, session));
}
