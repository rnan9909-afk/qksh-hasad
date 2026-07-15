/**
 * notify-center.js — مركز الإشعارات (جرس + عدد غير مقروء + سجل)
 * حالة القراءة تُحفظ محلياً (آخر وقت مشاهدة لكل مستخدم).
 */

import { getMyNotifications } from '../services/notifications.service.js';
import { escapeHtml } from '../core/helpers.js';

let session, items = [], seenKey;

const $ = (id) => document.getElementById(id);

export async function mountNotifyCenter(sess) {
  session = sess;
  seenKey = 'hasad_notif_seen_' + (sess.nationalId || '');
  const bell = $('btnBell'); const panel = $('bellPanel');
  if (!bell || !panel) return;

  bell.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(); });
  $('bellMark').addEventListener('click', (e) => { e.stopPropagation(); markAllRead(); renderList(); });
  document.addEventListener('click', (e) => { if (!panel.contains(e.target) && !bell.contains(e.target)) panel.classList.add('hidden'); });

  await refresh();
  setInterval(refresh, 120000);               // تحديث خفيف كل دقيقتين
  window.addEventListener('focus', refresh);   // وعند العودة للتبويب
}

async function refresh() {
  try { items = await getMyNotifications(session, 100); } catch { return; }
  renderBadge();
  if (!$('bellPanel').classList.contains('hidden')) renderList();
}

const lastSeen = () => localStorage.getItem(seenKey) || '';
const unreadCount = () => { const ls = lastSeen(); return items.filter((n) => String(n.createdAt || '') > ls).length; };

function renderBadge() {
  const b = $('bellBadge'); if (!b) return;
  const c = unreadCount();
  if (c > 0) { b.textContent = c > 99 ? '99+' : String(c); b.classList.remove('hidden'); }
  else b.classList.add('hidden');
}

function togglePanel() {
  const p = $('bellPanel');
  const willOpen = p.classList.contains('hidden');
  p.classList.toggle('hidden');
  if (willOpen) { renderList(); markAllRead(); }
}

function markAllRead() {
  const newest = items.length ? (items[0].createdAt || new Date().toISOString()) : new Date().toISOString();
  localStorage.setItem(seenKey, newest);
  renderBadge();
}

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso); const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(s)) return '';
  if (s < 60) return 'الآن';
  const m = Math.floor(s / 60); if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60); if (h < 24) return `قبل ${h} ساعة`;
  const dd = Math.floor(h / 24); if (dd < 30) return `قبل ${dd} يوم`;
  return d.toISOString().slice(0, 10);
}

function renderList() {
  const el = $('bellList'); if (!el) return;
  const ls = lastSeen();
  if (!items.length) { el.innerHTML = '<div class="px-4 py-8 text-center text-slate-400 text-sm">لا توجد إشعارات</div>'; return; }
  el.innerHTML = items.map((n) => {
    const unread = String(n.createdAt || '') > ls;
    return `<div class="px-4 py-3 border-b border-slate-50 ${unread ? 'bg-primary/5' : ''}">
      <div class="flex items-start gap-2">
        <span class="mt-1.5 size-2 rounded-full ${unread ? 'bg-primary' : 'bg-transparent'} shrink-0"></span>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm text-slate-800">${escapeHtml(n.title || '')}</div>
          <div class="text-xs text-slate-600 mt-0.5">${escapeHtml(n.body || '')}</div>
          <div class="text-[11px] text-slate-400 mt-1">${timeAgo(n.createdAt)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}
