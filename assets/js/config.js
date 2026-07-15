/**
 * config.js — الإعدادات العامة للنظام (v2)
 * ------------------------------------------------------------------
 * غيّر DATA_PROVIDER بين 'mock' | 'firebase' | 'supabase'.
 */

export const CONFIG = {
  APP_NAME: 'حَصَاد — نظام سجل الاختبارات',
  APP_TAGLINE: 'منصة تعليمية شاملة',
  LOGO_URL: 'assets/images/hasad-logo.png',

  // مزوّد البيانات النشط: 'mock' | 'firebase' | 'supabase'
  DATA_PROVIDER: 'supabase',

  get USE_MOCK() {
    return this.DATA_PROVIDER === 'mock';
  },

  // حساب المشرف العام الافتراضي
  SUPER_ADMIN_ID: '2491434540',

  // درجات النجاح
  PASS_SCORE_NORMAL: 70,
  PASS_SCORE_ITQAN: 80,

  // مدة الجلسة (8 ساعات)
  SESSION_TTL: 8 * 60 * 60 * 1000,
};

/** أسماء المجموعات/الجداول — مصدر واحد للحقيقة. */
export const COLLECTIONS = {
  USERS: 'users',
  SCHOOLS: 'schools',
  EXAM_LEVELS: 'examLevels',
  STUDENTS: 'students',        // سجل الطالب + سير الاختبار (بديل submissions القديم)
  SETTINGS: 'settings',
  RESULTS_HISTORY: 'resultsHistory',   // سجلات النتائج السابقة (استيراد كبير)
  RESULT_BATCHES: 'resultBatches',     // بيانات الدفعات (اسم/فصل/مدارس/عدد)
  REWARDS: 'rewards',                  // جدول جوائز الطلاب المالية (قابل للتعديل)
  TEACHER_REWARDS: 'teacherRewards',   // لائحة حوافز المعلمين (الأداء بالإنتاجية)
  AUDIT_LOG: 'auditLog',
  CERT_TEMPLATE: 'certificateTemplate',
};

/** الأدوار الخمسة. */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TEACHER: 'teacher',
  EXAM_SUPERVISOR: 'exam_supervisor',
  STUDENT: 'student',
};

/** تسميات الأدوار للعرض. */
export const ROLE_LABELS = {
  super_admin: 'المشرف العام',
  admin: 'الإدارة',
  teacher: 'المعلم',
  exam_supervisor: 'مشرف الاختبارات',
  student: 'طالب/ـة',
};
