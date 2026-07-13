import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc,
  doc, query, where, updateDoc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCKbePw9GnSwmsPhdpHHk9zfbOj5qZRqsM",
  authDomain: "tanara-report.firebaseapp.com",
  projectId: "tanara-report",
  storageBucket: "tanara-report.firebasestorage.app",
  messagingSenderId: "365522383367",
  appId: "1:365522383367:web:8cb67f1104f9d58eff70a2"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

const DEFAULT_OUTLETS = [
  { id: "outlet1", nama: "Tanara Tunjungan Plaza" },
];

let _outletsCache = null;

export const OutletManager = {
  async getAll() {
    if (_outletsCache) return _outletsCache;
    try {
      const snap = await getDocs(collection(db, "outlets"));
      if (snap.empty) {
        for (const o of DEFAULT_OUTLETS) {
          await setDoc(doc(db, "outlets", o.id), { nama: o.nama });
        }
        _outletsCache = [...DEFAULT_OUTLETS];
      } else {
        _outletsCache = snap.docs.map(d => ({ id: d.id, nama: d.data().nama }));
      }
    } catch(e) {
      _outletsCache = [...DEFAULT_OUTLETS];
    }
    return _outletsCache;
  },

  invalidate() { _outletsCache = null; },

  async getNamesMap() {
    const list = await this.getAll();
    const map = { all: "Semua Outlet" };
    list.forEach(o => map[o.id] = o.nama);
    return map;
  },

  async add(nama) {
    if (!nama) throw new Error("Nama outlet tidak boleh kosong");
    const list = await this.getAll();
    const existingNums = list
      .map(o => parseInt(o.id.replace("outlet", "")))
      .filter(n => !isNaN(n));
    const nextNum = existingNums.length ? Math.max(...existingNums) + 1 : 1;
    const newId = "outlet" + nextNum;
    await setDoc(doc(db, "outlets", newId), { nama });
    this.invalidate();
    return newId;
  },

  async updateNama(id, nama) {
    if (!nama) throw new Error("Nama tidak boleh kosong");
    await updateDoc(doc(db, "outlets", id), { nama });
    this.invalidate();
  },
};

export const Auth = {
  async login(username, password, outlet) {
    if (username === "owner") {
      const ownerDoc = await getDoc(doc(db, "config", "owner"));
      const ownerPassword = ownerDoc.exists() ? ownerDoc.data().password : "owner123";
      if (password !== ownerPassword) return null;
      const session = { username, role: "owner", nama: "Owner", selectedOutlet: outlet };
      localStorage.setItem("tanara_session", JSON.stringify(session));
      return session;
    }

    const snap = await getDocs(query(
      collection(db, "users"),
      where("username", "==", username),
      where("password", "==", password)
    ));
    if (snap.empty) return null;
    const u = { id: snap.docs[0].id, ...snap.docs[0].data() };

    if (u.role === "gudang" || u.role === "keuangan") {
      const session = { ...u };
      localStorage.setItem("tanara_session", JSON.stringify(session));
      return session;
    }

    const allowedOutlets = u.outlets || (u.outlet ? [u.outlet] : []);
    if (outlet !== 'none' && !allowedOutlets.includes(outlet)) {
      throw new Error("Kamu tidak terdaftar di outlet ini.");
    }
    const session = { ...u, outlets: allowedOutlets, selectedOutlet: outlet };
    localStorage.setItem("tanara_session", JSON.stringify(session));
    return session;
  },

  logout() {
    localStorage.removeItem("tanara_session");
    window.location.href = "index.html";
  },

  getUser() {
    const s = localStorage.getItem("tanara_session");
    return s ? JSON.parse(s) : null;
  },

  requireAuth(role) {
    const u = this.getUser();
    if (!u) { window.location.href = "index.html"; return null; }
    if (role === "owner" && u.role !== "owner") { window.location.href = "home.html"; return null; }
    if (role === "inventori" && !["owner","gudang"].includes(u.role) && !u.aksesGudang) {
      window.location.href = "home.html"; return null;
    }
    if (role === "keuangan" && !["owner","keuangan"].includes(u.role)) {
      window.location.href = "home.html"; return null;
    }
    return u;
  },

  async changeOwnerPassword(oldPassword, newPassword) {
    const ownerDoc = await getDoc(doc(db, "config", "owner"));
    const current = ownerDoc.exists() ? ownerDoc.data().password : "owner123";
    if (oldPassword !== current) throw new Error("Password lama salah.");
    if (!newPassword || newPassword.length < 6) throw new Error("Password baru minimal 6 karakter.");
    await setDoc(doc(db, "config", "owner"), { password: newPassword });
  },

  async getUsers() {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addUser(data) {
    const snap = await getDocs(query(collection(db, "users"), where("username", "==", data.username)));
    if (!snap.empty) throw new Error("Username sudah digunakan");
    if (data.role === "gudang" || data.role === "keuangan") {
      return addDoc(collection(db, "users"), { ...data });
    }
    if (!data.outlets || data.outlets.length === 0) throw new Error("Pilih minimal 1 outlet");
    return addDoc(collection(db, "users"), { ...data, role: "pegawai" });
  },

  async updateUserOutlets(id, outlets) {
    if (!outlets || outlets.length === 0) throw new Error("Pilih minimal 1 outlet");
    await updateDoc(doc(db, "users", id), { outlets });
  },

  async updateAksesGudang(id, value) {
    await updateDoc(doc(db, "users", id), { aksesGudang: value });
  },

  async deleteUser(id) {
    return deleteDoc(doc(db, "users", id));
  }
};
