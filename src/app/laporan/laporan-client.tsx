"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowDownToLine, BarChart3, CalendarDays, CheckCircle2,
  FileSpreadsheet, Filter, Printer, Search, Users, Wallet, Plane
} from "lucide-react";
import styles from "./laporan.module.css";

export type ReportTrip = {
  id: string;
  year: number;
  type: string;
  status: string;
  purpose: string;
  origin: string;
  destination: string;
  province: string;
  departureDate: string;
  returnDate: string;
  activityStart: string;
  activityEnd: string;
  activityCode: string;
  activityName: string;
  sectionId: string;
  sectionName: string;
  participantCount: number;
  allowance: number;
  otherCost: number;
  totalRecordedCost: number;
};

const money = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(Number(value || 0));

const shortDate = (value: string) => value
  ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"))
  : "—";

const fullDate = (value: string) => value
  ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value + "T00:00:00"))
  : "—";

const tripType = (value: string) => value === "dalam_kota" ? "Dalam kota" : "Luar kota";
const statusLabel = (value: string) => value === "published" ? "Diterbitkan" : value === "draft" ? "Draf" : value === "cancelled" ? "Dibatalkan" : value || "—";

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\\-\\t\\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export default function LaporanClient({
  year, currentYear, trips, pageError
}: {
  year: number;
  currentYear: number;
  trips: ReportTrip[];
  pageError: string;
}) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(`${year}-01-01`);
  const [toDate, setToDate] = useState(`${year}-12-31`);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const years = Array.from({ length: Math.min(8, currentYear - 2019) }, (_, index) => currentYear - index);
  const sections = Array.from(new Map(trips.map((trip) => [trip.sectionId, trip.sectionName])).entries())
    .filter(([id]) => id)
    .sort((a, b) => a[1].localeCompare(b[1], "id"));

  const filtered = useMemo(() => trips.filter((trip) => {
    const inRange = (!fromDate || trip.departureDate >= fromDate) && (!toDate || trip.departureDate <= toDate);
    const typeMatch = typeFilter === "all" || trip.type === typeFilter;
    const statusMatch = statusFilter === "all" || trip.status === statusFilter;
    const sectionMatch = sectionFilter === "all" || trip.sectionId === sectionFilter;
    const searchText = [
      trip.purpose, trip.destination, trip.province, trip.activityCode,
      trip.activityName, trip.sectionName, trip.origin
    ].join(" ").toLowerCase();
    return inRange && typeMatch && statusMatch && sectionMatch && searchText.includes(search.toLowerCase());
  }), [trips, fromDate, toDate, typeFilter, statusFilter, sectionFilter, search]);

  const summary = useMemo(() => ({
    total: filtered.length,
    published: filtered.filter((trip) => trip.status === "published").length,
    participants: filtered.reduce((sum, trip) => sum + trip.participantCount, 0),
    recordedCost: filtered.reduce((sum, trip) => sum + trip.totalRecordedCost, 0)
  }), [filtered]);

  const monthly = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, month) => ({
      month,
      label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date(year, month, 1)),
      count: 0
    }));
    filtered.forEach((trip) => {
      const month = Number(trip.departureDate.slice(5, 7)) - 1;
      if (month >= 0 && month < 12) counts[month].count += 1;
    });
    const max = Math.max(1, ...counts.map((item) => item.count));
    return counts.map((item) => ({ ...item, width: item.count ? Math.max(5, item.count / max * 100) : 0 }));
  }, [filtered, year]);

  const sectionSummary = useMemo(() => {
    const map = new Map<string, { name: string; count: number; participants: number; cost: number }>();
    filtered.forEach((trip) => {
      const current = map.get(trip.sectionId) ?? {
        name: trip.sectionName, count: 0, participants: 0, cost: 0
      };
      current.count += 1;
      current.participants += trip.participantCount;
      current.cost += trip.totalRecordedCost;
      map.set(trip.sectionId, current);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "id"));
  }, [filtered]);

  function changeYear(value: string) {
    const selected = Number(value);
    if (!Number.isInteger(selected)) return;
    router.push(`/laporan?tahun=${selected}`);
  }

  function exportCsv() {
    const header = [
      "Tanggal Berangkat", "Tanggal Kembali", "Jenis Perjalanan", "Status",
      "Maksud Perjalanan", "Tempat Berangkat", "Tujuan", "Provinsi",
      "Bagian", "Kode Subkegiatan", "Nama Subkegiatan", "Jumlah Peserta",
      "Uang Harian Tercatat", "Biaya Lain Tercatat", "Total Biaya Tercatat"
    ];
    const rows = filtered.map((trip) => [
      trip.departureDate, trip.returnDate, tripType(trip.type), statusLabel(trip.status),
      trip.purpose, trip.origin, trip.destination, trip.province, trip.sectionName,
      trip.activityCode, trip.activityName, trip.participantCount, trip.allowance,
      trip.otherCost, trip.totalRecordedCost
    ]);
    const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `laporan-perjalanan-dinas-${year}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice("File CSV berhasil disiapkan.");
  }

  function printReport() {
    window.print();
  }

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>MONITORING DAN EVALUASI</div>
          <h1>Laporan Perjalanan Dinas</h1>
          <p>Rekapitulasi perjalanan berdasarkan tanggal keberangkatan, Bagian, jenis perjalanan, status, peserta, dan biaya yang tercatat.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={printReport}><Printer size={15}/> Cetak / PDF</button>
          <button type="button" className={styles.primaryButton} onClick={exportCsv}><FileSpreadsheet size={15}/> Ekspor CSV</button>
        </div>
      </div>

      {pageError && <div className={styles.error}><AlertCircle size={17}/>{pageError}</div>}
      {notice && <div className={styles.notice}><CheckCircle2 size={16}/>{notice}</div>}

      <section className={styles.filterPanel}>
        <div className={styles.filterTitle}><Filter size={15}/><b>Filter laporan</b><span>Data tahun {year}</span></div>
        <div className={styles.filterGrid}>
          <label>Tahun anggaran
            <select value={String(year)} onChange={(event) => changeYear(event.target.value)}>
              {years.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
          <label>Dari tanggal
            <input type="date" value={fromDate} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(event) => setFromDate(event.target.value)}/>
          </label>
          <label>Sampai tanggal
            <input type="date" value={toDate} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(event) => setToDate(event.target.value)}/>
          </label>
          <label>Jenis perjalanan
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Semua jenis</option>
              <option value="luar_kota">Luar kota</option>
              <option value="dalam_kota">Dalam kota</option>
            </select>
          </label>
          <label>Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Semua status</option>
              <option value="draft">Draf</option>
              <option value="published">Diterbitkan</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </label>
          <label>Bagian
            <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
              <option value="all">Semua Bagian</option>
              {sections.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
            </select>
          </label>
          <label className={styles.searchField}>Cari kegiatan / tujuan
            <div><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ketik kata kunci..."/></div>
          </label>
        </div>
      </section>

      <section className={styles.stats}>
        <article><div><span>Total perjalanan</span><Plane size={17}/></div><strong>{summary.total}</strong><small>Dalam filter yang dipilih</small></article>
        <article><div><span>Sudah diterbitkan</span><CheckCircle2 size={17}/></div><strong>{summary.published}</strong><small>SP dan SPPD terbit</small></article>
        <article><div><span>Jumlah peserta</span><Users size={17}/></div><strong>{summary.participants}</strong><small>Akumulasi peserta perjalanan</small></article>
        <article><div><span>Biaya tercatat</span><Wallet size={17}/></div><strong>{money(summary.recordedCost)}</strong><small>Snapshot UH + biaya lain</small></article>
      </section>

      <div className={styles.reportGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>Perjalanan per bulan</h2><p>Berdasarkan tanggal keberangkatan</p></div><CalendarDays size={18}/></div>
          <div className={styles.monthChart}>
            {monthly.map((item) => (
              <div className={styles.monthRow} key={item.month}>
                <span>{item.label}</span>
                <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${item.width}%` }}/></div>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>Rekap per Bagian</h2><p>Jumlah perjalanan, peserta, dan biaya tercatat</p></div><BarChart3 size={18}/></div>
          {sectionSummary.length ? (
            <div className={styles.sectionList}>
              {sectionSummary.map((item) => (
                <div className={styles.sectionRow} key={item.name}>
                  <div><b>{item.name}</b><span>{item.count} perjalanan · {item.participants} peserta</span></div>
                  <strong>{money(item.cost)}</strong>
                </div>
              ))}
            </div>
          ) : <div className={styles.empty}>Belum ada data pada filter ini.</div>}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><h2>Rincian perjalanan</h2><p>{filtered.length} data ditampilkan · biaya disajikan sebagai nilai yang sudah tercatat</p></div>
          <span className={styles.resultCount}>{filtered.length} perjalanan</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Tanggal</th><th>Perjalanan / Tujuan</th><th>Bagian / Subkegiatan</th><th>Jenis</th><th>Peserta</th><th>Status</th><th>Biaya tercatat</th></tr></thead>
            <tbody>
              {filtered.length ? filtered.map((trip) => (
                <tr key={trip.id}>
                  <td data-label="Tanggal"><b>{shortDate(trip.departureDate)}</b><small>s.d. {shortDate(trip.returnDate)}</small></td>
                  <td data-label="Perjalanan / Tujuan"><b>{trip.purpose || "Perjalanan dinas"}</b><small>{trip.destination}{trip.province ? ", " + trip.province : ""}</small></td>
                  <td data-label="Bagian / Subkegiatan"><b>{trip.sectionName}</b><small>{trip.activityCode ? trip.activityCode + " · " : ""}{trip.activityName}</small></td>
                  <td data-label="Jenis">{tripType(trip.type)}</td>
                  <td data-label="Peserta">{trip.participantCount} orang</td>
                  <td data-label="Status"><span className={trip.status === "published" ? styles.published : trip.status === "draft" ? styles.draft : styles.cancelled}>{statusLabel(trip.status)}</span></td>
                  <td data-label="Biaya tercatat"><b>{money(trip.totalRecordedCost)}</b><small>UH {money(trip.allowance)} · Lainnya {money(trip.otherCost)}</small></td>
                </tr>
              )) : <tr><td colSpan={7} className={styles.emptyCell}>Tidak ada perjalanan pada filter yang dipilih.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className={styles.tableFooter}>
          <span>Periode keberangkatan: {fromDate ? fullDate(fromDate) : "awal periode"} – {toDate ? fullDate(toDate) : "akhir periode"}</span>
          <strong>Total biaya tercatat: {money(summary.recordedCost)}</strong>
        </div>
      </section>

      <div className={styles.disclaimer}>
        <Wallet size={16}/>
        <span>Catatan: biaya tercatat dihitung dari snapshot uang harian peserta dan tabel biaya lain yang sudah tersimpan. Nilai ini bukan pengganti laporan realisasi SPJ atau pencocokan dengan bendahara.</span>
      </div>
      <footer className={styles.footer}>© {currentYear} Sekretariat Daerah Kabupaten Pekalongan · Laporan Perjalanan Dinas</footer>
    </div>
  );
}
