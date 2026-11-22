"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  BadgeCheck, Building2, Check, ChevronDown, Edit3, FileSignature,
  Plus, Search, ShieldCheck, Users, Wallet, X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type EmployeeOption = {
  id: string; nama: string; nip: string; jabatan: string;
  nomenklatur_jabatan: string; bagian_id: string | null;
  aktif: boolean; eselon: string;
};
export type SectionOption = { id: string; nama: string; aktif: boolean };
export type ActivityOption = {
  id: string; kode: string; nama: string; tahun: number;
  bagian_id: string; aktif: boolean;
};
export type ManagerRecord = {
  id: string; pegawai_id: string; jenis_peran: string;
  bagian_id: string | null; kegiatan_id: string | null;
  status_penugasan: string; aktif: boolean; activity_ids: string[];
};
export type SignerRecord = {
  id: string; pegawai_id: string; jabatan_dokumen: string; aktif: boolean;
};

type ManagerRole = "PA" | "KPA" | "PPTK" | "Bendahara Pengeluaran" | "Bendahara Pengeluaran Pembantu";
type ManagerForm = {
  pegawai_id: string; jenis_peran: ManagerRole; bagian_id: string;
  activity_ids: string[]; status_penugasan: "definitif" | "plt" | "plh";
};
type SignerForm = { pegawai_id: string; jabatan_dokumen: string };

const roles: { value: ManagerRole; description: string; scope: string }[] = [
  { value: "PA", description: "Penanggung jawab anggaran untuk lingkup Sekretariat Daerah.", scope: "Setda" },
  { value: "KPA", description: "Kuasa Pengguna Anggaran yang mengikuti Bagian dari kegiatan.", scope: "Per Bagian" },
  { value: "PPTK", description: "Pelaksana teknis yang dapat ditautkan ke satu atau beberapa subkegiatan.", scope: "Per Subkegiatan" },
  { value: "Bendahara Pengeluaran", description: "Bendahara Pengeluaran pada lingkup Sekretariat Daerah.", scope: "Setda" },
  { value: "Bendahara Pengeluaran Pembantu", description: "Bendahara pembantu pada Bagian terkait.", scope: "Per Bagian" }
];

const emptyManager: ManagerForm = {
  pegawai_id: "", jenis_peran: "PA", bagian_id: "", activity_ids: [], status_penugasan: "definitif"
};

function employeeName(id: string, employees: EmployeeOption[]) {
  const item = employees.find((employee) => employee.id === id);
  return item?.nama ?? "Pegawai tidak ditemukan";
}
function sectionName(id: string | null, sections: SectionOption[]) {
  return sections.find((section) => section.id === id)?.nama ?? "Bagian belum ditentukan";
}
function statusText(status: string) {
  return status === "plt" ? "Plt." : status === "plh" ? "Plh." : "Definitif";
}

