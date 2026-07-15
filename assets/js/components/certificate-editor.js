/**
 * certificate-editor.js — محرّر قالب الشهادة (سحب وإفلات مرئي)
 * ------------------------------------------------------------------
 * - رفع صورة خلفية الشهادة.
 * - تعديل نصوص الشهادة (مع متغيّرات مثل {{الاسم}}) وسحبها لضبط موضعها.
 * - رفع صورة توقيع الرئيس والختم ووضعهما بالسحب مع ضبط الحجم.
 * - ضبط العام الدراسي. (للمشرف العام)
 */

import { getTemplate, saveTemplate } from '../services/certificate-template.service.js';
import { openCertificate, applyPlaceholders, buildValues } from '../certificates/certificate.service.js';
import { escapeHtml } from '../core/helpers.js';
import * as toast from '../core/toast.js';

const SAMPLE = { name: 'عزيزة خالد محمد النسي', nationalId: '1234567890', score: '95', level: '8 — ختمة ربع يس', school: 'مريم بنت عمران مسائي', parts: '23، 24، 25، 26، 27' };

const PLACEHOLDERS = ['{{الاسم}}', '{{المدرسة}}', '{{الجزء}}', '{{المستوى}}', '{{الدرجة}}', '{{التقدير}}', '{{العام}}', '{{الهوية}}', '{{التاريخ}}'];

let tpl = null;
let container = null;
let displayW = 700;

/** تركيب المحرّر داخل عنصر. */
export async function mountCertificateEditor(el) {
  container = el;
  tpl = await getTemplate();
  render();
}

function scale() { return displayW / tpl.width; }
function sampleValues() { return buildValues(SAMPLE, tpl); }

function render() {
  const displayH = displayW * (tpl.height / tpl.width);
  const values = sampleValues();
  container.innerHTML = `
    <div class="flex flex-col lg:flex-row gap-6">
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 class="font-bold text-slate-700 flex items-center gap-2"><span class="material-symbols-outlined">wallpaper</span> معاينة الشهادة</h3>
          <label class="btn-primary px-3 py-2 text-sm cursor-pointer flex items-center gap-1">
            <span class="material-symbols-outlined text-[18px]">upload</span> رفع خلفية الشهادة
            <input type="file" id="ce_file" accept="image/*" class="hidden" />
          </label>
        </div>
        <div id="ce_stage" style="position:relative;width:${displayW}px;max-width:100%;height:${displayH}px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:${tpl.imageData ? `url('${tpl.imageData}') center/cover` : 'linear-gradient(135deg,#f6fbfc,#eef6f7)'};touch-action:none;">
          ${!tpl.imageData ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-weight:700;">لم تُرفع خلفية — سيُستخدم تصميم افتراضي</div>' : ''}
          ${Object.entries(tpl.fields).map(([k, f]) => fieldChip(k, f, values)).join('')}
          ${Object.entries(tpl.images).map(([k, im]) => imageChip(k, im)).join('')}
        </div>
        <p class="text-xs text-slate-400 mt-2">اسحب أي نصّ أو صورة (التوقيع/الختم) لتغيير موضعه على الشهادة.</p>
        <div class="mt-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2">
          المتغيّرات المتاحة داخل النصوص: ${PLACEHOLDERS.map((p) => `<code class="bg-white border border-slate-200 rounded px-1 mx-0.5">${escapeHtml(p)}</code>`).join(' ')}
        </div>
      </div>

      <div class="w-full lg:w-96 shrink-0">
        <h3 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><span class="material-symbols-outlined">tune</span> إعدادات الشهادة</h3>
        <label class="flex flex-col gap-1 text-sm font-bold mb-3">العام الدراسي (هـ)
          <input id="ce_year" class="field-input" value="${escapeHtml(tpl.academicYear || '')}" placeholder="1447 / 1448"></label>

        <div class="space-y-3 max-h-[440px] overflow-y-auto pr-1">
          <div class="text-xs font-bold text-primary flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">text_fields</span> النصوص</div>
          ${Object.entries(tpl.fields).map(([k, f]) => fieldControls(k, f)).join('')}

          <div class="text-xs font-bold text-primary flex items-center gap-1 pt-2"><span class="material-symbols-outlined text-[16px]">draw</span> التوقيع والختم</div>
          ${Object.entries(tpl.images).map(([k, im]) => imageControls(k, im)).join('')}
        </div>

        <div class="flex gap-2 mt-4">
          <button id="ce_save" class="btn-primary flex-1 py-2.5 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[18px]">save</span> حفظ</button>
          <button id="ce_preview" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[18px]">visibility</span> معاينة PDF</button>
        </div>
      </div>
    </div>`;

  bind();
}

