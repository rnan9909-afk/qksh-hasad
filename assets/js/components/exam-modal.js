/**
 * exam-modal.js — نافذة تقييم مشتركة (اختبار داخلي + نهائي)
 * ------------------------------------------------------------------
 * مكوّن واحد قابل لإعادة الاستخدام يستعمله المعلم (الاختبار الداخلي)
 * ومشرف الاختبارات (النهائي) بنفس نموذج التقييم تماماً. يعتمد على
 * EvaluationEngine ويُعيد النتيجة عبر callback عند الاعتماد.
 *
 * الاستخدام:
 *   openExamModal(student, { mode:'internal'|'final', levels, onApprove })
 *   onApprove(result) حيث result = { score, distinction, details }
 */

import { EvaluationEngine } from '../engine/evaluation.engine.js';
import { getArabicOrdinal, escapeHtml, partsCount } from '../core/helpers.js';
import * as toast from '../core/toast.js';

let root = null;
let engine = new EvaluationEngine();
let currentOnApprove = null;
let currentStudent = null;

/** إنشاء حاوية النافذة مرة واحدة. */
function ensureRoot() {
  if (root) return;
  root = document.createElement('div');
  root.id = 'examModalRoot';
  root.className = 'hidden-area';
  root.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.5);display:flex;align-items:stretch;justify-content:center;overflow:auto;';
  root.innerHTML = `
    <div style="background:#fff;width:100%;max-width:100%;min-height:100%;display:flex;flex-direction:column;">
      <div class="flex items-center justify-between p-6 border-b border-slate-100 bg-white shrink-0">
        <div class="flex items-center gap-4">
          <div class="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><span class="material-symbols-outlined text-3xl">person</span></div>
          <div class="flex flex-col">
            <h2 id="em_name" class="text-xl font-bold text-slate-900 leading-tight">...</h2>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span id="em_mode" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"></span>
              <span id="em_level" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"></span>
              <span id="em_parts" class="text-sm text-slate-500"></span>
            </div>
          </div>
        </div>
        <button type="button" id="em_close" class="text-slate-400 hover:text-slate-600 p-2"><span class="material-symbols-outlined text-2xl">close</span></button>
      </div>
      <div class="p-6 space-y-8 bg-slate-50 overflow-y-auto flex-1">
        <div class="flex justify-between items-center"><span id="em_qcount" class="badge bg-secondary text-white px-3 py-1 rounded-full text-sm"></span></div>
        <div id="em_questions" class="space-y-4"></div>
        <div class="flex flex-col md:flex-row gap-6 w-full">
          <div id="em_tajweedCol" class="flex-1 bg-white rounded-[20px] p-5 border border-slate-100 flex flex-col items-center gap-4">
            <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[#1E4D2B]">menu_book</span><h3 class="text-[15px] font-bold">أحكام التجويد (نظري)</h3></div>
            <div id="em_tajweed" class="flex flex-row-reverse flex-wrap justify-center gap-2 w-full"></div>
          </div>
          <div id="em_committeeCol" class="flex-1 bg-white rounded-[20px] p-5 border border-slate-100 flex flex-col items-center gap-4 hidden-area">
            <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[#1E4D2B]">speed</span><h3 class="text-[15px] font-bold">تقييم الأداء العام</h3></div>
            <div id="em_committee" class="flex flex-row-reverse flex-wrap justify-center gap-2 w-full"></div>
          </div>
        </div>
        <div class="bg-white rounded-[20px] p-5 border border-slate-100">
          <div class="flex items-center gap-2 mb-4"><span class="material-symbols-outlined text-[#1E4D2B]">thumb_up</span><h3 class="text-[15px] font-bold">جوانب التميز</h3></div>
          <div class="flex flex-wrap gap-3">
            ${['حسن الصوت', 'قوة الأداء', 'صغر السن'].map((v) => `
              <label class="eval-choice cursor-pointer"><input type="checkbox" class="em-dist peer" value="${v}" />
              <div class="px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-slate-600 peer-checked:bg-[#1E4D2B]/10 peer-checked:text-[#1E4D2B] peer-checked:border-[#1E4D2B] text-sm font-bold">${v}</div></label>`).join('')}
            <label class="eval-choice cursor-pointer"><input type="checkbox" id="em_distOther" class="em-dist peer" value="أخرى" />
              <div class="px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-slate-600 peer-checked:bg-[#1E4D2B]/10 peer-checked:text-[#1E4D2B] peer-checked:border-[#1E4D2B] text-sm font-bold">أخرى</div></label>
          </div>
          <input type="text" id="em_distOtherText" class="hidden-area field-input mt-3" placeholder="ملاحظات..." />
        </div>
      </div>
      <div class="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-[13px] font-bold text-slate-400">النتيجة النهائية</span>
          <div class="bg-[#10b981] text-white px-4 py-1.5 rounded-full font-bold text-lg" id="em_score">100</div>
        </div>
        <button id="em_approve" class="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 text-[15px]">
          <span id="em_approveLabel">اعتماد النتيجة</span> <span class="material-symbols-outlined text-[18px]">verified</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(root);

  root.querySelector('#em_close').addEventListener('click', close);
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
}

function close() { root.classList.add('hidden-area'); }

/** فتح النافذة. */
export function openExamModal(student, { mode = 'internal', levels = [], onApprove } = {}) {
  ensureRoot();
  currentStudent = student;
  currentOnApprove = onApprove;

  root.querySelector('#em_name').textContent = student.name;
  root.querySelector('#em_level').textContent = student.examLevel;
  root.querySelector('#em_parts').textContent = partsCount(student.parts) || '';
  const modeEl = root.querySelector('#em_mode');
  modeEl.textContent = mode === 'internal' ? 'اختبار داخلي' : 'اختبار نهائي';
  modeEl.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ' +
    (mode === 'internal' ? 'bg-lime-100 text-lime-700' : 'bg-emerald-100 text-emerald-700');
  root.querySelector('#em_approveLabel').textContent = mode === 'internal' ? 'اعتماد الاختبار الداخلي' : 'اعتماد النتيجة النهائية';

  const lvl = levels.find((x) => x.level == student.examLevel);
  const qCount = lvl ? lvl.questionCount || 5 : 5;
  engine.configure(student.examLevel, qCount);
  root.querySelector('#em_qcount').textContent = engine.settings.qCount + ' أسئلة';

  renderQuestions();
  renderTajweed();
  renderCommittee();
  root.querySelectorAll('.em-dist').forEach((c) => (c.checked = false));
  root.querySelector('#em_distOtherText').classList.add('hidden-area');
  root.querySelector('#em_distOtherText').value = '';

  updateScore();
  root.classList.remove('hidden-area');
}

function renderQuestions() {
  const c = root.querySelector('#em_questions');
  let html = '';
  for (let i = 0; i < engine.settings.qCount; i++) {
    html += `<div class="bg-white rounded-[20px] p-5 mb-4 border border-slate-100" id="em_qcard_${i}">
      <div class="flex items-center justify-end mb-5 gap-2"><span class="font-bold text-[15px]">السؤال ${getArabicOrdinal(i + 1)}</span><div class="w-3 h-3 rounded-full bg-[#1E4D2B]"></div></div>
      <div class="flex flex-row flex-wrap items-center justify-between gap-3">
        ${counter(i, 'talqin', 'تلقين', 'text-[#1E4D2B]')}
        ${counter(i, 'tanbih', 'تنبيه', 'text-amber-600')}
        ${counter(i, 'tajweed', 'تجويد', 'text-red-600')}
      </div></div>`;
  }
  c.innerHTML = html;
}

function counter(i, type, label, color) {
  const plus = type === 'tajweed' ? 'em-tajweed-plus' : '';
  return `<div class="flex flex-col items-center flex-1 min-w-[30%]">
    <span class="text-[12px] font-bold ${color} mb-2.5">${label}</span>
    <div class="flex items-center justify-between bg-[#f8fafc] rounded-full px-3 py-1.5 w-full border border-[#f1f5f9]">
      <button class="${plus} w-8 h-8 rounded-full text-slate-400 hover:bg-slate-200 font-bold text-lg" id="em_plus_${type}_${i}" data-c data-i="${i}" data-t="${type}" data-d="1">+</button>
      <span class="font-bold text-[17px] w-6 text-center" id="em_v_${i}_${type}">0</span>
      <button class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-200 font-bold text-lg" data-c data-i="${i}" data-t="${type}" data-d="-1">–</button>
    </div></div>`;
}

function renderTajweed() {
  const col = root.querySelector('#em_tajweedCol');
  const c = root.querySelector('#em_tajweed');
  c.innerHTML = '';
  if (!engine.settings.hasTheory) { col.style.opacity = '0.5'; col.style.pointerEvents = 'none'; return; }
  col.style.opacity = '1'; col.style.pointerEvents = 'auto';
  for (let i = 0; i <= 5; i++) {
    c.innerHTML += `<label class="eval-choice cursor-pointer flex-1 min-w-[45px] max-w-[60px]"><input class="peer" type="radio" name="em_tajweed" value="${i}" data-tajweed /><div class="eval-score-btn">${i}</div></label>`;
  }
}

function renderCommittee() {
  const col = root.querySelector('#em_committeeCol');
  const c = root.querySelector('#em_committee');
  c.innerHTML = '';
  if (!engine.settings.isItqan) { col.classList.add('hidden-area'); return; }
  col.classList.remove('hidden-area');
  for (let i = 0; i <= 5; i++) {
    c.innerHTML += `<label class="eval-choice cursor-pointer flex-1 min-w-[45px] max-w-[60px]"><input class="peer" type="radio" name="em_committee" value="${i}" data-committee /><div class="eval-score-btn">${i}</div></label>`;
  }
}

function onClick(e) {
  const cnt = e.target.closest('[data-c]');
  if (cnt) {
    const i = Number(cnt.dataset.i), t = cnt.dataset.t, d = Number(cnt.dataset.d);
    if (engine.changeCount(i, t, d)) {
      root.querySelector(`#em_v_${i}_${t}`).textContent = engine.state.questions[i][t];
      updateLocks();
      updateScore();
    }
    return;
  }
  if (e.target.closest('#em_approve')) approve();
}

