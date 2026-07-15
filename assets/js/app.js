/**
 * app.js — إقلاع لوحة التحكم وتوجيه العرض حسب الدور
 */

import { CONFIG, ROLES, ROLE_LABELS } from './config.js';
import { initData } from './data/index.js';
import { requireSession, goLogin } from './core/router.js';
import { logout } from './core/auth.js';
import { byId, setText } from './core/ui.js';
import * as toast from './core/toast.js';

async function boot() {
  const session = requireSession();
  if (!session) return;

  byId('headerLogo').src = CONFIG.LOGO_URL;
  setText('welcomeMsg', 'مرحباً: ' + session.name);
  setText('roleBadge', ROLE_LABELS[session.role] || '');

  byId('btnLogout').addEventListener('click', () => { logout(); goLogin(); });

  try {
    await initData();
  } catch (err) {
    toast.error('فشل الاتصال بقاعدة البيانات', err.message);
    return;
  }

  const root = byId('viewRoot');
  try {
    switch (session.role) {
      case ROLES.SUPER_ADMIN: {
        const m = await import('./views/superadmin.view.js');
        return m.mount(root, session);
      }
      case ROLES.ADMIN: {
        const m = await import('./views/admin.view.js');
        return m.mount(root, session);
      }
      case ROLES.TEACHER: {
        const m = await import('./views/teacher.view.js');
        return m.mount(root, session);
      }
      case ROLES.EXAM_SUPERVISOR: {
        const m = await import('./views/examsupervisor.view.js');
        return m.mount(root, session);
      }
      case ROLES.STUDENT: {
        const m = await import('./views/student.view.js');
        return m.mount(root, session);
      }
      default:
        goLogin();
    }
  } catch (err) {
    console.error(err);
    toast.error('خطأ في تحميل الواجهة', err.message);
  }
}

boot();
