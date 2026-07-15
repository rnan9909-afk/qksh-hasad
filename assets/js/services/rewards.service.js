/**
 * rewards.service.js — جوائز الطلاب المالية
 * ------------------------------------------------------------------
 * جدول جوائز قابل للتعديل (المبالغ)، واحتساب مكافأة الطالب تلقائياً حسب
 * مستواه ودرجته: ممتاز (90 فأكثر) / جيد جداً (80-89).
 * المطابقة: levelKey = student.examLevel + نطاق الدرجة.
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { logEvent } from './audit.service.js';

const P90 = 'أكبر من أو يساوي 90';
const P80 = 'من 80 إلى 89';

/** الجوائز الافتراضية (تطابق اللائحة المعتمدة). المبالغ قابلة للتعديل لاحقاً. */
export const REWARD_DEFAULTS = [
  ['1', '1', 1], ['2', '2', 2], ['3', '3', 3], ['4', '4', 4], ['5', '5', 5], ['6', '6', 6],
  ['8', '7', 8], ['10', '8', 10], ['13', '9', 13], ['15', '10', 15], ['18', '11', 18],
  ['20', '12', 20], ['23', '13', 23], ['25', '14', 25], ['30', 'الختم', 30], ['الإتقان', 'الإتقان', 30],
].flatMap(([levelKey, levelLabel, juz], i) => {
  // المبالغ من الصورة (ممتاز، جيد جداً)
  const amounts = {
    '1': [70, 35], '2': [80, 40], '3': [100, 50], '4': [110, 55], '5': [130, 65], '6': [130, 65],
    '8': [130, 65], '10': [130, 65], '13': [130, 65], '15': [130, 65], '18': [130, 65],
    '20': [200, 100], '23': [130, 65], '25': [200, 100], '30': [500, 300], 'الإتقان': [2000, 1500],
  }[levelKey];
  return [
    { id: `rw_${levelKey}_e`, levelKey, levelLabel, juz, grade: 'ممتاز', band: 'excellent', minScore: 90, maxScore: 100, percentLabel: P90, amount: amounts[0], sortOrder: i * 2 + 1 },
    { id: `rw_${levelKey}_v`, levelKey, levelLabel, juz, grade: 'جيد جداً', band: 'vgood', minScore: 80, maxScore: 89, percentLabel: P80, amount: amounts[1], sortOrder: i * 2 + 2 },
  ];
});

/** جلب جدول الجوائز (من قاعدة البيانات، أو الافتراضي إن كان فارغاً). */
export async function getRewards() {
  const rows = await db().list(COLLECTIONS.REWARDS);
  const list = rows.length ? rows : REWARD_DEFAULTS;
  return list.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/** تعديل مبلغ جائزة. */
export async function updateRewardAmount(id, amount) {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt < 0) throw new Error('المبلغ غير صالح');
  // إن كانت القاعدة فارغة (لا زالت على الافتراضي) نزرعها أولاً
  const existing = await db().get(COLLECTIONS.REWARDS, id);
  if (existing) {
    await db().update(COLLECTIONS.REWARDS, id, { amount: amt });
  } else {
    const def = REWARD_DEFAULTS.find((r) => r.id === id);
    if (!def) throw new Error('عنصر غير موجود');
    await db().set(COLLECTIONS.REWARDS, id, { ...def, amount: amt });
  }
  await logEvent('reward.update', `تعديل مبلغ جائزة (${id}) إلى ${amt}`, { targetType: 'reward', targetId: id });
  return { success: true };
}

/** نطاق الدرجة → التقدير. */
export function gradeBand(score) {
  const s = Number(score);
  if (isNaN(s)) return null;
  if (s >= 90) return 'excellent';
  if (s >= 80) return 'vgood';
  return null;
}

/**
 * احتساب مكافأة الطالب حسب مستواه ودرجته النهائية.
 * @returns {{amount:number, grade:string, reward:object}|null}
 */
export function computeReward(examLevel, score, rewards) {
  const band = gradeBand(score);
  if (!band) return null;
  const r = rewards.find((x) => String(x.levelKey) === String(examLevel) && x.band === band);
  if (!r) return null;
  return { amount: r.amount, grade: r.grade, reward: r };
}