function onChange(e) {
  const t = e.target;
  if (t.hasAttribute('data-tajweed')) { engine.setTajweedTheory(t.value); updateScore(); }
  else if (t.hasAttribute('data-committee')) { engine.setCommittee(t.value); updateScore(); }
  else if (t.id === 'em_distOther') {
    root.querySelector('#em_distOtherText').classList.toggle('hidden-area', !t.checked);
  }
}

function updateLocks() {
  engine.state.questions.forEach((q, i) => {
    const burned = engine.isQuestionBurned(i);
    const bt = root.querySelector(`#em_plus_talqin_${i}`);
    const bn = root.querySelector(`#em_plus_tanbih_${i}`);
    const card = root.querySelector(`#em_qcard_${i}`);
    if (bt) bt.disabled = burned;
    if (bn) bn.disabled = burned;
    if (card) {
      card.classList.toggle('bg-red-50', burned);
      card.classList.toggle('border-red-200', burned);
    }
  });
  const locked = engine.isTajweedLocked();
  root.querySelectorAll('.em-tajweed-plus').forEach((b) => (b.disabled = locked));
}

function updateScore() {
  const { final, isAutoFail } = engine.compute();
  const el = root.querySelector('#em_score');
  if (isAutoFail) {
    el.textContent = 'غير مجتاز';
    el.classList.remove('bg-[#10b981]', 'text-lg'); el.classList.add('bg-red-500', 'text-sm');
  } else {
    el.textContent = final;
    el.classList.add('bg-[#10b981]', 'text-lg'); el.classList.remove('bg-red-500', 'text-sm');
  }
}

async function approve() {
  const scoreText = root.querySelector('#em_score').textContent;
  const score = scoreText === 'غير مجتاز' ? 'راسب' : scoreText;

  const dist = [];
  root.querySelectorAll('.em-dist:checked').forEach((c) => { if (c.value !== 'أخرى') dist.push(c.value); });
  if (root.querySelector('#em_distOther').checked) {
    const o = root.querySelector('#em_distOtherText').value;
    if (o) dist.push('أخرى: ' + o);
  }

  const ok = await toast.confirm('اعتماد النتيجة: ' + score, 'لا يمكن التعديل بعد الاعتماد إلا بإعادة فتح الاختبار.', { confirmText: 'نعم، اعتماد' });
  if (!ok) return;

  const result = {
    score,
    distinction: dist.join('، '),
    details: JSON.parse(JSON.stringify({ questions: engine.state.questions, tajweedTheory: engine.state.tajweedTheory, committeeScore: engine.state.committeeScore, settings: engine.settings })),
  };
  close();
  if (currentOnApprove) await currentOnApprove(result);
}
