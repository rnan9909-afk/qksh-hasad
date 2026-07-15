/**
 * workflow.js — آلة حالات الطالب (Student Lifecycle State Machine)
 * ------------------------------------------------------------------
 * الحالات التسع من المتطلبات + حالة "راسب". لكل حالة ترتيب، تسمية،
 * ولون موحّد يظهر في كل الصفحات.
 */

export const STATUS = {
  registered:        { order: 1, label: 'تم تسجيل الطالب',          color: 'slate',   icon: 'person_add' },
  awaiting_internal: { order: 2, label: 'بانتظار الاختبار الداخلي', color: 'amber',   icon: 'hourglass_top' },
  internal_approved: { order: 3, label: 'تم اعتماد الاختبار الداخلي', color: 'lime',   icon: 'task_alt' },
  awaiting_schedule: { order: 4, label: 'بانتظار تحديد الموعد',      color: 'yellow', icon: 'pending_actions' },
  scheduled:         { order: 5, label: 'تم تحديد الموعد',           color: 'orange',  icon: 'event_available' },
  awaiting_final:    { order: 6, label: 'بانتظار الاختبار النهائي',  color: 'orange',  icon: 'schedule' },
  final_done:        { order: 7, label: 'تم إجراء الاختبار النهائي', color: 'rose',    icon: 'fact_check' },
  result_approved:   { order: 8, label: 'تم اعتماد النتيجة',         color: 'emerald', icon: 'verified' },
  certificate_ready: { order: 9, label: 'الشهادة جاهزة',            color: 'green',   icon: 'workspace_premium' },
  failed:            { order: 8, label: 'لم يجتز الاختبار',          color: 'red',     icon: 'cancel' },
};

/** الحالة الابتدائية عند تسجيل الطالب. */
export const INITIAL_STATUS = 'registered';

/** ألوان Tailwind الجاهزة لكل حالة (خلفية/نص/حدود + نقطة). */
export function statusClasses(key) {
  const c = (STATUS[key] || STATUS.registered).color;
  return {
    badge: `bg-${c}-50 text-${c}-700 border border-${c}-100`,
    dot: `bg-${c}-500`,
    text: `text-${c}-700`,
  };
}

/** تسمية الحالة. */
export function statusLabel(key) {
  return (STATUS[key] || {}).label || key;
}

/** أيقونة الحالة. */
export function statusIcon(key) {
  return (STATUS[key] || {}).icon || 'help';
}

/**
 * الانتقالات المسموحة (من → إلى) مع الدور المخوّل.
 * تُستخدم للتحقق قبل تغيير الحالة.
 */
const TRANSITIONS = {
  registered:        [{ to: 'awaiting_internal', roles: ['admin', 'teacher', 'super_admin'] }],
  awaiting_internal: [{ to: 'internal_approved', roles: ['teacher', 'super_admin'] }],
  internal_approved: [{ to: 'awaiting_schedule', roles: ['admin', 'super_admin'] }],
  awaiting_schedule: [{ to: 'scheduled', roles: ['exam_supervisor', 'super_admin'] }],
  scheduled:         [{ to: 'awaiting_final', roles: ['exam_supervisor', 'super_admin'] },
                      { to: 'result_approved', roles: ['exam_supervisor', 'super_admin'] },
                      { to: 'failed', roles: ['exam_supervisor', 'super_admin'] }],
  awaiting_final:    [{ to: 'result_approved', roles: ['exam_supervisor', 'super_admin'] },
                      { to: 'failed', roles: ['exam_supervisor', 'super_admin'] }],
  final_done:        [{ to: 'result_approved', roles: ['exam_supervisor', 'super_admin'] }],
  result_approved:   [{ to: 'certificate_ready', roles: ['exam_supervisor', 'admin', 'super_admin'] }],
};

/** هل يُسمح بالانتقال من حالة إلى أخرى لهذا الدور؟ */
export function canTransition(from, to, role) {
  const rules = TRANSITIONS[from] || [];
  const rule = rules.find((r) => r.to === to);
  return !!rule && (role === 'super_admin' || rule.roles.includes(role));
}

/** ترتيب الحالة (لأغراض الفرز والمقارنة). */
export function statusOrder(key) {
  return (STATUS[key] || {}).order || 0;
}

/** هل النتيجة معتمدة (نهائياً)؟ */
export function isResultFinal(key) {
  return key === 'result_approved' || key === 'certificate_ready' || key === 'failed';
}
