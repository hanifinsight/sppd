"use client";

import { FormEvent, useMemo, useState } from "react";
import { BadgeCheck, BriefcaseBusiness, Edit3, Plus, Search, Users, UserRound, X, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ReferenceOption = { id: string; nama: string; aktif: boolean; detail?: string };
export type PegawaiRecord = {
  id: string;
  bagian_id: string | null;
  nama: string;
  nip: string | null;
  status_kepegawaian: string;
  pangkat_golongan: string | null;
  jabatan: string | null;
  instansi: string | null;
  aktif: boolean;
  nomenklatur_jabatan: string | null;
  nama_bagian: string;
};

type FormState = {
  nama: string;
  nip: string;
  status_kepegawaian: string;
  pangkat_golongan: string;
  jabatan: string;
  nomenklatur_jabatan: string;
  bagian_id: string;
  instansi: string;
};

const emptyForm: FormState = {
  nama: "", nip: "", status_kepegawaian: "PNS", pangkat_golongan: "",
  jabatan: "", nomenklatur_jabatan: "", bagian_id: "", instansi: "Sekretariat Daerah"
};
const statusOptions = [
  { value: "PNS", label: "PNS" },
  { value: "PPPK", label: "PPPK" },
  { value: "NON_ASN", label: "Non-ASN" },
  { value: "LAINNYA", label: "Lainnya" }
];

export default function PegawaiClient({
  initialRows, sections, ranks, positions
}: {
  initialRows: PegawaiRecord[];
  sections: ReferenceOption[];
  ranks: ReferenceOption[];
  positions: ReferenceOption[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const visibleRows = useMemo(() => rows.filter((row) => {
    const q = search.toLowerCase();
    const matchesSearch = (row.nama + " " + (row.nip ?? "") + " " + (row.nomenklatur_jabatan ?? "")).toLowerCase().includes(q);
    const matchesSection = sectionFilter === "all" || row.bagian_id === sectionFilter;
    const matchesStatus = statusFilter === "all" || row.status_kepegawaian === statusFilter;
    return matchesSearch && matchesSection && matchesStatus;
  }), [rows, search, sectionFilter, statusFilter]);

  const activeCount = rows.filter((row) => row.aktif).length;
  const pnsCount = rows.filter((row) => row.status_kepegawaian === "PNS" && row.aktif).length;
  const sectionCount = new Set(rows.filter((row) => row.bagian_id).map((row) => row.bagian_id)).size;

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm, bagian_id: sections.find((section) => section.aktif)?.id ?? "" });
    setError("");
    setNotice("");
    setShowModal(true);
  }

  function openEdit(row: PegawaiRecord) {
    setEditingId(row.id);
    setForm({
      nama: row.nama ?? "",
      nip: row.nip ?? "",
      status_kepegawaian: row.status_kepegawaian,
      pangkat_golongan: row.pangkat_golongan ?? "",
      jabatan: row.jabatan ?? "",
      nomenklatur_jabatan: row.nomenklatur_jabatan ?? "",
      bagian_id: row.bagian_id ?? "",
      instansi: row.instansi ?? "Sekretariat Daerah"
    });
    setError("");
    setNotice("");
    setShowModal(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const name = form.nama.trim();
    const nip = form.nip.trim();
    if (!name) { setError("Nama pegawai wajib diisi."); return; }
    if (!form.bagian_id) { setError("Pilih bagian untuk pegawai ini."); return; }
    if (nip && rows.some((row) => row.id !== editingId && (row.nip ?? "").trim() === nip)) {
      setError("NIP tersebut sudah digunakan oleh pegawai lain.");
      return;
    }

    const payload = {
      nama: name,
      nip: nip || null,
      status_kepegawaian: form.status_kepegawaian,
      pangkat_golongan: form.pangkat_golongan || null,
      jabatan: form.jabatan || null,
      nomenklatur_jabatan: form.nomenklatur_jabatan.trim() || null,
      bagian_id: form.bagian_id,
      instansi: form.instansi.trim() || "Sekretariat Daerah"
    };

    setBusy(true);
    const supabase = createClient();
    try {
      if (editingId) {
        const { data, error: updateError } = await supabase.from("pegawai")
          .update(payload)
          .eq("id", editingId)
          .select("id,bagian_id,nama,nip,status_kepegawaian,pangkat_golongan,jabatan,instansi,aktif,nomenklatur_jabatan")
          .single();
        if (updateError) throw updateError;
        const sectionName = sections.find((item) => item.id === data.bagian_id)?.nama ?? "Bagian tidak ditemukan";
        setRows((current) => current.map((row) => row.id === editingId ? { ...data, nama_bagian: sectionName } : row));
        setNotice("Data pegawai berhasil diperbarui.");
      } else {
        const { data, error: insertError } = await supabase.from("pegawai")
          .insert({ ...payload, aktif: true })
          .select("id,bagian_id,nama,nip,status_kepegawaian,pangkat_golongan,jabatan,instansi,aktif,nomenklatur_jabatan")
          .single();
        if (insertError) throw insertError;
        const sectionName = sections.find((item) => item.id === data.bagian_id)?.nama ?? "Bagian tidak ditemukan";
        setRows((current) => [...current, { ...data, nama_bagian: sectionName }].sort((a,b) => a.nama.localeCompare(b.nama, "id")));
        setNotice("Pegawai baru berhasil ditambahkan.");
      }
      setShowModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan data pegawai. Periksa hak akses akun.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: PegawaiRecord) {
    const action = row.aktif ? "menonaktifkan" : "mengaktifkan";
    if (!window.confirm("Yakin " + action + " pegawai " + row.nama + "?")) return;
    setPendingId(row.id);
    setNotice("");
    const supabase = createClient();
    const { data, error: updateError } = await supabase.from("pegawai")
      .update({ aktif: !row.aktif })
      .eq("id", row.id)
      .select("id,aktif")
      .single();
    if (updateError) {
      setError(updateError.message);
    } else {
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, aktif: data.aktif } : item));
      setNotice("Status pegawai berhasil diperbarui.");
    }
    setPendingId(null);
  }

  async function deleteEmployee(row: PegawaiRecord) {
    if (!window.confirm("Hapus permanen data pegawai " + row.nama + "? Penghapusan hanya berhasil jika pegawai belum digunakan dalam perjalanan dinas atau penugasan.")) return;
    setPendingId(row.id); setError(""); setNotice("");
    try {
      const supabase = createClient();
      const checks = await Promise.all([
        supabase.from("perjalanan_peserta").select("id", { count: "exact", head: true }).eq("pegawai_id", row.id),
        supabase.from("pejabat_dokumen").select("id", { count: "exact", head: true }).eq("pegawai_id", row.id),
        supabase.from("pejabat_pengelola").select("id", { count: "exact", head: true }).eq("pegawai_id", row.id)
      ]);
      const failed = checks.find(x => x.error);
      if (failed?.error) throw new Error("Pemeriksaan relasi gagal: " + failed.error.message);
      const used = checks.reduce((sum, x) => sum + (x.count ?? 0), 0);
      if (used > 0) throw new Error("Pegawai tidak dapat dihapus karena masih tercatat sebagai peserta atau pejabat pengelola/penandatangan. Nonaktifkan pegawai jika sudah tidak digunakan.");
      const { error: deleteError } = await supabase.from("pegawai").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setRows(current => current.filter(item => item.id !== row.id));
      setNotice("Data pegawai berhasil dihapus.");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menghapus data pegawai."); }
    finally { setPendingId(null); }
  }

  const statusLabel = (value: string) => value === "NON_ASN" ? "Non-ASN" : value;

  return <>
    <div className="master-page-head">
      <div><div className="eyebrow">DATA MASTER / SUMBER DAYA MANUSIA</div><h1>Data Pegawai</h1><p>Kelola identitas pegawai sebagai dasar peserta perjalanan dinas dan pejabat pengelola.</p></div>
      <button className="master-primary-btn" onClick={openNew}><Plus size={16}/> Tambah Pegawai</button>
    </div>

    <div className="master-stats-row">
      <div className="master-stat"><span className="master-stat-icon"><Users size={18}/></span><div><small>Total pegawai</small><strong>{rows.length}</strong></div></div>
      <div className="master-stat"><span className="master-stat-icon"><BadgeCheck size={18}/></span><div><small>Pegawai aktif</small><strong>{activeCount}</strong></div></div>
      <div className="master-stat"><span className="master-stat-icon"><BriefcaseBusiness size={18}/></span><div><small>PNS aktif</small><strong>{pnsCount}</strong></div></div>
    </div>

    {notice && <div className="master-feedback">{notice}</div>}
    {error && !showModal && <div className="master-feedback error">{error}</div>}
    <div className="master-toolbar">
      <label className="master-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, NIP, atau nomenklatur jabatan..."/></label>
      <div className="master-toolbar-actions">
        <select className="master-filter" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} aria-label="Filter bagian">
          <option value="all">Semua Bagian</option>{sections.map((item) => <option key={item.id} value={item.id}>{item.nama}</option>)}
        </select>
        <select className="master-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status kepegawaian">
          <option value="all">Semua Status</option>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
    </div>

    <div className="master-table-card">
      <div className="master-table-wrap">
        <table className="master-table">
          <thead><tr><th>PEGAWAI</th><th>PANGKAT / GOLONGAN</th><th>JABATAN</th><th>BAGIAN</th><th>STATUS</th><th>AKTIF</th><th>AKSI</th></tr></thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((row) => <tr key={row.id}>
              <td><strong>{row.nama}</strong><small>{row.nip || "NIP belum diisi"}</small></td>
              <td>{row.pangkat_golongan || <span className="muted">—</span>}</td>
              <td><strong>{row.jabatan || "Belum ditentukan"}</strong><small>{row.nomenklatur_jabatan || "Nomenklatur belum diisi"}</small></td>
              <td>{row.nama_bagian}</td>
              <td><span className="master-admin-pill">{statusLabel(row.status_kepegawaian)}</span></td>
              <td><span className={"master-status " + (row.aktif ? "is-active" : "is-inactive")}>{row.aktif ? "Aktif" : "Nonaktif"}</span></td>
              <td><div className="master-row-actions">
                <button className="master-icon-btn" title="Ubah pegawai" aria-label="Ubah pegawai" onClick={() => openEdit(row)}><Edit3 size={14}/></button>
                <button className="master-secondary-btn" disabled={pendingId === row.id} onClick={() => toggleActive(row)}>{pendingId === row.id ? "..." : row.aktif ? "Nonaktifkan" : "Aktifkan"}</button>\n                <button className="master-icon-btn" title="Hapus pegawai" aria-label="Hapus pegawai" disabled={pendingId === row.id} onClick={() => deleteEmployee(row)}><Trash2 size={14}/></button>
              </div></td>
            </tr>) : <tr><td colSpan={7} className="master-empty"><UserRound size={22}/><div>Tidak ada data pegawai yang sesuai dengan filter.</div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="master-table-foot"><span>Menampilkan <b>{visibleRows.length}</b> dari <b>{rows.length}</b> pegawai</span><span>{sectionCount} bagian memiliki data pegawai · Data Supabase</span></div>
    </div>

    {showModal && <div className="master-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setShowModal(false); }}>
      <section className="master-modal" role="dialog" aria-modal="true" aria-labelledby="pegawai-modal-title">
        <div className="master-modal-head"><div><h2 id="pegawai-modal-title">{editingId ? "Ubah Data Pegawai" : "Tambah Pegawai"}</h2><p>Isi identitas dan penempatan pegawai. Kolom bertanda * wajib diisi.</p></div><button className="master-modal-close" onClick={() => setShowModal(false)} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={save}>
          <div className="master-form-grid">
            <div className="master-field full"><label htmlFor="pegawai-nama">Nama lengkap *</label><input id="pegawai-nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama lengkap beserta gelar" maxLength={180} required/></div>
            <div className="master-field"><label htmlFor="pegawai-nip">NIP</label><input id="pegawai-nip" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value.replace(/[^0-9]/g, "").slice(0,18) })} placeholder="18 digit (jika ada)" inputMode="numeric" maxLength={18}/><span className="field-hint">Kosongkan untuk pegawai tanpa NIP.</span></div>
            <div className="master-field"><label htmlFor="pegawai-status">Status kepegawaian *</label><select id="pegawai-status" value={form.status_kepegawaian} onChange={(e) => setForm({ ...form, status_kepegawaian: e.target.value })}>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div className="master-field"><label htmlFor="pegawai-pangkat">Pangkat / Golongan</label><select id="pegawai-pangkat" value={form.pangkat_golongan} onChange={(e) => setForm({ ...form, pangkat_golongan: e.target.value })}><option value="">Pilih pangkat/golongan</option>{ranks.map((item) => <option key={item.id} value={item.nama}>{item.nama}</option>)}{form.pangkat_golongan && !ranks.some((x) => x.nama === form.pangkat_golongan) && <option value={form.pangkat_golongan}>{form.pangkat_golongan} (data lama)</option>}</select></div>
            <div className="master-field"><label htmlFor="pegawai-jabatan">Jenis jabatan</label><select id="pegawai-jabatan" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })}><option value="">Pilih jabatan</option>{positions.map((item) => <option key={item.id} value={item.nama}>{item.nama}{item.detail ? " — " + item.detail : ""}</option>)}{form.jabatan && !positions.some((x) => x.nama === form.jabatan) && <option value={form.jabatan}>{form.jabatan} (data lama)</option>}</select></div>
            <div className="master-field full"><label htmlFor="pegawai-nomenklatur">Nomenklatur jabatan</label><input id="pegawai-nomenklatur" value={form.nomenklatur_jabatan} onChange={(e) => setForm({ ...form, nomenklatur_jabatan: e.target.value })} placeholder="Contoh: Analis Kebijakan Ahli Muda" maxLength={180}/></div>
            <div className="master-field"><label htmlFor="pegawai-bagian">Bagian *</label><select id="pegawai-bagian" value={form.bagian_id} onChange={(e) => setForm({ ...form, bagian_id: e.target.value })} required><option value="">Pilih bagian</option>{sections.filter((item) => item.aktif || item.id === form.bagian_id).map((item) => <option key={item.id} value={item.id}>{item.nama}{!item.aktif ? " (nonaktif)" : ""}</option>)}</select></div>
            <div className="master-field"><label htmlFor="pegawai-instansi">Instansi</label><input id="pegawai-instansi" value={form.instansi} onChange={(e) => setForm({ ...form, instansi: e.target.value })} maxLength={150}/></div>
          </div>
          {error && <div className="master-form-error" role="alert">{error}</div>}
          <div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={() => setShowModal(false)} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Pegawai"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
