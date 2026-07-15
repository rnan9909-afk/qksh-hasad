/**
 * certificate-template.service.js — قالب الشهادة القابل للتخصيص
 * ------------------------------------------------------------------
 * يحفظ: صورة الخلفية (base64)، النصوص القابلة للتعديل (مع متغيّرات مثل
 * {{الاسم}})، صورتَي توقيع الرئيس والختم ومواقعهما، والعام الدراسي.
 * يستخدمه محرّر الشهادة (المشرف العام) ومولّد الشهادة عند الطباعة.
 */

import { db } from '../data/index.js';
import { COLLECTIONS } from '../config.js';
import { logEvent } from './audit.service.js';

const TEMPLATE_ID = 'default';

/**
 * الحقول النصّية الافتراضية (كل حقل نصّ قابل للتعديل قد يحوي متغيّرات).
 * المتغيّرات المتاحة: {{الاسم}} {{المدرسة}} {{الجزء}} {{المستوى}}
 *                     {{الدرجة}} {{التقدير}} {{العام}} {{الهوية}} {{التاريخ}}
 */
export const DEFAULT_FIELDS = {
  assoc:     { text: 'تشهد الجمعية الخيرية لتحفيظ القرآن الكريم بمحافظة شرورة (بنات)', x: 561, y: 285, size: 24, color: '#1E4D2B', align: 'center', visible: true, label: 'جهة الإصدار' },
  student:   { text: 'بأن الطالب/ة : {{الاسم}}', x: 700, y: 330, size: 22, color: '#0d141b', align: 'center', visible: true, label: 'سطر الطالب' },
  school:    { text: 'من مجمع / مدرسة : {{المدرسة}}', x: 360, y: 330, size: 22, color: '#0d141b', align: 'center', visible: true, label: 'سطر المدرسة' },
  passline:  { text: 'قد اجتاز/ت حفظ: {{الجزء}} — مستوى {{المستوى}} — بنسبة: {{الدرجة}} — وتقدير {{التقدير}}', x: 561, y: 382, size: 20, color: '#0d141b', align: 'center', visible: true, label: 'سطر النتيجة' },
  year:      { text: 'خلال العام {{العام}}هـ', x: 561, y: 428, size: 22, color: '#1E4D2B', align: 'center', visible: true, label: 'العام الدراسي' },
  body:      { text: 'ولذا فإن الجمعية توصي بتقوى الله تعالى والمحافظة على ما تشرّف / ــت بحفظه من كتاب الله تعالى\nنسأل الله أن يجعله / ــا من أهل القرآن الذين هم أهل الله وخاصته..\nوصلى الله على سيدنا محمد وعلى آله وصحبه وسلم،،،', x: 561, y: 525, size: 20, color: '#334155', align: 'center', visible: true, label: 'نص الدعاء', maxWidth: 900, lineHeight: 42 },
  roleTitle: { text: 'رئيس قسم الشؤون التعليمية', x: 561, y: 635, size: 18, color: '#1E4D2B', align: 'center', visible: true, label: 'المسمّى الوظيفي' },
  roleName:  { text: 'علي هادي حملي', x: 561, y: 738, size: 18, color: '#0d141b', align: 'center', visible: true, label: 'اسم الموقّع' },
  nationalId:{ text: 'رقم الهوية: {{الهوية}}', x: 561, y: 458, size: 16, color: '#64748b', align: 'center', visible: false, label: 'رقم الهوية' },
  date:      { text: 'التاريخ: {{التاريخ}}', x: 250, y: 705, size: 16, color: '#64748b', align: 'center', visible: false, label: 'التاريخ' },
};

/** طبقات الصور (توقيع الرئيس + الختم). src تُملأ عند الرفع. */
export const DEFAULT_IMAGES = {
  signature: { src: '', x: 300, y: 690, width: 180, visible: true, label: 'توقيع الرئيس' },
  seal:      { src: '', x: 620, y: 700, width: 150, visible: true, label: 'الختم' },
};

export const DEFAULT_ACADEMIC_YEAR = '1447 / 1448';

/** جلب قالب الشهادة (أو الافتراضي). */
export async function getTemplate() {
  const doc = await db().get(COLLECTIONS.CERT_TEMPLATE, TEMPLATE_ID);
  if (!doc) {
    return {
      id: TEMPLATE_ID, imageData: '', width: 1123, height: 794,
      fields: clone(DEFAULT_FIELDS), images: clone(DEFAULT_IMAGES), academicYear: DEFAULT_ACADEMIC_YEAR,
    };
  }
  // الحقول: نبدأ من الافتراضي، ثم ندمج الحقول المحفوظة ذات الشكل الجديد فقط (نتجاهل القديمة)
  const fields = clone(DEFAULT_FIELDS);
  for (const [k, v] of Object.entries(doc.fields || {})) {
    if (v && typeof v === 'object' && 'text' in v) fields[k] = { ...(fields[k] || {}), ...v };
  }
  // الصور
  const images = clone(DEFAULT_IMAGES);
  for (const [k, v] of Object.entries(doc.images || {})) {
    if (v && typeof v === 'object') images[k] = { ...(images[k] || {}), ...v };
  }
  return {
    id: TEMPLATE_ID,
    imageData: doc.imageData || '',
    width: doc.width || 1123,
    height: doc.height || 794,
    fields,
    images,
    academicYear: doc.academicYear || DEFAULT_ACADEMIC_YEAR,
  };
}

/** حفظ قالب الشهادة كاملاً. */
export async function saveTemplate({ imageData, width, height, fields, images, academicYear }) {
  await db().set(COLLECTIONS.CERT_TEMPLATE, TEMPLATE_ID, {
    imageData: imageData || '',
    width: width || 1123,
    height: height || 794,
    fields: fields || clone(DEFAULT_FIELDS),
    images: images || clone(DEFAULT_IMAGES),
    academicYear: academicYear || DEFAULT_ACADEMIC_YEAR,
  });
  await logEvent('certificate.template.save', 'حفظ/تعديل قالب الشهادة', { targetType: 'template', targetId: TEMPLATE_ID });
  return { success: true };
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }
