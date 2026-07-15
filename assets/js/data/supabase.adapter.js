/**
 * supabase.adapter.js — مُحوِّل Supabase (PostgreSQL)
 * ------------------------------------------------------------------
 * يطبّق واجهة DataAdapter باستخدام مكتبة supabase-js v2 (تُحمّل من CDN).
 * أسماء الجداول = أسماء المجموعات، وأسماء الأعمدة = أسماء الحقول نفسها
 * (camelCase مقتبسة في SQL) حتى لا نحتاج أي تحويل، ويبقى بقية النظام
 * كما هو دون أي تعديل.
 *
 * لا يُستخدم إطلاقاً ما لم يكن DATA_PROVIDER = 'supabase'.
 */

import { DataAdapter } from './adapter.js';
import { SUPABASE_CONFIG } from '../supabase-config.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export class SupabaseAdapter extends DataAdapter {
  constructor() {
    super();
    this.client = null;
  }

  async init() {
    const { createClient } = await import(SDK_URL);
    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: { persistSession: false },
    });
  }

  async list(collection, opts = {}) {
    let q = this.client.from(collection).select('*');

    if (Array.isArray(opts.filters)) {
      for (const [field, op, value] of opts.filters) {
        q = applyOp(q, field, op, value);
      }
    }
    if (opts.orderBy) {
      const [field, dir = 'asc'] = opts.orderBy;
      q = q.order(field, { ascending: dir !== 'desc' });
    }
    if (typeof opts.limit === 'number') {
      q = q.limit(opts.limit);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async get(collection, id) {
    const { data, error } = await this.client
      .from(collection)
      .select('*')
      .eq('id', String(id))
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }

  async create(collection, data, id = null) {
    const record = { ...data, id: id != null ? String(id) : genId() };
    const { data: rows, error } = await this.client
      .from(collection)
      .insert(record)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return rows.id;
  }

  async update(collection, id, patch) {
    const { error } = await this.client.from(collection).update(patch).eq('id', String(id));
    if (error) throw new Error(error.message);
  }

  async set(collection, id, data) {
    const record = { ...data, id: String(id) };
    const { error } = await this.client.from(collection).upsert(record);
    if (error) throw new Error(error.message);
  }

  async remove(collection, id) {
    const { error } = await this.client.from(collection).delete().eq('id', String(id));
    if (error) throw new Error(error.message);
  }

  async bulkCreate(collection, records) {
    const rows = records.map((r) => ({ ...r, id: r.id != null ? String(r.id) : genId() }));
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await this.client.from(collection).insert(slice);
      if (error) throw new Error(error.message);
      inserted += slice.length;
    }
    return inserted;
  }

  async removeWhere(collection, filter) {
    const [field, op, value] = filter;
    let q = this.client.from(collection).delete();
    q = applyOp(q, field, op, value);
    const { error } = await q;
    if (error) throw new Error(error.message);
  }
}

/** تطبيق عامل فلترة على استعلام supabase. */
function applyOp(q, field, op, value) {
  switch (op) {
    case '==': return q.eq(field, value);
    case '!=': return q.neq(field, value);
    case '>': return q.gt(field, value);
    case '>=': return q.gte(field, value);
    case '<': return q.lt(field, value);
    case '<=': return q.lte(field, value);
    case 'in': return q.in(field, value);
    case 'array-contains': return q.contains(field, [value]);
    case 'like': return q.ilike(field, value);
    default: throw new Error('عامل فلترة غير مدعوم: ' + op);
  }
}

let counter = 0;
function genId() {
  counter += 1;
  return 'id_' + Date.now().toString(36) + '_' + counter.toString(36);
}
