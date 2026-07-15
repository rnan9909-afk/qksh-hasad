/**
 * schools.service.js — إدارة المدارس/المجمعات (جاهز لتعدد المدارس)
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { generateId } from '../core/helpers.js';
import { logEvent } from './audit.service.js';

export function getSchools() {
  return db().list(COLLECTIONS.SCHOOLS, { orderBy: ['name', 'asc'] });
}

export async function createSchool(name) {
  if (!name || !name.trim()) throw new Error('اسم المدرسة مطلوب');
  const id = 'sch_' + generateId();
  await db().create(COLLECTIONS.SCHOOLS, { name: name.trim(), active: true }, id);
  await logEvent('school.create', `إضافة مدرسة: ${name}`, { targetType: 'school', targetId: id });
  return { success: true, id };
}

export async function updateSchool(id, patch) {
  await db().update(COLLECTIONS.SCHOOLS, id, patch);
  await logEvent('school.update', `تعديل مدرسة`, { targetType: 'school', targetId: id });
  return { success: true };
}

export async function deleteSchool(id) {
  await db().remove(COLLECTIONS.SCHOOLS, id);
  await logEvent('school.delete', `حذف مدرسة`, { targetType: 'school', targetId: id });
  return { success: true };
}
