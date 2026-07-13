import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy }
  from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

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

export const Storage = {
  async checkDuplicate(outlet, tanggal, shift) {
    const snap = await getDocs(query(
      collection(db, "laporan"),
      where("outlet", "==", outlet),
      where("tanggal", "==", tanggal),
      where("shift", "==", shift)
    ));
    return !snap.empty;
  },

  async checkSerahTerima(outlet, tanggal, shift) {
    const snap = await getDocs(query(
      collection(db, "serahterima"),
      where("outlet", "==", outlet),
      where("tanggal", "==", tanggal),
      where("shift", "==", shift)
    ));
    return !snap.empty;
  },

  async saveSerahTerima(data) {
    const docRef = await addDoc(collection(db, "serahterima"), {
      ...data, createdAt: new Date().toISOString()
    });
    return docRef.id;
  },

  async getSerahTerimaByDate(tanggal, outlet) {
    let constraints = [where("tanggal", "==", tanggal), orderBy("createdAt", "desc")];
    if (outlet) constraints.push(where("outlet", "==", outlet));
    const snap = await getDocs(query(collection(db, "serahterima"), ...constraints));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async saveSetoran(setoran) {
    const docRef = await addDoc(collection(db, "setoran"), {
      ...setoran, createdAt: new Date().toISOString()
    });
    return docRef.id;
  },

  async getSetoranByDate(tanggal) {
    const snap = await getDocs(query(
      collection(db, "setoran"),
      where("tanggal", "==", tanggal),
      orderBy("createdAt", "desc")
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getSetoranByRange(outlet, startDate, endDate) {
    let constraints = [
      where("tanggal", ">=", startDate),
      where("tanggal", "<=", endDate),
      orderBy("tanggal", "desc")
    ];
    if (outlet !== "all") constraints.push(where("outlet", "==", outlet));
    const snap = await getDocs(query(collection(db, "setoran"), ...constraints));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async saveReport(report) {
    const docRef = await addDoc(collection(db, "laporan"), {
      ...report, createdAt: new Date().toISOString()
    });
    return docRef.id;
  },

  async getReports(outlet = "all", startDate = null, endDate = null) {
    let constraints = [orderBy("tanggal", "desc")];
    if (startDate) constraints.push(where("tanggal", ">=", startDate));
    if (endDate)   constraints.push(where("tanggal", "<=", endDate));
    if (outlet !== "all") constraints.push(where("outlet", "==", outlet));
    const snap = await getDocs(query(collection(db, "laporan"), ...constraints));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  getSummary(reports) {
    const laporanDenganKas = reports.filter(r => r.kasAkhirAktual > 0);
    const totalSelisih = laporanDenganKas.reduce((s, r) => s + (r.selisihKas || 0), 0);
    return {
      totalOmset:       reports.reduce((s, r) => s + (r.omset || 0), 0),
      totalCash:        reports.reduce((s, r) => s + (r.cash || 0), 0),
      totalEdc:         reports.reduce((s, r) => s + (r.edc || 0), 0),
      totalGrab:        reports.reduce((s, r) => s + (r.grab || 0), 0),
      totalDiskon:      reports.reduce((s, r) => s + (r.diskon || 0), 0),
      totalPengeluaran: reports.reduce((s, r) => s + (r.totalPengeluaran || 0), 0),
      totalSelisihKas:  totalSelisih,
      jumlahLaporanKas: laporanDenganKas.length,
      count: reports.length
    };
  },

  getDailyTotals(reports) {
    const map = {};
    reports.forEach(r => { map[r.tanggal] = (map[r.tanggal] || 0) + (r.omset || 0); });
    return map;
  },

  async getLastLaporan(outlet) {
    const snap = await getDocs(query(
      collection(db, "laporan"),
      where("outlet", "==", outlet),
      orderBy("tanggal", "desc"),
      orderBy("createdAt", "desc")
    ));
    if (snap.empty) return null;
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return docs.find(d => d.kasAkhirAktual > 0) || docs[0];
  },

  async getSetoranSetelah(outlet, tanggal, createdAt) {
    const snap = await getDocs(query(
      collection(db, "setoran"),
      where("outlet", "==", outlet),
      where("tanggal", ">=", tanggal),
      orderBy("tanggal", "asc")
    ));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return all.filter(s => s.createdAt >= createdAt);
  },

  async getKasStatus(outlets) {
    const results = [];
    for (const outlet of outlets) {
      try {
        const snap = await getDocs(query(
          collection(db, "laporan"),
          where("outlet", "==", outlet.id),
          orderBy("tanggal", "desc")
        ));
        if (snap.empty) {
          results.push({ outlet: outlet.id, outletNama: outlet.nama, status: 'nodata' });
          continue;
        }
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const SHIFT_ORDER = { Sore: 0, Middle: 1, Pagi: 2 };
        docs.sort((a, b) => {
          if (b.tanggal !== a.tanggal) return b.tanggal.localeCompare(a.tanggal);
          return (SHIFT_ORDER[a.shift] ?? 9) - (SHIFT_ORDER[b.shift] ?? 9);
        });
        const lastWithKas = docs.find(d => d.kasAkhirAktual > 0);
        const lastLaporan = lastWithKas || docs[0];
        const kasAkhir = lastWithKas
          ? lastWithKas.kasAkhirAktual
          : (docs[0].kasAkhirTeoritis || (docs[0].startingCash || 0) + (docs[0].cash || 0) - (docs[0].totalPengeluaran || 0));

        const setoranSnap = await getDocs(query(
          collection(db, "setoran"),
          where("outlet", "==", outlet.id)
        ));
        const setorans = setoranSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const relevantSetorans = setorans.filter(s => s.tanggal >= lastLaporan.tanggal);
        const totalSetoran = relevantSetorans.reduce((s, r) => s + (r.nominal || 0), 0);
        const sisaKas = kasAkhir - totalSetoran;
        const isAktual = !!lastWithKas;

        let startingCashWarning = null;
        const NEXT_SHIFT = { Pagi: 'Sore', Middle: 'Sore', Sore: 'Pagi' };
        const nextShift = NEXT_SHIFT[lastLaporan.shift];
        const nextTanggal = lastLaporan.shift === 'Sore'
          ? (() => { const d = new Date(lastLaporan.tanggal); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })()
          : lastLaporan.tanggal;

        const nextReport = docs.find(d => d.tanggal === nextTanggal && d.shift === nextShift);
        if (nextReport && kasAkhir > 0) {
          const setoranAntarShift = setorans.filter(s =>
            s.tanggal >= lastLaporan.tanggal &&
            s.tanggal <= nextTanggal &&
            s.createdAt > (lastLaporan.createdAt || '') &&
            s.createdAt < (nextReport.createdAt || '9999')
          );
          const totalSetoranAntarShift = setoranAntarShift.reduce((s, r) => s + (r.nominal || 0), 0);
          const expectedStarting = kasAkhir - totalSetoranAntarShift;
          const actualStarting = nextReport.startingCash || 0;
          const selisihStarting = actualStarting - expectedStarting;
          if (Math.abs(selisihStarting) > 0) {
            startingCashWarning = {
              expected: expectedStarting, actual: actualStarting,
              selisih: selisihStarting, shift: nextShift, tanggal: nextTanggal,
              adaSetoran: totalSetoranAntarShift > 0, totalSetoran: totalSetoranAntarShift
            };
          }
        }

        results.push({
          outlet: outlet.id, outletNama: outlet.nama,
          kasAkhir, totalSetoran, sisaKas,
          tanggal: lastLaporan.tanggal, shift: lastLaporan.shift,
          isAktual, startingCashWarning, status: 'ok'
        });
      } catch(e) {
        results.push({ outlet: outlet.id, outletNama: outlet.nama, status: 'error', errorMsg: e.message });
      }
    }
    return results;
  }
};
