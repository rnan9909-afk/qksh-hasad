/**
 * teacher-rewards.service.js — حوافز المعلمين (ربط الأداء بالإنتاجية)
 * ------------------------------------------------------------------
 * وفق «دليل إنتاجية المعلم والمعلمة». لكل نوع حلقة شرائح أداء
 * (متميز/ممتاز/جيد جداً/جيد/منخفض) بحدود إنتاجية وحافز.
 * الإنتاجية:
 *   - الحلقات العامة/النوعية: بالأجزاء (مجموع أجزاء الطلاب المجتازين).
 *   - النورانية/الإتقان/المقارئ/الحفظ: بعدد الطلاب المجتازين.
 * المطابقة: أعلى شريحة تتحقق إنتاجيتها ≥ حدّها الأدنى.
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { partsCount } from '../core/helpers.js';
import { logEvent } from './audit.service.js';

/** أنواع الحلقات (تُسند يدوياً لكل معلم). */
export const CIRCLE_TYPES = [
  { key: 'gen1', label: 'عامة (العصر → المغرب)', basis: 'juz', target: 18, per: 1.5, eval: 'فصلي' },
  { key: 'gen2', label: 'عامة (العصر ساعة ونصف)', basis: 'juz', target: 15, per: 1.5, eval: 'فصلي' },
  { key: 'gen3', label: 'عامة (المغرب فقط)', basis: 'juz', target: 10, per: 1.5, eval: 'فصلي' },
  { key: 'special', label: 'النوعية', basis: 'juz', target: 10, per: 3, eval: 'فصلي' },
  { key: 'noorani', label: 'النورانية', basis: 'students', target: 15, eval: 'نهاية السنة التعليمية' },
  { key: 'reciters', label: 'المقارئ', basis: 'students', target: 8, eval: 'نهاية السنة الميلادية' },
  { key: 'itqan', label: 'الإتقان', basis: 'students', target: 10, eval: 'نهاية السنة الميلادية' },
  { key: 'center_hifz', label: 'حلقات الحفظ (مركز بينات)', basis: 'students', target: 20, eval: 'نهاية السنة الثانية' },
  { key: 'center_itqan', label: 'الإتقان (مركز بينات)', basis: 'students', target: 15, eval: 'نهاية السنة الميلادية' },
  { key: 'center_reciters', label: 'المقارئ (مركز بينات)', basis: 'students', target: 10, eval: 'نهاية السنة الميلادية' },
  { key: 'rayahin', label: 'رياحين', basis: 'students', target: 20, eval: 'نهاية السنة التعليمية' },
];

export const circleLabel = (key) => (CIRCLE_TYPES.find((c) => c.key === key) || {}).label || '';
export const circleBasis = (key) => (CIRCLE_TYPES.find((c) => c.key === key) || {}).basis || 'juz';

const LEVELS = ['متميز', 'ممتاز', 'جيد جداً', 'جيد', 'منخفض'];
const ACTIONS = ['حافز', 'حافز', 'حافز', 'تنبيه', 'طي قيد'];
const SEM_PCT = ['201% فأكثر', '101-200%', '80-100%', '61-79%', '60% فأقل'];
const ANN_PCT = ['201% فأكثر', '101-200%', '76-100%', '51-75%', '50% فأقل'];

