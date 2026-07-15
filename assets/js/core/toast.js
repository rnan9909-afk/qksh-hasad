/**
 * toast.js — إشعارات وحوارات موحّدة فوق SweetAlert2
 * ------------------------------------------------------------------
 * يوفّر واجهة بسيطة ومتسقة لكل الرسائل بدل تكرار كود Swal في كل مكان.
 * يعتمد على المتغير العام Swal المحمّل من CDN في الصفحة.
 */

const PRIMARY = '#1E4D2B';
const DANGER = '#d33';

function swal() {
  if (typeof window.Swal === 'undefined') {
    // fallback بسيط لو لم يُحمّل Swal
    return null;
  }
  return window.Swal;
}

/** إشعار صغير في الزاوية (toast). */
export function toast(title, icon = 'success', timer = 1500) {
  const S = swal();
  if (!S) return alert(title);
  return S.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    showConfirmButton: false,
    timer,
  });
}

/** رسالة نجاح (مع HTML اختياري). */
export function success(title, html = '') {
  const S = swal();
  if (!S) return alert(title);
  return S.fire({ icon: 'success', title, html });
}

/** رسالة خطأ. */
export function error(title, message = '') {
  const S = swal();
  if (!S) return alert(title + '\n' + message);
  return S.fire({ icon: 'error', title, text: message });
}

/** تنبيه معلوماتي. */
export function info(title, message = '') {
  const S = swal();
  if (!S) return alert(title + '\n' + message);
  return S.fire({ icon: 'info', title, text: message });
}

/** تحذير. */
export function warning(title, message = '') {
  const S = swal();
  if (!S) return alert(title + '\n' + message);
  return S.fire({ icon: 'warning', title, text: message });
}

/** عرض شاشة تحميل حاجبة. */
export function showLoading(title = 'جاري المعالجة...', html = '') {
  const S = swal();
  if (!S) return;
  S.fire({ title, html, allowOutsideClick: false, didOpen: () => S.showLoading() });
}

/** إغلاق أي حوار مفتوح. */
export function close() {
  const S = swal();
  if (S) S.close();
}

/**
 * حوار تأكيد (نعم/إلغاء).
 * @returns {Promise<boolean>}
 */
export async function confirm(title, text = '', { confirmText = 'نعم', cancelText = 'إلغاء', icon = 'warning', danger = false } = {}) {
  const S = swal();
  if (!S) return window.confirm(title + '\n' + text);
  const res = await S.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? DANGER : PRIMARY,
    cancelButtonColor: '#64748b',
  });
  return res.isConfirmed;
}

/**
 * حوار إدخال نصي.
 * @returns {Promise<string|null>} النص أو null عند الإلغاء.
 */
export async function prompt(title, { label = '', placeholder = '', value = '', required = true, target = null } = {}) {
  const S = swal();
  if (!S) return window.prompt(title, value);
  const res = await S.fire({
    title,
    input: 'text',
    inputLabel: label,
    inputPlaceholder: placeholder,
    inputValue: value,
    showCancelButton: true,
    confirmButtonText: 'تأكيد',
    cancelButtonText: 'إلغاء',
    focusConfirm: false,
    target: target || undefined,
    inputValidator: required
      ? (value) => (!value ? 'هذا الحقل مطلوب!' : undefined)
      : undefined,
  });
  return res.isConfirmed ? res.value : null;
}
