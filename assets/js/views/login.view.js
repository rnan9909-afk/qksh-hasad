/**
 * login.view.js — منطق شاشة الدخول
 */

import { CONFIG } from '../config.js';
import { initData } from '../data/index.js';
import { login } from '../core/auth.js';
import { goDashboard, redirectIfAuthenticated } from '../core/router.js';
import { byId } from '../core/ui.js';
import { digitsOnly } from '../core/validation.js';
import * as toast from '../core/toast.js';

async function boot() {
  // العلامة التجارية
  byId('brandLogo').src = CONFIG.LOGO_URL;
  // العنوان بدون بادئة «حَصَاد —»، وبلا سطر وصفي
  byId('brandTitle').textContent = 'نظام سجل الاختبارات';
  const tag = byId('brandTagline');
  if (tag) tag.remove();

  // إن كان مسجّلاً بالفعل، انتقل للوحة
  if (redirectIfAuthenticated()) return;

  await initData();

  const input = byId('nationalIdInput');
  const btn = byId('loginBtn');

  input.addEventListener('input', () => {
    input.value = digitsOnly(input.value, 10);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attempt();
  });
  btn.addEventListener('click', attempt);

  input.focus();
}

async function attempt() {
  const input = byId('nationalIdInput');
  const id = input.value.trim();
  if (!id) {
    toast.warning('تنبيه', 'الرجاء إدخال رقم الهوية');
    return;
  }

  toast.showLoading('جاري التحقق...');
  try {
    const res = await login(id);
    toast.close();
    if (res.success) {
      goDashboard();
    } else {
      toast.info('تعذّر الدخول', res.message);
    }
  } catch (err) {
    toast.close();
    toast.error('خطأ في الاتصال', err.message);
  }
}

boot();