// [min,max] لكل شريحة + المبالغ، بترتيب LEVELS
const TABLE = {
  gen1: { pct: SEM_PCT, r: [[55, null], [28, 54], [22, 27], [17, 21], [0, 16]], a: [700, 600, 400, 0, 0] },
  gen2: { pct: SEM_PCT, r: [[47, null], [24, 46], [18, 23], [14, 17], [0, 13]], a: [700, 600, 400, 0, 0] },
  gen3: { pct: SEM_PCT, r: [[31, null], [16, 30], [12, 15], [9, 11], [0, 8]], a: [700, 600, 400, 0, 0] },
  special: { pct: SEM_PCT, r: [[73, null], [37, 72], [24, 30], [19, 23], [0, 18]], a: [1200, 800, 600, 0, 0] },
  noorani: { pct: ANN_PCT, r: [[31, null], [16, 30], [13, 15], [8, 12], [0, 7]], a: [1500, 1000, 800, 0, 0] },
  reciters: { pct: ANN_PCT, r: [[15, null], [9, 14], [6, 8], [3, 5], [0, 2]], a: [2000, 1300, 1000, 0, 0] },
  itqan: { pct: ANN_PCT, r: [[21, null], [11, 20], [8, 10], [6, 7], [0, 5]], a: [2000, 1300, 1000, 0, 0] },
  center_hifz: { pct: ANN_PCT, r: [[41, null], [21, 40], [16, 20], [12, 15], [0, 11]], a: [2000, 1300, 1000, 0, 0] },
  center_itqan: { pct: ANN_PCT, r: [[31, null], [16, 30], [12, 15], [9, 11], [0, 8]], a: [2000, 1300, 1000, 0, 0] },
  center_reciters: { pct: ANN_PCT, r: [[21, null], [11, 20], [8, 10], [6, 7], [0, 5]], a: [2000, 1300, 1000, 0, 0] },
  rayahin: { pct: ANN_PCT, r: [[41, null], [21, 40], [16, 20], [13, 15], [0, 12]], a: [1500, 1000, 800, 0, 0] },
};

/** الشرائح الافتراضية (تُزرع في القاعدة، المبالغ قابلة للتعديل). */
export const TR_DEFAULTS = CIRCLE_TYPES.flatMap((c, ci) => {
  const t = TABLE[c.key];
  return LEVELS.map((lvl, i) => ({
    id: `tr_${c.key}_${i}`,
    circleType: c.key, circleLabel: c.label, basis: c.basis,
    level: lvl, pctLabel: t.pct[i],
    minVal: t.r[i][0], maxVal: t.r[i][1],
    amount: t.a[i], action: ACTIONS[i],
    sortOrder: ci * 5 + i,
  }));
});

/** جلب شرائح الحوافز (من القاعدة أو الافتراضي). */
export async function getTeacherRewardTiers() {
  const rows = await db().list(COLLECTIONS.TEACHER_REWARDS);
  const list = rows.length ? rows : TR_DEFAULTS;
  return list.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/** تعديل مبلغ حافز. */
export async function updateTeacherRewardAmount(id, amount) {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt < 0) throw new Error('المبلغ غير صالح');
  const existing = await db().get(COLLECTIONS.TEACHER_REWARDS, id);
  if (existing) await db().update(COLLECTIONS.TEACHER_REWARDS, id, { amount: amt });
  else {
    const def = TR_DEFAULTS.find((r) => r.id === id);
    if (!def) throw new Error('عنصر غير موجود');
    await db().set(COLLECTIONS.TEACHER_REWARDS, id, { ...def, amount: amt });
  }
  await logEvent('teacher_reward.update', `تعديل حافز معلم (${id}) إلى ${amt}`, { targetType: 'teacherReward', targetId: id });
  return { success: true };
}

/** إنتاجية المعلم من طلابه المجتازين. */
export function computeProductivity(circleType, passedStudents) {
  const basis = circleBasis(circleType);
  if (basis === 'students') return passedStudents.length;
  // بالأجزاء: مجموع أجزاء كل طالب مجتاز (عدد أجزاء مستواه)
  return passedStudents.reduce((sum, s) => sum + (parseInt(partsCount(s.parts), 10) || 0), 0);
}

/** مطابقة الإنتاجية بالشريحة (أعلى شريحة يتحقق حدّها الأدنى). */
export function matchTier(circleType, productivity, tiers) {
  const rows = tiers.filter((t) => t.circleType === circleType).sort((a, b) => b.minVal - a.minVal);
  for (const t of rows) { if (productivity >= t.minVal) return t; }
  return null;
}
