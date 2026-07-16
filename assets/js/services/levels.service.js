/**
 * levels.service.js — لائحة الاختبارات (المستويات) + إدارتها
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { generateId } from '../core/helpers.js';
import { logEvent } from './audit.service.js';

// الحقول النصّية الإضافية للائحة (بيان الأجزاء وتوزيع الأسئلة)
const TEXT_FIELDS = ['level', 'parts', 'note', 'q3', 'q2', 'q1', 'qHalf'];
const NUM_FIELDS = ['ajza', 'examPartsCount', 'questionCount'];

/** إعدادات التقييم الافتراضية لمستوى جديد. */
export function defaultEvalCfg() {
  return {
    qValue: 16, tajweedPot: 15, talqinDed: 2, tanbihDed: 0.25, tajweedDed: 0.25,
    hasTheory: true, burnLimit: 5, failLimitTotal: 2, failLimitConsecutive: 99,
    maxTajweedDeduction: 15, isItqan: false, passScore: 70,
  };
}

/** جلب كل المستويات. */
export async function getExamLevels() {
  const rows = await db().list(COLLECTIONS.EXAM_LEVELS);
  const toInt = (v, d) => (v !== undefined && v !== null && !isNaN(v) ? parseInt(v, 10) : d);
  const mapped = rows.map((r) => ({
    id: r.id,
    level: String(r.level),
    note: String(r.note || ''),
    ajza: toInt(r.ajza, 0),
    parts: String(r.parts || ''),
    examPartsCount: toInt(r.examPartsCount, 0),
    questionCount: toInt(r.questionCount, 5),
    q3: String(r.q3 || ''),
    q2: String(r.q2 || ''),
    q1: String(r.q1 || ''),
    qHalf: String(r.qHalf || ''),
    evalCfg: (r.evalCfg && typeof r.evalCfg === 'object') ? r.evalCfg : {},
  }));
  // الترتيب: تصاعدياً حسب الأجزاء، ومستوى «الإتقان» في الأخير دائماً
  mapped.sort((a, b) => {
    const ai = /إتقان/.test(a.level) ? 1 : 0;
    const bi = /إتقان/.test(b.level) ? 1 : 0;
    if (ai !== bi) return ai - bi;
    return a.ajza - b.ajza;
  });
  return mapped;
}

/** بناء سجل من المدخلات (تنظيف الحقول). */
function buildRecord(data) {
  const rec = {};
  for (const k of TEXT_FIELDS) rec[k] = (data[k] != null ? String(data[k]).trim() : '');
  for (const k of NUM_FIELDS) rec[k] = parseInt(data[k], 10) || 0;
  if (!rec.questionCount) rec.questionCount = 5;
  return rec;
}

/** إنشاء مستوى (المشرف العام). */
export async function createLevel(data) {
  if (!data.level || !String(data.level).trim()) throw new Error('اسم المستوى مطلوب');
  const id = 'lvl_' + generateId();
  const rec = buildRecord(data);
  rec.evalCfg = data.evalCfg && typeof data.evalCfg === 'object' ? data.evalCfg : defaultEvalCfg();
  await db().create(COLLECTIONS.EXAM_LEVELS, rec, id);
  await logEvent('level.create', `إضافة مستوى: ${data.level}`, { targetType: 'level', targetId: id });
  return { success: true, id };
}

export async function updateLevel(id, patch) {
  const clean = {};
  for (const k of [...TEXT_FIELDS, ...NUM_FIELDS]) if (patch[k] !== undefined) clean[k] = patch[k];
  for (const k of NUM_FIELDS) if (clean[k] !== undefined) clean[k] = parseInt(clean[k], 10) || 0;
  if (clean.questionCount !== undefined && !clean.questionCount) clean.questionCount = 5;
  if (patch.evalCfg !== undefined) clean.evalCfg = patch.evalCfg;
  await db().update(COLLECTIONS.EXAM_LEVELS, id, clean);
  await logEvent('level.update', `تعديل مستوى`, { targetType: 'level', targetId: id });
  return { success: true };
}

export async function deleteLevel(id) {
  await db().remove(COLLECTIONS.EXAM_LEVELS, id);
  await logEvent('level.delete', `حذف مستوى`, { targetType: 'level', targetId: id });
  return { success: true };
}
