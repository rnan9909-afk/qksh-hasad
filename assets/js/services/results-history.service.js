/**
 * results-history.service.js — قاعدة النتائج السابقة (استيراد كبير + دفعات)
 * ------------------------------------------------------------------
 * يستورد المشرف العام دفعات نتائج (لصق من Excel) ويربطها بمدارس محددة.
 * تُستخدم للتأكد من أن الطالب قد اختُبر مسبقاً (بحث برقم الهوية/الاسم)،
 * وتظهر لكل مدرسة سجلّاتها المرتبطة بها فقط.
 *
 * ترتيب الأعمدة المتوقّع عند اللصق:
 *   [م] | الاسم | الأجزاء | الدرجة | الفصل | رقم الهوية
 * (عمود «م» التسلسلي اختياري ويُتجاهل تلقائياً)
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { generateId, toLatinDigits } from '../core/helpers.js';
import { getSession } from '../core/session.js';
import { logEvent } from './audit.service.js';

/** تحليل النص الملصوق إلى صفوف منظّمة. */
export function parseResultsPaste(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const rows = [];
  for (const line of lines) {
    let cells = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}|,|،/);
    cells = cells.map((c) => c.trim());
    const joined = cells.join(' ');
    // تجاهل صف العناوين
    if (/الاسم/.test(joined) && /(الدرجة|الأجزاء|الفصل|الهوية)/.test(joined)) continue;
    // إزاحة إن كان العمود الأول رقماً تسلسلياً (م)
    const offset = (cells.length >= 6 && /^\d+$/.test(cells[0])) ? 1 : 0;
    const name = (cells[offset] || '').trim();
    if (!name || /^\d+$/.test(name)) continue;
    rows.push({
      name,
      parts: String(cells[offset + 1] || '').trim(),
      score: String(cells[offset + 2] || '').trim(),
      term: String(cells[offset + 3] || '').trim(),
      nationalId: toLatinDigits(String(cells[offset + 4] || '').trim()),
    });
  }
  return rows;
}

/** جلب قائمة الدفعات (الأحدث أولاً). */
export async function getBatches() {
  const list = await db().list(COLLECTIONS.RESULT_BATCHES);
  return list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** إضافة دفعة نتائج جديدة (استيراد كبير + ربط بمدارس). */
export async function addBatch({ label, schools, rows }) {
  if (!rows || !rows.length) throw new Error('لا توجد بيانات صالحة للاستيراد');
  if (!schools || !schools.length) throw new Error('اختر مدرسة واحدة على الأقل لربط الدفعة');
  const batchId = 'batch_' + generateId();
  const createdAt = new Date().toISOString();
  const session = getSession() || {};

  const records = rows.map((r, i) => ({
    id: batchId + '_' + i,
    name: r.name,
    parts: r.parts || '',
    score: r.score || '',
    term: r.term || '',
    nationalId: r.nationalId || '',
    studentId: r.nationalId || '',
    className: '',
    schools,
    batchId,
    createdAt,
  }));

  const count = await db().bulkCreate(COLLECTIONS.RESULTS_HISTORY, records);
  await db().set(COLLECTIONS.RESULT_BATCHES, batchId, {
    label: label || 'دفعة نتائج',
    schools,
    count,
    createdAt,
    createdBy: session.nationalId || '',
  });
  await logEvent('history.import', `استيراد دفعة نتائج: ${label} (${count} سجلاً)`, { targetType: 'batch', targetId: batchId });
  return { success: true, count, batchId };
}

/** حذف دفعة كاملة (سجلاتها + بياناتها). */
export async function deleteBatch(batchId) {
  await db().removeWhere(COLLECTIONS.RESULTS_HISTORY, ['batchId', '==', batchId]);
  await db().remove(COLLECTIONS.RESULT_BATCHES, batchId);
  await logEvent('history.delete', 'حذف دفعة نتائج', { targetType: 'batch', targetId: batchId });
  return { success: true };
}

/**
 * بحث في السجلّ السابق برقم الهوية، مع اقتصار النتائج على مدارس المستخدم إن مُرّرت.
 * @param {string} nationalId
 * @param {string[]|null} schools مدارس المستخدم (null = بلا اقتصار — للمشرف العام)
 */
export async function searchHistoryByNationalId(nationalId, schools = null) {
  return searchHistory({ nationalId, schools });
}

/**
 * بحث في السجل السابق بالاسم (جزء منه) أو رقم الهوية، مقتصراً على مدارس المستخدم إن مُرّرت.
 * @param {{name?:string, nationalId?:string, schools?:string[]|null}} q
 */
export async function searchHistory({ name = '', nationalId = '', schools = null } = {}) {
  const nid = toLatinDigits(String(nationalId || '').trim());
  const nm = String(name || '').trim();
  let filters;
  if (nid) filters = [['nationalId', '==', nid]];
  else if (nm) filters = [['name', 'like', '%' + nm + '%']];
  else return [];
  let rows = await db().list(COLLECTIONS.RESULTS_HISTORY, { filters, limit: 300 });
  if (schools) {
    const set = new Set(schools);
    rows = rows.filter((r) => Array.isArray(r.schools) && r.schools.some((s) => set.has(s)));
  }
  return rows;
}