/* --------------------------- عناصر المعاينة --------------------------- */

function fieldChip(key, f, values) {
  if (!f.visible) return '';
  const s = scale();
  const txt = applyPlaceholders(f.text || '', values).replace(/\n/g, ' ');
  const wrap = f.maxWidth
    ? `white-space:normal;max-width:${f.maxWidth * s}px;text-align:${f.align || 'center'};`
    : 'white-space:nowrap;';
  return `<div class="ce-chip" data-key="${key}" style="position:absolute;left:${f.x * s}px;top:${f.y * s}px;transform:translate(-50%,-50%);cursor:grab;user-select:none;${wrap}
    font-size:${Math.max(9, f.size * s)}px;color:${f.color};font-weight:700;line-height:1.5;background:rgba(30,77,43,.06);border:1px dashed rgba(30,77,43,.45);border-radius:6px;padding:2px 6px;">
    ${escapeHtml(txt || f.label)}
  </div>`;
}

function imageChip(key, im) {
  if (!im.visible) return '';
  const s = scale();
  const w = (im.width || 150) * s;
  const inner = im.src
    ? `<img src="${im.src}" style="width:100%;display:block;pointer-events:none;">`
    : `<div style="padding:10px 12px;color:#94a3b8;font-size:11px;font-weight:700;text-align:center;">${escapeHtml(im.label)}<br>(ارفع صورة)</div>`;
  return `<div class="ce-img" data-imgkey="${key}" style="position:absolute;left:${im.x * s}px;top:${im.y * s}px;transform:translate(-50%,-50%);width:${w}px;cursor:grab;user-select:none;border:1px dashed rgba(30,77,43,.4);border-radius:6px;background:rgba(255,255,255,.35);">${inner}</div>`;
}

/* --------------------------- لوحات التحكم --------------------------- */

function fieldControls(key, f) {
  const isBody = !!f.maxWidth;
  const textField = isBody
    ? `<textarea data-prop="text" rows="3" class="field-input !py-1.5 !px-2 text-sm w-full">${escapeHtml(f.text || '')}</textarea>`
    : `<input data-prop="text" value="${escapeHtml(f.text || '')}" class="field-input !py-1.5 !px-2 text-sm w-full">`;
  return `<div class="border border-slate-200 rounded-lg p-3" data-fkey="${key}">
    <div class="flex items-center justify-between mb-2">
      <span class="font-bold text-sm text-slate-700">${escapeHtml(f.label || key)}</span>
      <label class="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" data-prop="visible" ${f.visible ? 'checked' : ''}> إظهار</label>
    </div>
    <label class="flex flex-col gap-1 text-xs mb-2">النص${textField}</label>
    <div class="grid grid-cols-3 gap-2 items-end text-xs">
      <label class="flex flex-col gap-1">الحجم<input type="number" data-prop="size" value="${f.size}" class="field-input !py-1 !px-2 text-center"></label>
      <label class="flex flex-col gap-1">اللون<input type="color" data-prop="color" value="${f.color}" class="w-full h-8 rounded border border-slate-200"></label>
      <label class="flex flex-col gap-1">المحاذاة
        <select data-prop="align" class="field-select !py-1 !px-2">
          <option value="center" ${f.align === 'center' ? 'selected' : ''}>وسط</option>
          <option value="right" ${f.align === 'right' ? 'selected' : ''}>يمين</option>
          <option value="left" ${f.align === 'left' ? 'selected' : ''}>يسار</option>
        </select>
      </label>
    </div>
  </div>`;
}

function imageControls(key, im) {
  return `<div class="border border-slate-200 rounded-lg p-3" data-imgctrl="${key}">
    <div class="flex items-center justify-between mb-2">
      <span class="font-bold text-sm text-slate-700">${escapeHtml(im.label || key)}</span>
      <label class="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" data-improp="visible" ${im.visible ? 'checked' : ''}> إظهار</label>
    </div>
    <div class="flex items-center gap-2">
      <label class="btn-primary px-3 py-1.5 text-xs cursor-pointer flex items-center gap-1 shrink-0">
        <span class="material-symbols-outlined text-[16px]">upload</span> رفع صورة
        <input type="file" data-imgfile accept="image/*" class="hidden">
      </label>
      <label class="flex flex-col gap-1 text-xs flex-1">العرض (px)<input type="number" data-improp="width" value="${im.width}" class="field-input !py-1 !px-2 text-center"></label>
      ${im.src ? '<span class="material-symbols-outlined text-emerald-600" title="تم الرفع">check_circle</span>' : ''}
    </div>
  </div>`;
}

