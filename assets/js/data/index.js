/**
 * data/index.js — نقطة الدخول الوحيدة لطبقة البيانات
 * ------------------------------------------------------------------
 * يختار المُحوِّل النشط بناءً على CONFIG.DATA_PROVIDER ويُهيّئه مرة واحدة.
 * كل الخدمات تستورد db من هنا فقط.
 *
 * لإضافة Supabase مستقبلاً:
 *   1) أنشئ supabase.adapter.js يطبّق DataAdapter.
 *   2) أضف الحالة 'supabase' في createAdapter أدناه.
 *   3) اجعل CONFIG.DATA_PROVIDER = 'supabase'.
 * لن تحتاج لتعديل أي خدمة أو صفحة.
 */

import { CONFIG } from '../config.js';
import { MockAdapter } from './mock.adapter.js';

let _adapter = null;
let _initPromise = null;

async function createAdapter() {
  switch (CONFIG.DATA_PROVIDER) {
    case 'firebase': {
      const { FirebaseAdapter } = await import('./firebase.adapter.js');
      return new FirebaseAdapter();
    }
    case 'supabase': {
      const { SupabaseAdapter } = await import('./supabase.adapter.js');
      return new SupabaseAdapter();
    }
    case 'mock':
    default:
      return new MockAdapter();
  }
}

/**
 * تهيئة طبقة البيانات (تُستدعى مرة واحدة عند إقلاع التطبيق).
 * @returns {Promise<DataAdapter>}
 */
export async function initData() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    _adapter = await createAdapter();
    await _adapter.init();
    return _adapter;
  })();
  return _initPromise;
}

/** الوصول للمُحوِّل النشط بعد التهيئة. */
export function db() {
  if (!_adapter) {
    throw new Error('طبقة البيانات لم تُهيّأ بعد. استدعِ initData() أولاً.');
  }
  return _adapter;
}