export default function PengelolaClient({
  initialManagers, initialSigners, employees, sections, activities
}: {
  initialManagers: ManagerRecord[];
  initialSigners: SignerRecord[];
  employees: EmployeeOption[];
  sections: SectionOption[];
  activities: ActivityOption[];
}) {
  const [managers, setManagers] = useState(initialManagers);
  const [signers, setSigners] = useState(initialSigners);
  const [tab, setTab] = useState<"pengelola" | "penandatangan">("pengelola");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modal, setModal] = useState<"manager" | "signer" | null>(null);
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [editingSignerId, setEditingSignerId] = useState<string | null>(null);
  const [managerForm, setManagerForm] = useState<ManagerForm>(emptyManager);
  const [signerForm, setSignerForm] = useState<SignerForm>({ pegawai_id: "", jabatan_dokumen: "" });
  const [activitySearch, setActivitySearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [pageError, setPageError] = useState("");

  const visibleManagers = useMemo(() => managers.filter((row) => {
    const name = employeeName(row.pegawai_id, employees).toLowerCase();
    const role = row.jenis_peran.toLowerCase();
    const scope = sectionName(row.bagian_id, sections).toLowerCase();
    const activityText = row.activity_ids.map((id) => activities.find((a) => a.id === id)?.nama ?? "").join(" ");
    const text = (name + " " + role + " " + scope + " " + activityText).toLowerCase();
    return text.includes(search.toLowerCase()) && (roleFilter === "all" || row.jenis_peran === roleFilter);
  }), [managers, employees, sections, activities, search, roleFilter]);

  const eligibleSigners = employees.filter((employee) => {
    const senior = employee.eselon.startsWith("II") || employee.eselon.startsWith("III");
    const alreadyAssigned = signers.some((signer) => signer.pegawai_id === employee.id);
    return (employee.aktif && senior) || alreadyAssigned;
  });
  const activeManagerCount = managers.filter((row) => row.aktif).length;
  const activeSignerCount = signers.filter((row) => row.aktif).length;

  function openNewManager() {
    setEditingManagerId(null);
    setManagerForm({ ...emptyManager });
    setActivitySearch("");
    setFormError("");
    setModal("manager");
  }
  function openEditManager(row: ManagerRecord) {
    setEditingManagerId(row.id);
    setManagerForm({
      pegawai_id: row.pegawai_id,
      jenis_peran: row.jenis_peran as ManagerRole,
      bagian_id: row.bagian_id ?? "",
      activity_ids: [...row.activity_ids],
      status_penugasan: row.status_penugasan as ManagerForm["status_penugasan"]
    });
    setActivitySearch("");
    setFormError("");
    setModal("manager");
  }
  function openNewSigner() {
    setEditingSignerId(null);
    setSignerForm({ pegawai_id: "", jabatan_dokumen: "" });
    setFormError("");
    setModal("signer");
  }
  function openEditSigner(row: SignerRecord) {
    setEditingSignerId(row.id);
    setSignerForm({ pegawai_id: row.pegawai_id, jabatan_dokumen: row.jabatan_dokumen });
    setFormError("");
    setModal("signer");
  }

  const isSectionRole = managerForm.jenis_peran === "KPA" || managerForm.jenis_peran === "Bendahara Pengeluaran Pembantu";
  const isActivityRole = managerForm.jenis_peran === "PPTK";
  const selectedActivitySections = Array.from(new Set(
    managerForm.activity_ids.map((id) => activities.find((item) => item.id === id)?.bagian_id).filter(Boolean)
  ));
  const requiredEmployeeSection = isSectionRole ? managerForm.bagian_id : (isActivityRole && selectedActivitySections.length === 1 ? selectedActivitySections[0] as string : "");
  const employeeOptions = employees.filter((employee) => {
    if (!employee.aktif && employee.id !== managerForm.pegawai_id) return false;
    if (requiredEmployeeSection && employee.bagian_id !== requiredEmployeeSection) return false;
    return true;
  });
  const visibleActivities = activities.filter((activity) =>
    activity.aktif &&
    (activity.kode + " " + activity.nama + " " + sectionName(activity.bagian_id, sections)).toLowerCase().includes(activitySearch.toLowerCase())
  );

  function updateManagerRole(role: ManagerRole) {
    setManagerForm({
      ...emptyManager,
      jenis_peran: role,
      status_penugasan: managerForm.status_penugasan
    });
  }

  function toggleActivity(id: string, checked: boolean) {
    setManagerForm((current) => ({
      ...current,
      activity_ids: checked
        ? [...current.activity_ids, id]
        : current.activity_ids.filter((item) => item !== id),
      pegawai_id: ""
    }));
  }

  async function saveManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setPageError("");
    const role = managerForm.jenis_peran;
    const employee = employees.find((item) => item.id === managerForm.pegawai_id);
    if (!employee || (!employee.aktif && employee.id !== managers.find((row) => row.id === editingManagerId)?.pegawai_id)) {
      setFormError("Pilih pegawai yang masih aktif.");
      return;
    }

    let bagianId: string | null = null;
    let kegiatanId: string | null = null;
    if (isSectionRole) {
      if (!managerForm.bagian_id) { setFormError("Pilih Bagian untuk penugasan ini."); return; }
      if (employee.bagian_id !== managerForm.bagian_id) {
        setFormError("Pegawai yang dipilih harus berasal dari Bagian yang sama.");
        return;
      }
      bagianId = managerForm.bagian_id;
    } else if (isActivityRole) {
      if (managerForm.activity_ids.length === 0) { setFormError("Pilih sekurang-kurangnya satu subkegiatan untuk PPTK."); return; }
      const activitySections = Array.from(new Set(managerForm.activity_ids.map((id) => activities.find((item) => item.id === id)?.bagian_id).filter(Boolean)));
      if (activitySections.length !== 1) {
        setFormError("Satu penugasan PPTK hanya dapat menghubungkan subkegiatan dalam Bagian yang sama.");
        return;
      }
      if (employee.bagian_id !== activitySections[0]) {
        setFormError("Bagian pegawai harus sama dengan Bagian subkegiatan yang ditangani.");
        return;
      }
      kegiatanId = managerForm.activity_ids[0];
    }

    const duplicate = managers.find((row) => {
      if (!row.aktif || row.id === editingManagerId || row.jenis_peran !== role) return false;
      if (role === "PPTK") {
        return managerForm.activity_ids.some((id) => row.activity_ids.includes(id)) && row.pegawai_id !== employee.id;
      }
      if (isSectionRole) return row.bagian_id === bagianId;
      return true;
    });
    if (duplicate) {
      setFormError(role === "PPTK"
        ? "Salah satu subkegiatan sudah memiliki PPTK lain yang aktif."
        : isSectionRole ? "Peran tersebut sudah memiliki pejabat aktif pada Bagian ini." : "Peran tersebut sudah memiliki pejabat aktif pada lingkup Setda.");
      return;
    }

    const payload = {
      pegawai_id: employee.id,
      jenis_peran: role,
      bagian_id: bagianId,
      kegiatan_id: kegiatanId,
      status_penugasan: managerForm.status_penugasan
    };
    const supabase = createClient();
    setBusy(true);
    try {
      if (editingManagerId) {
        const previous = managers.find((row) => row.id === editingManagerId);
        const { error: updateError } = await supabase.from("pejabat_pengelola")
          .update(payload).eq("id", editingManagerId);
        if (updateError) throw updateError;

        const oldIds = previous?.activity_ids ?? [];
        if (role === "PPTK") {
          const additions = managerForm.activity_ids.filter((id) => !oldIds.includes(id));
          if (additions.length) {
            const { error: addError } = await supabase.from("pejabat_pengelola_kegiatan")
              .insert(additions.map((kegiatan_id) => ({ pejabat_pengelola_id: editingManagerId, kegiatan_id })));
            if (addError) throw addError;
          }
          const removals = oldIds.filter((id) => !managerForm.activity_ids.includes(id));
          for (const id of removals) {
            const { error: removeError } = await supabase.from("pejabat_pengelola_kegiatan")
              .delete().eq("pejabat_pengelola_id", editingManagerId).eq("kegiatan_id", id);
            if (removeError) throw removeError;
          }
        } else if (oldIds.length) {
          const { error: removeError } = await supabase.from("pejabat_pengelola_kegiatan")
            .delete().eq("pejabat_pengelola_id", editingManagerId);
          if (removeError) throw removeError;
        }

        setManagers((current) => current.map((row) => row.id === editingManagerId ? {
          ...row, ...payload, status_penugasan: managerForm.status_penugasan,
          activity_ids: role === "PPTK" ? [...managerForm.activity_ids] : []
        } : row));
        setNotice("Penugasan pejabat berhasil diperbarui.");
      } else {
        const { data, error: insertError } = await supabase.from("pejabat_pengelola")
          .insert({ ...payload, aktif: true })
          .select("id")
          .single();
        if (insertError) throw insertError;
        if (role === "PPTK") {
          const { error: mapError } = await supabase.from("pejabat_pengelola_kegiatan")
            .insert(managerForm.activity_ids.map((kegiatan_id) => ({ pejabat_pengelola_id: data.id, kegiatan_id })));
          if (mapError) {
            await supabase.from("pejabat_pengelola").delete().eq("id", data.id);
            throw mapError;
          }
        }
        setManagers((current) => [...current, {
          id: data.id, ...payload, aktif: true, activity_ids: role === "PPTK" ? [...managerForm.activity_ids] : []
        }]);
        setNotice("Penugasan pejabat berhasil ditambahkan.");
      }
      setModal(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan penugasan. Periksa hak akses dan relasi data.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleManager(row: ManagerRecord) {
    if (!window.confirm("Yakin " + (row.aktif ? "menonaktifkan" : "mengaktifkan") + " penugasan " + row.jenis_peran + " untuk " + employeeName(row.pegawai_id, employees) + "?")) return;
    setPendingId(row.id);
    setPageError("");
    const supabase = createClient();
    const { data, error } = await supabase.from("pejabat_pengelola")
      .update({ aktif: !row.aktif }).eq("id", row.id).select("aktif").single();
    if (error) setPageError(error.message);
    else {
      setManagers((current) => current.map((item) => item.id === row.id ? { ...item, aktif: data.aktif } : item));
      setNotice("Status penugasan berhasil diperbarui.");
    }
    setPendingId(null);
  }

  async function saveSigner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const employee = employees.find((item) => item.id === signerForm.pegawai_id);
    if (!employee) { setFormError("Pilih pegawai sebagai penandatangan SP."); return; }
    if (!signerForm.jabatan_dokumen.trim()) { setFormError("Jabatan untuk dokumen wajib diisi."); return; }
    const duplicate = signers.some((row) => row.pegawai_id === employee.id && row.id !== editingSignerId && row.aktif);
    if (duplicate) { setFormError("Pegawai tersebut sudah tercatat sebagai penandatangan SP aktif."); return; }

    const supabase = createClient();
    setBusy(true);
    try {
      const payload = {
        pegawai_id: employee.id,
        jenis_peran: "penandatangan_sp",
        jabatan_dokumen: signerForm.jabatan_dokumen.trim()
      };
      if (editingSignerId) {
        const { error } = await supabase.from("pejabat_dokumen").update(payload).eq("id", editingSignerId);
        if (error) throw error;
        setSigners((current) => current.map((row) => row.id === editingSignerId ? { ...row, ...payload } : row));
        setNotice("Data penandatangan SP berhasil diperbarui.");
      } else {
        const { data, error } = await supabase.from("pejabat_dokumen")
          .insert({ ...payload, aktif: true }).select("id").single();
        if (error) throw error;
        setSigners((current) => [...current, { id: data.id, ...payload, aktif: true }]);
        setNotice("Penandatangan SP berhasil ditambahkan.");
      }
      setModal(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan penandatangan. Periksa hak akses.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSigner(row: SignerRecord) {
    if (!window.confirm("Yakin " + (row.aktif ? "menonaktifkan" : "mengaktifkan") + " penandatangan " + employeeName(row.pegawai_id, employees) + "?")) return;
    setPendingId(row.id);
    setPageError("");
    const supabase = createClient();
    const { data, error } = await supabase.from("pejabat_dokumen")
      .update({ aktif: !row.aktif }).eq("id", row.id).select("aktif").single();
    if (error) setPageError(error.message);
    else {
      setSigners((current) => current.map((item) => item.id === row.id ? { ...item, aktif: data.aktif } : item));
      setNotice("Status penandatangan berhasil diperbarui.");
    }
    setPendingId(null);
  }

  function closeModal() {
    if (!busy) setModal(null);
  }

  return <>
    <div className="master-page-head">
      <div><div className="eyebrow">DATA MASTER / TATA KELOLA</div><h1>Pejabat & Pengelola</h1><p>Atur pejabat pengelola anggaran dan daftar penandatangan dokumen perjalanan dinas.</p></div>
      {tab === "pengelola"
        ? <button className="master-primary-btn" onClick={openNewManager}><Plus size={16}/> Tambah Penugasan</button>
        : <button className="master-primary-btn" onClick={openNewSigner}><Plus size={16}/> Tambah Penandatangan SP</button>}
    </div>

    <div className="official-tabs">
      <button className={tab === "pengelola" ? "active" : ""} onClick={() => { setTab("pengelola"); setNotice(""); setPageError(""); }}><Users size={15}/> Pejabat Pengelola</button>
      <button className={tab === "penandatangan" ? "active" : ""} onClick={() => { setTab("penandatangan"); setNotice(""); setPageError(""); }}><FileSignature size={15}/> Penandatangan SP & SPPD</button>
    </div>

    <div className="official-overview">
      <div className="master-stat"><span className="master-stat-icon"><Users size={18}/></span><div><small>Penugasan aktif</small><strong>{activeManagerCount}</strong></div></div>
      <div className="master-stat"><span className="master-stat-icon"><FileSignature size={18}/></span><div><small>Penandatangan SP aktif</small><strong>{activeSignerCount}</strong></div></div>
      <div className="master-stat"><span className="master-stat-icon"><Building2 size={18}/></span><div><small>Bagian terdaftar</small><strong>{sections.length}</strong></div></div>
    </div>

    {notice && <div className="master-feedback">{notice}</div>}
    {pageError && <div className="master-feedback error">{pageError}</div>}

    {tab === "pengelola" ? <>
      <div className="official-section-intro">
        <div><h2>Susunan pejabat pengelola</h2><p>Penempatan mengikuti cakupan yang ditetapkan pada struktur database.</p></div>
        <span className="official-hint"><ShieldCheck size={14}/> Hanya Admin Global</span>
      </div>
      <div className="master-toolbar">
        <label className="master-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama pegawai, peran, bagian, atau subkegiatan..."/></label>
        <div className="master-toolbar-actions">
          <select className="master-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter peran pejabat">
            <option value="all">Semua Peran</option>{roles.map((role) => <option key={role.value} value={role.value}>{role.value}</option>)}
          </select>
        </div>
      </div>
      <div className="master-table-card">
        <div className="master-table-wrap">
          <table className="master-table official-table">
            <thead><tr><th>PEGAWAI</th><th>PERAN</th><th>LINGKUP PENUGASAN</th><th>STATUS PENUGASAN</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody>{visibleManagers.length ? visibleManagers.map((row) => {
              const person = employees.find((employee) => employee.id === row.pegawai_id);
              const scope = row.jenis_peran === "PPTK"
                ? row.activity_ids.map((id) => activities.find((activity) => activity.id === id)?.nama ?? "Subkegiatan tidak ditemukan").join(", ")
                : (row.jenis_peran === "KPA" || row.jenis_peran === "Bendahara Pengeluaran Pembantu")
                  ? sectionName(row.bagian_id, sections)
                  : "Sekretariat Daerah";
              return <tr key={row.id}>
                <td><strong>{person?.nama ?? "Pegawai tidak ditemukan"}</strong><small>{person?.nip || "NIP belum diisi"}{person?.eselon ? " · Eselon " + person.eselon : ""}</small></td>
                <td><span className={"official-role role-" + row.jenis_peran.toLowerCase().replaceAll(" ", "-")}>{row.jenis_peran}</span></td>
                <td className="official-scope">{scope}</td>
                <td>{statusText(row.status_penugasan)}</td>
                <td><span className={"master-status " + (row.aktif ? "is-active" : "is-inactive")}>{row.aktif ? "Aktif" : "Nonaktif"}</span></td>
                <td><div className="master-row-actions"><button className="master-icon-btn" title="Ubah penugasan" aria-label="Ubah penugasan" onClick={() => openEditManager(row)}><Edit3 size={14}/></button><button className="master-secondary-btn" disabled={pendingId === row.id} onClick={() => toggleManager(row)}>{pendingId === row.id ? "..." : row.aktif ? "Nonaktifkan" : "Aktifkan"}</button></div></td>
              </tr>;
            }) : <tr><td colSpan={6} className="master-empty">Belum ada penugasan yang sesuai.</td></tr>}</tbody>
          </table>
        </div>
        <div className="master-table-foot"><span>Menampilkan <b>{visibleManagers.length}</b> dari <b>{managers.length}</b> penugasan</span><span>Data pejabat pengelola dari Supabase</span></div>
      </div>
      <div className="official-info-grid">
        <article className="official-info-card"><span><Building2 size={17}/></span><div><b>KPA dan Bendahara Pembantu</b><p>Ditentukan per Bagian. KPA untuk perjalanan dinas akan mengikuti Bagian dari kegiatan yang dipilih.</p></div></article>
        <article className="official-info-card"><span><Wallet size={17}/></span><div><b>PA dan Bendahara Pengeluaran</b><p>Dicatat pada lingkup Sekretariat Daerah, sesuai aturan cakupan pada database saat ini.</p></div></article>
        <article className="official-info-card"><span><BadgeCheck size={17}/></span><div><b>PPTK</b><p>Satu pegawai dapat ditugaskan ke beberapa subkegiatan dalam Bagian yang sama.</p></div></article>
      </div>
    </> : <>
      <div className="official-section-intro">
        <div><h2>Penandatangan dokumen</h2><p>Kelola daftar pejabat yang dapat dipilih sebagai penandatangan Surat Perintah.</p></div>
      </div>
      <div className="signer-list">
        {signers.length ? signers.map((row) => {
          const person = employees.find((employee) => employee.id === row.pegawai_id);
          return <article className="signer-card" key={row.id}>
            <div className="signer-avatar">{(person?.nama ?? "P").trim().slice(0,1).toUpperCase()}</div>
            <div className="signer-main"><div className="signer-name-row"><b>{person?.nama ?? "Pegawai tidak ditemukan"}</b><span className={"master-status " + (row.aktif ? "is-active" : "is-inactive")}>{row.aktif ? "Aktif" : "Nonaktif"}</span></div><small>{person?.nip || "NIP belum diisi"}{person?.eselon ? " · Eselon " + person.eselon : ""}</small><p>{row.jabatan_dokumen}</p></div>
            <div className="master-row-actions"><button className="master-icon-btn" title="Ubah penandatangan" aria-label="Ubah penandatangan" onClick={() => openEditSigner(row)}><Edit3 size={14}/></button><button className="master-secondary-btn" disabled={pendingId === row.id} onClick={() => toggleSigner(row)}>{pendingId === row.id ? "..." : row.aktif ? "Nonaktifkan" : "Aktifkan"}</button></div>
          </article>;
        }) : <div className="master-empty">Belum ada daftar penandatangan SP.</div>}
      </div>
      <section className="sppd-kpa-note">
        <div className="sppd-kpa-icon"><ShieldCheck size={18}/></div>
        <div><b>Penandatangan SPPD mengikuti KPA kegiatan</b><p>Nama KPA ditentukan otomatis berdasarkan Bagian dari subkegiatan yang dipilih. Tidak ada pengaturan atau pilihan penandatangan SPPD secara manual pada form perjalanan.</p>
          <div className="sppd-kpa-list">{sections.filter((section) => section.aktif).map((section) => {
            const kpa = managers.find((row) => row.aktif && row.jenis_peran === "KPA" && row.bagian_id === section.id);
            return <div key={section.id}><span>{section.nama}</span><strong>{kpa ? employeeName(kpa.pegawai_id, employees) : "KPA belum ditetapkan"}</strong></div>;
          })}</div>
        </div>
      </section>
      <div className="official-signer-caption"><ShieldCheck size={14}/> Daftar penandatangan SP hanya menampilkan pegawai aktif dengan referensi jabatan eselon II/III serta pejabat yang sudah terdaftar.</div>
    </>}

    {modal === "manager" && <div className="master-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <section className="master-modal official-modal" role="dialog" aria-modal="true" aria-labelledby="manager-modal-title">
        <div className="master-modal-head"><div><h2 id="manager-modal-title">{editingManagerId ? "Ubah Penugasan Pejabat" : "Tambah Penugasan Pejabat"}</h2><p>Tetapkan pegawai dan cakupan tugas sesuai peran.</p></div><button className="master-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={saveManager}>
          <div className="master-form-grid">
            <div className="master-field full"><label htmlFor="manager-role">Jenis peran *</label><select id="manager-role" value={managerForm.jenis_peran} onChange={(e) => updateManagerRole(e.target.value as ManagerRole)}>{roles.map((role) => <option value={role.value} key={role.value}>{role.value} — {role.scope}</option>)}</select><span className="field-hint">{roles.find((role) => role.value === managerForm.jenis_peran)?.description}</span></div>
            {isSectionRole && <div className="master-field full"><label htmlFor="manager-section">Bagian *</label><select id="manager-section" value={managerForm.bagian_id} onChange={(e) => setManagerForm({ ...managerForm, bagian_id: e.target.value, pegawai_id: "" })} required><option value="">Pilih bagian</option>{sections.filter((item) => item.aktif || item.id === managerForm.bagian_id).map((item) => <option value={item.id} key={item.id}>{item.nama}{!item.aktif ? " (nonaktif)" : ""}</option>)}</select><span className="field-hint">Pejabat yang dipilih harus berasal dari Bagian ini.</span></div>}
            {isActivityRole && <div className="master-field full"><label>Subkegiatan yang ditangani *</label><div className="official-activity-picker"><label className="master-search"><Search size={14}/><input value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} placeholder="Cari kode atau nama subkegiatan..."/></label><div className="official-activity-list">{visibleActivities.map((activity) => <label className="official-activity-option" key={activity.id}><input type="checkbox" checked={managerForm.activity_ids.includes(activity.id)} onChange={(e) => toggleActivity(activity.id, e.target.checked)}/><span><b>{activity.nama}</b><small>{activity.kode || "Kode belum diisi"} · {activity.tahun} · {sectionName(activity.bagian_id, sections)}</small></span></label>)}</div><span className="field-hint">{managerForm.activity_ids.length} subkegiatan dipilih. Semua subkegiatan harus berasal dari Bagian yang sama.</span></div></div>}
            <div className="master-field full"><label htmlFor="manager-employee">Nama pegawai *</label><select id="manager-employee" value={managerForm.pegawai_id} onChange={(e) => setManagerForm({ ...managerForm, pegawai_id: e.target.value })} required><option value="">Pilih pegawai</option>{employeeOptions.map((employee) => <option value={employee.id} key={employee.id}>{employee.nama} — {employee.nip || "Tanpa NIP"}</option>)}</select>{requiredEmployeeSection && <span className="field-hint">Daftar pegawai difilter berdasarkan Bagian yang dipilih.</span>}</div>
            <div className="master-field full"><label htmlFor="manager-status">Status penugasan *</label><select id="manager-status" value={managerForm.status_penugasan} onChange={(e) => setManagerForm({ ...managerForm, status_penugasan: e.target.value as ManagerForm["status_penugasan"] })}><option value="definitif">Definitif</option><option value="plt">Plt.</option><option value="plh">Plh.</option></select></div>
          </div>
          {formError && <div className="master-form-error" role="alert">{formError}</div>}
          <div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={closeModal} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Penugasan"}</button></div>
        </form>
      </section>
    </div>}

    {modal === "signer" && <div className="master-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <section className="master-modal official-modal" role="dialog" aria-modal="true" aria-labelledby="signer-modal-title">
        <div className="master-modal-head"><div><h2 id="signer-modal-title">{editingSignerId ? "Ubah Penandatangan SP" : "Tambah Penandatangan SP"}</h2><p>Daftarkan pejabat yang dapat dipilih ketika draf Surat Perintah dibuat.</p></div><button className="master-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={saveSigner}>
          <div className="master-form-grid">
            <div className="master-field full"><label htmlFor="signer-employee">Nama pegawai *</label><select id="signer-employee" value={signerForm.pegawai_id} onChange={(e) => {
              const employee = employees.find((item) => item.id === e.target.value);
              setSignerForm({ pegawai_id: e.target.value, jabatan_dokumen: employee ? (employee.nomenklatur_jabatan || employee.jabatan) : "" });
            }} required><option value="">Pilih pejabat</option>{eligibleSigners.map((employee) => <option value={employee.id} key={employee.id}>{employee.nama} — {employee.eselon ? "Eselon " + employee.eselon : "Pejabat terdaftar"}</option>)}</select><span className="field-hint">Pilihan utama berasal dari pegawai dengan eselon II/III.</span></div>
            <div className="master-field full"><label htmlFor="signer-title">Jabatan pada dokumen *</label><input id="signer-title" value={signerForm.jabatan_dokumen} onChange={(e) => setSignerForm({ ...signerForm, jabatan_dokumen: e.target.value })} placeholder="Contoh: a.n. Sekretaris Daerah, Asisten ..." maxLength={180} required/><span className="field-hint">Teks ini digunakan sebagai snapshot jabatan untuk dokumen SP.</span></div>
          </div>
          {formError && <div className="master-form-error" role="alert">{formError}</div>}
          <div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={closeModal} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Penandatangan"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