/* --------------------------- الربط والتفاعل --------------------------- */

function bind() {
  container.querySelector('#ce_file').addEventListener('change', onUploadBackground);
  container.querySelector('#ce_save').addEventListener('click', onSave);
  container.querySelector('#ce_preview').addEventListener('click', onPreview);
  container.querySelector('#ce_year').addEventListener('input', (e) => { tpl.academicYear = e.target.value; refreshStage(); });

  // تعديل خصائص النصوص
  container.querySelectorAll('[data-fkey]').forEach((box) => {
    const key = box.dataset.fkey;
    box.querySelectorAll('[data-prop]').forEach((input) => {
      input.addEventListener('input', () => {
        const prop = input.dataset.prop;
        let val = input.type === 'checkbox' ? input.checked : (input.type === 'number' ? Number(input.value) : input.value);
        tpl.fields[key][prop] = val;
        refreshStage();
      });
    });
  });

  // خصائص الصور (توقيع/ختم)
  container.querySelectorAll('[data-imgctrl]').forEach((box) => {
    const key = box.dataset.imgctrl;
    box.querySelectorAll('[data-improp]').forEach((input) => {
      input.addEventListener('input', () => {
        const prop = input.dataset.improp;
        let val = input.type === 'checkbox' ? input.checked : (input.type === 'number' ? Number(input.value) : input.value);
        tpl.images[key][prop] = val;
        refreshStage();
      });
    });
    const file = box.querySelector('[data-imgfile]');
    if (file) file.addEventListener('change', (e) => onUploadLayer(key, e));
  });

  enableDrag();
}

function refreshStage() {
  const stage = container.querySelector('#ce_stage');
  stage.querySelectorAll('.ce-chip, .ce-img').forEach((c) => c.remove());
  const values = sampleValues();
  Object.entries(tpl.fields).forEach(([k, f]) => { if (f.visible) stage.insertAdjacentHTML('beforeend', fieldChip(k, f, values)); });
  Object.entries(tpl.images).forEach(([k, im]) => { if (im.visible) stage.insertAdjacentHTML('beforeend', imageChip(k, im)); });
  enableDrag();
}

function enableDrag() {
  const stage = container.querySelector('#ce_stage');
  stage.querySelectorAll('.ce-chip, .ce-img').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const isImg = el.classList.contains('ce-img');
      const store = isImg ? tpl.images[el.dataset.imgkey] : tpl.fields[el.dataset.key];
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
      const rect = stage.getBoundingClientRect();
      const move = (ev) => {
        let px = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
        let py = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
        el.style.left = px + 'px';
        el.style.top = py + 'px';
        store.x = Math.round(px / scale());
        store.y = Math.round(py / scale());
      };
      const up = () => {
        el.style.cursor = 'grab';
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
  });
}

/* --------------------------- الرفع والحفظ --------------------------- */

function onUploadBackground(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      tpl.imageData = reader.result;
      tpl.width = img.naturalWidth || 1123;
      tpl.height = img.naturalHeight || 794;
      render();
      toast.toast('تم رفع الخلفية — لا تنسَ الحفظ', 'success', 1500);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function onUploadLayer(key, e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    tpl.images[key].src = reader.result;
    tpl.images[key].visible = true;
    render();
    toast.toast('تم رفع الصورة — لا تنسَ الحفظ', 'success', 1500);
  };
  reader.readAsDataURL(file);
}

async function onSave() {
  toast.showLoading('جاري حفظ القالب...');
  try {
    await saveTemplate(tpl);
    toast.close();
    toast.success('تم الحفظ', 'تم حفظ قالب الشهادة بنجاح.');
  } catch (err) {
    toast.close();
    toast.error('خطأ', err.message);
  }
}

async function onPreview() {
  toast.showLoading('جاري حفظ القالب وتجهيز المعاينة...');
  try {
    await saveTemplate(tpl); // نحفظ ثم نعاين لأن المولّد يقرأ القالب المحفوظ
    toast.close();
    await openCertificate(SAMPLE);
  } catch (err) {
    toast.close();
    toast.error('خطأ', err.message);
  }
}
