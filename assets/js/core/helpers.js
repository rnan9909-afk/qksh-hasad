/**
 * helpers.js — دوال مساعدة عامة قابلة لإعادة الاستخدام
 */

/** تطبيع النص العربي للبحث (يطابق منطق النظام الأصلي حرفياً). */
export function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ٟـ]/g, '')
    .replace(/[​-‏‪-‮]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** تحويل الأرقام العربية الهندية إلى لاتينية. */
export function toLatinDigits(str) {
  return String(str).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

/** مطابقة "كل الكلمات" — يستخدمها كل مربعات البحث. */
export function matchesAllTerms(haystack, query) {
  const n = normalizeArabic(haystack);
  const terms = normalizeArabic(query).split(' ').filter(Boolean);
  return terms.every((t) => n.includes(t));
}

/** debounce كلاسيكي. */
export function debounce(fn, wait = 400) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** توليد معرّف فريد (يقابل new Date().getTime() في النظام القديم). */
export function generateId() {
  return String(Date.now());
}

/** تنسيق تاريخ إلى YYYY-MM-DD. */
export function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** تاريخ اليوم بصيغة YYYY-MM-DD. */
export function today() {
  return new Date().toISOString().split('T')[0];
}

/** هل القيمة "لها درجة" فعلاً؟ (يطابق فحوص النظام القديم). */
export function hasValue(v) {
  return v !== '' && v !== null && v !== undefined;
}

/** الترتيب العربي (السؤال الأول، الثاني...). */
const ARABIC_ORDINALS = [
  '', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن',
  'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر',
  'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون', 'الحادي والعشرون',
  'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون',
  'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون',
];
export function getArabicOrdinal(n) {
  return ARABIC_ORDINALS[n] || String(n);
}

/** تهريب HTML لمنع الحقن عند بناء القوالب. */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** تصنيف التقدير النصي من الدرجة ودرجة النجاح. */
export function gradeText(score, passingScore) {
  const s = Number(score);
  if (s < passingScore) return 'لم يجتز';
  if (s >= 90) return 'ممتاز';
  if (s >= 80) return 'جيد جداً';
  if (s >= 70) return 'جيد';
  return 'مقبول';
}

/** هل المستوى من نوع "الإتقان"؟ */
export function isItqanLevel(level) {
  const s = String(level);
  return s.indexOf('إتقان') > -1 || s.indexOf('الإتقان') > -1;
}

/**
 * تحويل قيمة "الأجزاء" إلى عدد فقط (رقم واحد) — يُعتمد في كل النظام.
 * يقبل: عدداً جاهزاً، أو نطاقاً "1 - 30"، أو قائمة "26، 27، 28"، ويُرجع العدد.
 */
export function partsCount(parts) {
  if (parts == null || parts === '') return '';
  const s = String(parts).trim();
  if (/^\d+$/.test(s)) return s;                          // عدد جاهز
  const range = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);         // نطاق a - b
  if (range) return String(Math.abs(+range[2] - +range[1]) + 1);
  const items = s.split(/[،,]/).map((x) => x.trim()).filter(Boolean);
  if (items.length > 1) return String(items.length);      // قائمة أرقام
  return s;                                                // نص وصفي (يُترك كما هو)
}
