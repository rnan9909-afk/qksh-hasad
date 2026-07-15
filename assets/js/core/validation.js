/**
 * validation.js — قواعد التحقق من المدخلات
 * ------------------------------------------------------------------
 * تجمع كل قواعد التحقق في مكان واحد (تطابق قواعد النظام الأصلي).
 */

import { toLatinDigits } from './helpers.js';

/** رقم الهوية / السجل المدني: 10 أرقام. */
export function isValidNationalId(value) {
  const v = toLatinDigits(String(value || '').trim());
  return /^\d{10}$/.test(v);
}

/** رقم الجوال: 10 أرقام. */
export function isValidMobile(value) {
  const v = toLatinDigits(String(value || '').trim());
  return /^\d{10}$/.test(v);
}

/** سجل المعلم/ة: 10 أرقام (إن وُجد). */
export function isValidTeacherId(value) {
  const v = toLatinDigits(String(value || '').trim());
  return v.length === 10 && /^\d+$/.test(v);
}

/**
 * التحقق من نموذج تسجيل الطالب (يطابق processForm في النظام القديم).
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateStudentForm(form) {
  if (!form.studentName || !String(form.studentName).trim()) {
    return { valid: false, message: 'اسم الطالب/ة مطلوب' };
  }
  if (form.teacherID && !isValidTeacherId(form.teacherID)) {
    return { valid: false, message: 'سجل المعلمة يجب أن يكون 10 أرقام' };
  }
  if (!isValidMobile(form.studentMobile)) {
    return { valid: false, message: 'تنبيه: رقم جوال الطالب/ـة يجب أن يتكون من 10 أرقام' };
  }
  if (!form.examLevel) {
    return { valid: false, message: 'الرجاء اختيار مستوى الاختبار' };
  }
  if (!form.parts) {
    return { valid: false, message: 'لم يتم تحديد الأجزاء. يرجى التأكد من اختيار المستوى بشكل صحيح.' };
  }
  return { valid: true };
}

/** تقييد إدخال إلى أرقام فقط بطول محدد (لاستخدام oninput). */
export function digitsOnly(value, maxLength = 10) {
  return toLatinDigits(String(value)).replace(/[^0-9]/g, '').slice(0, maxLength);
}
