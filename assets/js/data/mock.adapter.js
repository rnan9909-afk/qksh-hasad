/**
 * mock.adapter.js — مُحوِّل تجريبي يعمل في الذاكرة + localStorage
 * ------------------------------------------------------------------
 * يجعل النظام يعمل فوراً بلا أي إعداد خادمي. البيانات تُحفظ في
 * localStorage فتبقى بين الجلسات على نفس المتصفح.
 *
 * يطبّق نفس واجهة DataAdapter تماماً، فيمكن استبداله بـ Firebase/Supabase
 * دون تغيير أي خدمة.
 */

import { DataAdapter, applyQuery } from './adapter.js';
import { SEED } from './seed-data.js';

const STORAGE_KEY = 'exam_system_mock_db_v2';

export class MockAdapter extends DataAdapter {
  constructor() {
    super();
    this.db = null;
  }

  async init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.db = JSON.parse(saved);
      } catch {
        this.db = this._freshFromSeed();
      }
    } else {
      this.db = this._freshFromSeed();
    }
    // ضمان وجود كل المجموعات حتى لو كانت البيانات المحفوظة أقدم
    for (const key of Object.keys(this._freshFromSeed())) {
      if (!this.db[key]) this.db[key] = [];
    }
    this._persist();
  }

  /** إعادة تعيين قاعدة البيانات التجريبية للبيانات الأولية. */
  reset() {
    this.db = this._freshFromSeed();
    this._persist();
  }

  _freshFromSeed() {
    // نسخ عميق لتجنّب تعديل SEED
    return JSON.parse(JSON.stringify(SEED));
  }

  _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
  }

  _coll(name) {
    if (!this.db[name]) this.db[name] = [];
    return this.db[name];
  }

  async list(collection, opts = {}) {
    await this._latency();
    return applyQuery(this._coll(collection), opts).map(clone);
  }

  async get(collection, id) {
    await this._latency();
    const found = this._coll(collection).find((r) => String(r.id) === String(id));
    return found ? clone(found) : null;
  }

  async create(collection, data, id = null) {
    await this._latency();
    const newId = id != null ? String(id) : genId();
    const record = { ...data, id: newId };
    this._coll(collection).push(record);
    this._persist();
    return newId;
  }

  async update(collection, id, patch) {
    await this._latency();
    const coll = this._coll(collection);
    const idx = coll.findIndex((r) => String(r.id) === String(id));
    if (idx === -1) throw new Error('المستند غير موجود: ' + id);
    coll[idx] = { ...coll[idx], ...patch, id: coll[idx].id };
    this._persist();
  }

  async set(collection, id, data) {
    await this._latency();
    const coll = this._coll(collection);
    const idx = coll.findIndex((r) => String(r.id) === String(id));
    const record = { ...data, id: String(id) };
    if (idx === -1) coll.push(record);
    else coll[idx] = record;
    this._persist();
  }

  async remove(collection, id) {
    await this._latency();
    const coll = this._coll(collection);
    const idx = coll.findIndex((r) => String(r.id) === String(id));
    if (idx !== -1) {
      coll.splice(idx, 1);
      this._persist();
    }
  }

  async bulkCreate(collection, records) {
    await this._latency();
    const coll = this._coll(collection);
    for (const r of records) coll.push({ ...r, id: r.id != null ? String(r.id) : genId() });
    this._persist();
    return records.length;
  }

  async removeWhere(collection, filter) {
    await this._latency();
    const [field, op, value] = filter;
    const match = (fv) => {
      switch (op) {
        case '==': return fv === value;
        case '!=': return fv !== value;
        case 'in': return Array.isArray(value) && value.includes(fv);
        case 'array-contains': return Array.isArray(fv) && fv.includes(value);
        default: return false;
      }
    };
    this.db[collection] = this._coll(collection).filter((row) => !match(row[field]));
    this._persist();
  }

  /** محاكاة تأخير الشبكة البسيط لواقعية حالات التحميل. */
  _latency() {
    return new Promise((resolve) => setTimeout(resolve, 120));
  }
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

let counter = 0;
function genId() {
  counter += 1;
  return 'id_' + Date.now().toString(36) + '_' + counter.toString(36);
}
