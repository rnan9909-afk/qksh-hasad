/**
 * firebase.adapter.js — مُحوِّل Cloud Firestore
 * ------------------------------------------------------------------
 * يطبّق واجهة DataAdapter باستخدام Firebase SDK v11 (modular).
 * يُحمّل الـ SDK ديناميكياً من CDN حتى لا يُثقل وضع Mock.
 *
 * لا يُستخدم إطلاقاً ما لم يكن DATA_PROVIDER = 'firebase'.
 */

import { DataAdapter } from './adapter.js';
import { FIREBASE_CONFIG } from '../firebase-config.js';

const SDK_VERSION = '11.0.2';
const APP_URL = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`;
const FS_URL = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`;

export class FirebaseAdapter extends DataAdapter {
  constructor() {
    super();
    this.fs = null; // وحدة firestore
    this.db = null; // نسخة قاعدة البيانات
  }

  async init() {
    const [{ initializeApp }, fs] = await Promise.all([import(APP_URL), import(FS_URL)]);
    this.fs = fs;
    const app = initializeApp(FIREBASE_CONFIG);
    this.db = fs.getFirestore(app);
  }

  _col(name) {
    return this.fs.collection(this.db, name);
  }

  async list(collection, opts = {}) {
    const { collection: col, query, where, orderBy, limit, getDocs } = this.fs;
    const constraints = [];

    if (Array.isArray(opts.filters)) {
      for (const [field, op, value] of opts.filters) {
        constraints.push(where(field, op, value));
      }
    }
    if (opts.orderBy) {
      const [field, dir = 'asc'] = opts.orderBy;
      constraints.push(orderBy(field, dir));
    }
    if (typeof opts.limit === 'number') {
      constraints.push(limit(opts.limit));
    }

    const q = constraints.length ? query(col(this.db, collection), ...constraints) : col(this.db, collection);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async get(collection, id) {
    const { doc, getDoc } = this.fs;
    const snap = await getDoc(doc(this.db, collection, String(id)));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async create(collection, data, id = null) {
    const { collection: col, addDoc, doc, setDoc } = this.fs;
    if (id != null) {
      await setDoc(doc(this.db, collection, String(id)), data);
      return String(id);
    }
    const ref = await addDoc(col(this.db, collection), data);
    return ref.id;
  }

  async update(collection, id, patch) {
    const { doc, updateDoc } = this.fs;
    await updateDoc(doc(this.db, collection, String(id)), patch);
  }

  async set(collection, id, data) {
    const { doc, setDoc } = this.fs;
    await setDoc(doc(this.db, collection, String(id)), data);
  }

  async remove(collection, id) {
    const { doc, deleteDoc } = this.fs;
    await deleteDoc(doc(this.db, collection, String(id)));
  }
}
