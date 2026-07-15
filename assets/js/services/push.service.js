/**
 * push.service.js — إشعارات الدفع (Web Push)
 * ------------------------------------------------------------------
 * - enablePush(): يطلب الإذن ويشترك ويحفظ الاشتراك مع دور المستخدم ومدرسته.
 * - notify(payload): يستدعي دالة Supabase لإرسال إشعار للحسابات المستهدفة.
 * - initPush(session): يُحدّث الاشتراك تلقائياً إن كان الإذن ممنوحاً، وإلا يُظهر زر تفعيل.
 */

import { db } from '../data/index.js';
import { COLLECTIONS, CONFIG } from '../config.js';
import { SUPABASE_CONFIG } from '../supabase-config.js';
import { getSession } from '../core/session.js';

const supported = () => ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);

function urlB64ToUint8(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function saveSubscription(sub) {
  const s = getSession() || {};
  const j = sub.toJSON();
  await db().set(COLLECTIONS.PUSH_SUBS, sub.endpoint, {
    endpoint: sub.endpoint,
    userId: s.nationalId || '',
    role: s.role || '',
    schoolId: s.schoolId || '',
    schools: Array.isArray(s.schools) ? s.schools : [],
    p256dh: j.keys ? j.keys.p256dh : '',
    auth: j.keys ? j.keys.auth : '',
    createdAt: new Date().toISOString(),
  });
}

/** طلب الإذن والاشتراك وحفظه. */
export async function enablePush() {
  if (!supported()) return { ok: false, reason: 'unsupported' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8(CONFIG.PUSH.VAPID_PUBLIC),
    });
  }
  await saveSubscription(sub);
  return { ok: true };
}

/** تهيئة الإشعارات بعد الدخول: تحديث الاشتراك أو إظهار زر التفعيل. */
export async function initPush() {
  if (!supported()) return;
  try {
    if (Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await saveSubscription(sub); // تحديث الدور/المدرسة للجلسة الحالية
      else await enablePush();
    } else if (Notification.permission === 'default') {
      showEnableButton();
    }
  } catch { /* تجاهل */ }
}

function showEnableButton() {
  if (document.getElementById('pushEnableBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'pushEnableBtn';
  btn.type = 'button';
  btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;">notifications_active</span> تفعيل إشعارات الاختبارات';
  btn.style.cssText = [
    'position:fixed', 'bottom:16px', 'inset-inline-end:16px', 'z-index:9998',
    'background:linear-gradient(135deg,#256137,#1E4D2B)', 'color:#fff', 'border:none',
    'border-radius:9999px', 'padding:.6rem 1.1rem', 'font-weight:700', 'font-family:inherit',
    'font-size:.85rem', 'display:flex', 'align-items:center', 'gap:.4rem',
    'box-shadow:0 8px 22px -8px rgba(30,77,43,.6)', 'cursor:pointer',
  ].join(';');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const r = await enablePush();
    btn.remove();
    if (r.ok && window.Swal) window.Swal.fire({ icon: 'success', title: 'تم التفعيل', text: 'ستصلك إشعارات الاختبارات على هذا الجهاز.', confirmButtonColor: '#1E4D2B' });
  });
  document.body.appendChild(btn);
}

/** إرسال إشعار للحسابات المستهدفة عبر دالة Supabase. */
export async function notify({ title, body, url = '/', roles = [], userIds = [], schoolId = '' }) {
  try {
    await fetch(CONFIG.PUSH.FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: 'Bearer ' + SUPABASE_CONFIG.anonKey,
      },
      body: JSON.stringify({ title, body, url, roles, userIds, schoolId }),
    });
  } catch { /* الإشعار غير حرج — لا نُفشل العملية */ }
}
