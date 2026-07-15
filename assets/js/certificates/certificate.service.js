/**
 * certificate.service.js — توليد شهادة PDF من قالب قابل للتخصيص
 * ------------------------------------------------------------------
 * يرسم صورة القالب (المرفوعة من محرّر الشهادة) على canvas، ثم يضع كل
 * حقل نصّي في موقعه المحفوظ (x,y,size,color,align)، ثم يصدّر PDF.
 * إن لم يوجد قالب مرفوع، يرسم تصميماً افتراضياً أنيقاً.
 *
 * الرسم على canvas يدعم العربية تلقائياً (المتصفح يُشكّل النص).
 */

import { getTemplate } from '../services/certificate-template.service.js';
import { isItqanLevel, gradeText, today } from '../core/helpers.js';
import { CONFIG } from '../config.js';

const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';
let _jsPDF = null;
async function loadJsPDF() {
  if (_jsPDF) return _jsPDF;
  const mod = await import(JSPDF_URL);
  _jsPDF = mod.jsPDF || mod.default;
  return _jsPDF;
}

/**
 * القيم المتاحة للمتغيّرات {{...}} في نصوص الشهادة.
 * @param {object} data { name, nationalId, score, level, school, parts, dateStr? }
 * @param {object} tpl القالب (لأخذ العام الدراسي)
 */
export function buildValues(data, tpl = {}) {
  const dateStr = data.dateStr || today();
  return {
    'الاسم': data.name || '',
    'المدرسة': data.school || '',
    'الجزء': data.parts || '',
    'المستوى': data.level || '',
    'الدرجة': data.score || '',
    'التقدير': computeGrade(data.score, data.level) || '',
    'العام': tpl.academicYear || '',
    'الهوية': data.nationalId || '',
    'التاريخ': dateStr,
  };
}

/** استبدال المتغيّرات {{المفتاح}} بقيمها. */
export function applyPlaceholders(text, values) {
  return String(text || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, key) => {
    const v = values[key.trim()];
    return v != null ? v : '';
  });
}

/**
 * يبني canvas الشهادة (خلفية + نصوص + توقيع + ختم).
 * @param {object} data { name, nationalId, score, level, school, parts, dateStr? }
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderCertificateCanvas(data) {
  const tpl = await getTemplate();
  const W = tpl.width || 1123;
  const H = tpl.height || 794;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.direction = 'rtl';

  // 1) الخلفية: صورة القالب أو تصميم افتراضي
  if (tpl.imageData) {
    await drawImage(ctx, tpl.imageData, W, H);
  } else {
    drawDefaultBackground(ctx, W, H);
  }

  const values = buildValues(data, tpl);

  // ضمان تحميل الخط قبل الرسم
  try { await document.fonts.ready; } catch {}

  // 2) الصور (توقيع الرئيس + الختم) — تُرسم قبل النص كي لا تغطّيه
  for (const im of Object.values(tpl.images || {})) {
    if (!im || !im.visible || !im.src) continue;
    await drawImageContain(ctx, im.src, im.x, im.y, im.width);
  }

  // 3) النصوص القابلة للتعديل (مع استبدال المتغيّرات)
  for (const f of Object.values(tpl.fields)) {
    if (!f.visible) continue;
    const text = applyPlaceholders(f.text || '', values);
    if (!text.trim()) continue;
    ctx.font = `bold ${f.size}px Thmanyah, Cairo, sans-serif`;
    ctx.fillStyle = f.color || '#000';
    ctx.textAlign = f.align || 'center';
    ctx.textBaseline = 'middle';
    drawMultiline(ctx, text, f.x, f.y, f.size, f.maxWidth, f.lineHeight);
  }

  return canvas;
}

/** لفّ فقرة إلى أسطر ضمن عرض أقصى (اختياري). */
function wrapParagraph(ctx, text, maxWidth) {
  if (!maxWidth) return [text];
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** رسم نصّ متعدّد الأسطر (يفصل عند \n ويلفّ حسب maxWidth) متمركزاً عمودياً حول y. */
function drawMultiline(ctx, text, x, y, size, maxWidth, lineHeight) {
  const lh = lineHeight || Math.round(size * 1.6);
  const paras = String(text).split('\n');
  let lines = [];
  for (const p of paras) lines = lines.concat(wrapParagraph(ctx, p, maxWidth));
  const totalH = (lines.length - 1) * lh;
  let cy = y - totalH / 2;
  for (const ln of lines) { ctx.fillText(ln, x, cy); cy += lh; }
}

/** رسم صورة (توقيع/ختم) متمركزة على (cx,cy) بعرض محدّد مع الحفاظ على النسبة. */
function drawImageContain(ctx, src, cx, cy, width) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = width || img.naturalWidth || 150;
      const ratio = (img.naturalHeight && img.naturalWidth) ? img.naturalHeight / img.naturalWidth : 0.5;
      const h = w * ratio;
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

/** توليد PDF وإرجاع jsPDF doc. */
export async function generateCertificate(data) {
  const jsPDF = await loadJsPDF();
  const canvas = await renderCertificateCanvas(data);
  const img = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(img, 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf;
}

/** توليد وتنزيل الشهادة. */
export async function downloadCertificate(data) {
  const pdf = await generateCertificate(data);
  const safe = String(data.name || 'شهادة').replace(/[\\/:*?"<>|]/g, '_');
  pdf.save(`شهادة - ${safe}.pdf`);
}

/** توليد وفتح الشهادة في تبويب جديد. */
export async function openCertificate(data) {
  const pdf = await generateCertificate(data);
  window.open(pdf.output('bloburl'), '_blank');
}

/* ----------------------------- مساعدات ----------------------------- */

function drawImage(ctx, src, W, H) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { ctx.drawImage(img, 0, 0, W, H); resolve(); };
    img.onerror = () => { drawDefaultBackground(ctx, W, H); resolve(); };
    img.src = src;
  });
}

function drawDefaultBackground(ctx, W, H) {
  // خلفية متدرّجة + إطار
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#f6fbfc');
  g.addColorStop(1, '#eef6f7');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#1E4D2B';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, W - 18, H - 18);
  ctx.strokeStyle = '#b8d0bd';
  ctx.lineWidth = 2;
  ctx.strokeRect(34, 34, W - 68, H - 68);

  ctx.fillStyle = '#1E4D2B';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 46px Thmanyah, Cairo, sans-serif';
  ctx.fillText('شهادة اجتياز', W / 2, 120);
  ctx.fillStyle = '#64748b';
  ctx.font = '20px Thmanyah, Cairo, sans-serif';
  ctx.fillText(CONFIG.APP_NAME, W / 2, 170);
  ctx.fillStyle = '#334155';
  ctx.font = '22px Thmanyah, Cairo, sans-serif';
  ctx.fillText('تشهد اللجنة بأن الطالب/ة', W / 2, 250);
}

/** حساب التقدير (يُستخدم اختيارياً في العرض). */
export function computeGrade(score, level) {
  const passing = isItqanLevel(level) ? CONFIG.PASS_SCORE_ITQAN : CONFIG.PASS_SCORE_NORMAL;
  return gradeText(score, passing);
}
