"use client";

import { FormEvent, useMemo, useState } from "react";
import { Building2, CheckCircle2, Edit3, Plus, Search, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type BagianRecord = {
  id: string;
  nama_bagian: string;
  nama_instansi: string;
  aktif: boolean;
  jumlah_pegawai: number;
};

type FormState = { nama_bagian: string; nama_instansi: string };

export default function BagianClient({ initialRows }: { initialRows: BagianRecord[] }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ nama_bagian: "", nama_instansi: "Sekretariat Daerah" });
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const visibleRows = useMemo(() => rows.filter((row) =>
    (row.nama_bagian + " " + row.nama_instansi).toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);
  const activeCount = rows.filter((row) => row.aktif).length;
  const inactiveCount = rows.length - activeCount;
  const employeeCount = rows.reduce((sum, row) => sum + row.jumlah_pegawai, 0);

  function openNew() {
    setEditingId(null);
    setForm({ nama_bagian: "", nama_instansi: "Sekretariat Daerah" });
    setError("");
    setNotice("");
    setShowModal(true);
  }

  function openEdit(row: BagianRecord) {
    setEditingId(row.id);
    setForm({ nama_bagian: row.nama_bagian, nama_instansi: row.nama_instansi });
    setError("");
    setNotice("");
    setShowModal(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const name = form.nama_bagian.trim();
    const agency = form.nama_instansi.trim();
    if (!name) { setError("Nama bagian wajib diisi."); return; }
    const duplicate = rows.some((row) => row.id !== editingId && row.nama_bagian.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) { setError("Nama bagian tersebut sudah terdaftar."); return; }

    setBusy(true);
    const supabase = createClient();
    try {
      if (editingId) {
        const { data, error: updateError } = await supabase.from("bagian")
          .update({ nama_bagian: name, nama_instansi: agency })
          .eq("id", editingId)
          .select("id,nama_bagian,nama_instansi,aktif")
          .single();
        if (updateError) throw updateError;
        setRows((current) => current.map((row) => row.id === editingId ? { ...row, ...data, nama_instansi: data.nama_instansi ?? "" } : row));
        setNotice("Perubahan data bagian berhasil disimpan.");
      } else {
        const { data, error: insertError } = await supabase.from("bagian")
          .insert({ nama_bagian: name, nama_instansi: agency, aktif: true })
          .select("id,nama_bagian,nama_instansi,aktif")
          .single();
        if (insertError) throw insertError;
        setRows((current) => [...current, { ...data, nama_instansi: data.nama_instansi ?? "", jumlah_pegawai: 0 }].sort((a,b) => a.nama_bagian.localeCompare(b.nama_bagian, "id")));
        setNotice("Bagian baru berhasil ditambahkan.");
      }
      setShowModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan data bagian. Periksa hak akses akun.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: BagianRecord) {
    const action = row.aktif ? "menonaktifkan" : "mengaktifkan";
    if (!window.confirm("Yakin " + action + " " + row.nama_bagian + "?")) return;
    setPendingId(row.id);
    setNotice("");
    setError("");
    const supabase = createClient();
    const { data, error: updateError } = await supabase.from("bagian")
      .update({ aktif: !row.aktif })
      .eq("id", row.id)
      .select("id,aktif")
      .single();
    if (updateError) {
      setError(updateError.message);
    } else {
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, aktif: data.aktif } : item));
      setNotice("Status bagian berhasil diperbarui.");
    }
    setPendingId(null);
  }

  return <>
    <div className="master-page-head">
      <div><div className="eyebrow">DATA MASTER / ORGANISASI</div><h1>Master Bagian</h1><p>Kelola unit kerja yang menjadi induk data pegawai dan kegiatan.</p></div>
      <button className="master-primary-btn" onClick={openNew}><Plus size={16}/> Tambah Bagian</button>
    </div>

    <div className="master-stats-row">
      <div className="master-stat"><span className="master-stat-icon"><Building2 size={18}/></span><div><small>Total bagian</small><strong>{rows.length}</strong></div></div>
      <div className="master-stat"><span className="master-stat-icon"><CheckCircle2 size={18}/></span><div><small>Bagian aktif</small><strong>{activeCount}</strong></div></div>
      <div className="master-stat"><span className="master-stat-icon"><Users size={18}/></span><div><small>Pegawai terhubung</small><strong>{employeeCount}</strong></div></div>
    </div>

    {notice && <div className="master-feedback">{notice}</div>}
    {error && !showModal && <div className="master-feedback error">{error}</div>}
    <div className="master-toolbar">
      <label className="master-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama bagian atau instansi..."/></label>
      <div className="master-toolbar-actions"><span className="master-admin-pill">{inactiveCount} bagian nonaktif</span></div>
    </div>
    <div className="master-table-card">
      <div className="master-table-wrap">
        <table className="master-table">
          <thead><tr><th>NAMA BAGIAN</th><th>INSTANSI</th><th>JUMLAH PEGAWAI</th><th>STATUS</th><th>AKSI</th></tr></thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((row) => <tr key={row.id}>
              <td><strong>{row.nama_bagian}</strong><small>ID: {row.id.slice(0,8).toUpperCase()}</small></td>
              <td>{row.nama_instansi || <span className="muted">Belum diisi</span>}</td>
              <td>{row.jumlah_pegawai} pegawai</td>
              <td><span className={"master-status " + (row.aktif ? "is-active" : "is-inactive")}>{row.aktif ? "Aktif" : "Nonaktif"}</span></td>
              <td><div className="master-row-actions">
                <button className="master-icon-btn" title="Ubah bagian" aria-label="Ubah bagian" onClick={() => openEdit(row)}><Edit3 size={14}/></button>
                <button className="master-secondary-btn" disabled={pendingId === row.id} onClick={() => toggleActive(row)}>{pendingId === row.id ? "..." : row.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
              </div></td>
            </tr>) : <tr><td colSpan={5} className="master-empty">Tidak ada data bagian yang sesuai dengan pencarian.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="master-table-foot"><span>Menampilkan <b>{visibleRows.length}</b> dari <b>{rows.length}</b> bagian</span><span>Data tersimpan di Supabase</span></div>
    </div>

    {showModal && <div className="master-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setShowModal(false); }}>
      <section className="master-modal" role="dialog" aria-modal="true" aria-labelledby="bagian-modal-title">
        <div className="master-modal-head"><div><h2 id="bagian-modal-title">{editingId ? "Ubah Data Bagian" : "Tambah Bagian"}</h2><p>Lengkapi identitas bagian di lingkungan Sekretariat Daerah.</p></div><button className="master-modal-close" onClick={() => setShowModal(false)} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={save}>
          <div className="master-form-grid">
            <div className="master-field full"><label htmlFor="nama-bagian">Nama Bagian *</label><input id="nama-bagian" value={form.nama_bagian} onChange={(e) => setForm({ ...form, nama_bagian: e.target.value })} placeholder="Contoh: Bagian Perekonomian" required maxLength={150}/></div>
            <div className="master-field full"><label htmlFor="nama-instansi">Instansi</label><input id="nama-instansi" value={form.nama_instansi} onChange={(e) => setForm({ ...form, nama_instansi: e.target.value })} placeholder="Sekretariat Daerah" maxLength={150}/></div>
          </div>
          {error && <div className="master-form-error" role="alert">{error}</div>}
          <div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={() => setShowModal(false)} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Bagian"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
