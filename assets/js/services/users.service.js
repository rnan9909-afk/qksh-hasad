/**
 * users.service.js — إدارة المستخدمين (المشرف العام)
 * ------------------------------------------------------------------
 * إنشاء/تعديل/حذف حسابات (إدارة، معلمين، مشرفي اختبارات) وإيقاف/تفعيل.
 * معرّف المستخدم = رقم الهوية.
 */

import { db } from '../data/index.js';
import { COLLECTIONS, ROLES } from '../config.js';
import { getSession } from '../core/session.js';
import { toLatinDigits } from '../core/helpers.js';
import { isValidNationalId } from '../core/validation.js';
import { logEvent } from './audit.service.js';

const MANAGEABLE_ROLES = [ROLES.ADMIN, ROLES.TEACHER, ROLES.EXAM_SUPERVISOR, ROLES.SUPER_ADMIN];

/** جلب كل المستخدمين. */
export function getAllUsers() {
  return db().list(COLLECTIONS.USERS);
}

/** جلب المستخدمين حسب الدور. */
export function getUsersByRole(role) {
  return db().list(COLLECTIONS.USERS, { filters: [['role', '==', role]] });
}

/** جلب مستخدم واحد بمعرّفه (رقم الهوية). */
export function getUser(id) {
  return db().get(COLLECTIONS.USERS, id);
}

/** إنشاء مستخدم جديد. */
export async function createUser(data) {
  const id = toLatinDigits(String(data.id || '').trim());
  if (!isValidNationalId(id)) throw new Error('رقم الهوية يجب أن يكون 10 أرقام');
  if (!data.name || !data.name.trim()) throw new Error('الاسم مطلوب');
  if (!MANAGEABLE_ROLES.includes(data.role)) throw new Error('دور غير صالح');

  const existing = await db().get(COLLECTIONS.USERS, id);
  if (existing) throw new Error('يوجد مستخدم بنفس رقم الهوية');

  const session = getSession() || {};
  const record = {
    role: data.role,
    name: data.name.trim(),
    active: data.active !== false,
    schoolId: data.schoolId || '',
    schools: Array.isArray(data.schools) ? data.schools : [],
    tabs: Array.isArray(data.tabs) ? data.tabs : [],
    circleType: data.circleType || '',
    phone: toLatinDigits(data.phone || ''),
    createdAt: new Date().toISOString(),
    createdBy: session.nationalId || '',
  };
  await db().create(COLLECTIONS.USERS, record, id);
  await logEvent('user.create', `إنشاء حساب (${data.role}): ${record.name}`, { targetType: 'user', targetId: id });
  return { success: true, id };
}

/** تعديل مستخدم. */
export async function updateUser(id, patch) {
  const existing = await db().get(COLLECTIONS.USERS, id);
  if (!existing) return { success: false, message: 'المستخدم غير موجود' };
  const clean = {};
  for (const k of ['name', 'role', 'schoolId', 'schools', 'tabs', 'circleType', 'phone', 'active']) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  if (clean.phone) clean.phone = toLatinDigits(clean.phone);
  await db().update(COLLECTIONS.USERS, id, clean);
  await logEvent('user.update', `تعديل حساب: ${existing.name}`, { targetType: 'user', targetId: id });
  return { success: true };
}

/** إيقاف/تفعيل مستخدم. */
export async function toggleUser(id, active) {
  const existing = await db().get(COLLECTIONS.USERS, id);
  if (!existing) return { success: false, message: 'المستخدم غير موجود' };
  await db().update(COLLECTIONS.USERS, id, { active });
  await logEvent('user.toggle', `${active ? 'تفعيل' : 'إيقاف'} حساب: ${existing.name}`, { targetType: 'user', targetId: id });
  return { success: true };
}

/** حذف مستخدم (لا يُسمح بحذف المشرف العام الأساسي). */
export async function deleteUser(id) {
  const existing = await db().get(COLLECTIONS.USERS, id);
  if (!existing) return { success: false, message: 'المستخدم غير موجود' };
  await db().remove(COLLECTIONS.USERS, id);
  await logEvent('user.delete', `حذف حساب: ${existing.name}`, { targetType: 'user', targetId: id });
  return { success: true };
}
