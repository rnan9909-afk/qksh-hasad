/**
 * adapter.js — واجهة طبقة الوصول للبيانات (Data Access Interface)
 * ------------------------------------------------------------------
 * كل الخدمات (services) تتعامل مع هذه الواجهة فقط، ولا تعرف شيئاً عن
 * Firebase أو Supabase. هذا يجعل تبديل قاعدة البيانات مسألة تبديل ملف
 * واحد في data/index.js دون لمس أي كود آخر.
 *
 * أي مُحوِّل (Firebase / Supabase / Mock) يجب أن يطبّق كل هذه الدوال.
 * صيغة الفلاتر (filters) موحّدة: [field, op, value]
 *   op ∈ { '==', '!=', '>', '>=', '<', '<=', 'in', 'array-contains' }
 */

export class DataAdapter {
  /** تهيئة الاتصال (يُستدعى مرة واحدة عند الإقلاع). */
  async init() {
    throw new Error('init() غير مطبّقة');
  }

  /**
   * جلب كل المستندات من مجموعة، مع فلاتر وترتيب اختياريين.
   * @param {string} collection
   * @param {{ filters?: Array, orderBy?: [string, ('asc'|'desc')?], limit?: number }} [opts]
   * @returns {Promise<Array<object>>} كل عنصر يحتوي حقل id.
   */
  async list(collection, opts = {}) {
    throw new Error('list() غير مطبّقة');
  }

  /**
   * جلب مستند واحد بمعرّفه.
   * @returns {Promise<object|null>}
   */
  async get(collection, id) {
    throw new Error('get() غير مطبّقة');
  }

  /**
   * إضافة مستند جديد بمعرّف تلقائي (أو معرّف محدد إن مُرّر).
   * @returns {Promise<string>} معرّف المستند الجديد.
   */
  async create(collection, data, id = null) {
    throw new Error('create() غير مطبّقة');
  }

  /**
   * تحديث حقول محددة من مستند موجود (دمج).
   * @returns {Promise<void>}
   */
  async update(collection, id, patch) {
    throw new Error('update() غير مطبّقة');
  }

  /**
   * استبدال/كتابة مستند كامل بمعرّف محدد.
   * @returns {Promise<void>}
   */
  async set(collection, id, data) {
    throw new Error('set() غير مطبّقة');
  }

  /**
   * حذف مستند.
   * @returns {Promise<void>}
   */
  async remove(collection, id) {
    throw new Error('remove() غير مطبّقة');
  }

  /**
   * إدراج دفعة سجلات دفعة واحدة (للاستيراد الكبير).
   * @param {string} collection
   * @param {Array<object>} records كل سجل قد يحوي id (وإلا يُولّد).
   * @returns {Promise<number>} عدد السجلات المُدرجة.
   */
  async bulkCreate(collection, records) {
    throw new Error('bulkCreate() غير مطبّقة');
  }

  /**
   * حذف كل المستندات المطابقة لفلتر واحد [field, op, value].
   * @returns {Promise<void>}
   */
  async removeWhere(collection, filter) {
    throw new Error('removeWhere() غير مطبّقة');
  }
}

/**
 * تطبيق الفلاتر والترتيب والحد على مصفوفة في الذاكرة.
 * مشتركة بين Mock وأي مُحوِّل يحتاج فلترة محلية.
 */
export function applyQuery(rows, opts = {}) {
  let out = rows.slice();

  if (Array.isArray(opts.filters)) {
    for (const [field, op, value] of opts.filters) {
      out = out.filter((row) => matchFilter(row[field], op, value));
    }
  }

  if (opts.orderBy) {
    const [field, dir = 'asc'] = opts.orderBy;
    out.sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return dir === 'desc' ? -cmp : cmp;
    });
  }

  if (typeof opts.limit === 'number') {
    out = out.slice(0, opts.limit);
  }

  return out;
}

function matchFilter(fieldValue, op, value) {
  switch (op) {
    case '==':
      return fieldValue === value;
    case '!=':
      return fieldValue !== value;
    case '>':
      return fieldValue > value;
    case '>=':
      return fieldValue >= value;
    case '<':
      return fieldValue < value;
    case '<=':
      return fieldValue <= value;
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'array-contains':
      return Array.isArray(fieldValue) && fieldValue.includes(value);
    case 'like': {
      const needle = String(value).replace(/%/g, '').toLowerCase();
      return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(needle);
    }
    default:
      throw new Error('عامل فلترة غير مدعوم: ' + op);
  }
}
