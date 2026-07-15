/**
 * settings.service.js — الإعدادات العامة (المراحل والأوقات)
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { logEvent } from './audit.service.js';

/** جلب خيارات المتغيرات: المراحل والأوقات. */
export async function getVariableOptions() {
  const doc = await db().get(COLLECTIONS.SETTINGS, 'variables');
  if (!doc) return { stages: [], times: [] };
  const unique = (arr) => [...new Set((arr || []).map((s) => String(s).trim()).filter(Boolean))];
  return { stages: unique(doc.stages), times: unique(doc.times) };
}

/** حفظ خيارات المتغيرات (المشرف العام). */
export async function saveVariableOptions({ stages, times }) {
  await db().set(COLLECTIONS.SETTINGS, 'variables', {
    stages: (stages || []).map((s) => s.trim()).filter(Boolean),
    times: (times || []).map((s) => s.trim()).filter(Boolean),
  });
  await logEvent('settings.update', 'تحديث إعدادات النظام (المراحل/الأوقات)', { targetType: 'settings', targetId: 'variables' });
  return { success: true };
}

const VAR_TYPES = ['stages', 'times'];
const VAR_LABEL = { stages: 'المرحلة', times: 'فئة الحلقة' };

/** إضافة عنصر (مرحلة/فئة حلقة). */
export async function addVariableOption(type, value) {
  if (!VAR_TYPES.includes(type)) throw new Error('نوع غير صالح');
  const v = String(value || '').trim();
  if (!v) throw new Error('القيمة مطلوبة');
  const opts = await getVariableOptions();
  if (opts[type].includes(v)) throw new Error(`${VAR_LABEL[type]} موجودة مسبقاً`);
  opts[type].push(v);
  await saveVariableOptions(opts);
  return { success: true };
}

/** تعديل عنصر. */
export async function updateVariableOption(type, oldValue, newValue) {
  if (!VAR_TYPES.includes(type)) throw new Error('نوع غير صالح');
  const v = String(newValue || '').trim();
  if (!v) throw new Error('القيمة مطلوبة');
  const opts = await getVariableOptions();
  const i = opts[type].indexOf(oldValue);
  if (i === -1) throw new Error('العنصر غير موجود');
  if (v !== oldValue && opts[type].includes(v)) throw new Error(`${VAR_LABEL[type]} موجودة مسبقاً`);
  opts[type][i] = v;
  await saveVariableOptions(opts);
  return { success: true };
}

/** حذف عنصر. */
export async function removeVariableOption(type, value) {
  if (!VAR_TYPES.includes(type)) throw new Error('نوع غير صالح');
  const opts = await getVariableOptions();
  opts[type] = opts[type].filter((x) => x !== value);
  await saveVariableOptions(opts);
  return { success: true };
}
