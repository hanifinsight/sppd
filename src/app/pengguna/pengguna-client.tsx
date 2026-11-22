"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  KeyRound, Search, UserPlus, Users, UserRound, ShieldCheck, Edit3, X, LockKeyhole
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type AccountRecord = {
  id: string; username: string; role: string; pegawai_id: string | null;
  nama_pegawai: string; nip: string; bagian_id: string | null; nama_bagian: string;
  pegawai_aktif: boolean; kegiatan_id: string | null; nama_kegiatan: string;
  kode_kegiatan: string; tahun_anggaran: number | null; kegiatan_aktif: boolean;
  aktif: boolean; must_change_password: boolean; created_at: string;
};
export type EmployeeOption = {
  id: string; nama: string; nip: string; bagian_id: string;
  nama_bagian: string; aktif: boolean;
};
export type ActivityOption = {
  id: string; bagian_id: string; kode: string; nama: string;
  tahun: number; aktif: boolean; nama_bagian: string;
};

type ModalState =
  | { type: "create" }
  | { type: "assignment"; account: AccountRecord }
  | { type: "password"; account: AccountRecord }
  | null;

async function invokeAdmin(body: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("admin-operator-management", { body });
  if (error) {
    let message = error.message || "Permintaan Admin gagal.";
    const context = (error as unknown as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.json() as { error?: string };
        if (payload.error) message = payload.error;
      } catch { /* Keep the function error message. */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data;
}

const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", {
  day: "2-digit", month: "short", year: "numeric"
}).format(new Date(value));

export default function PenggunaClient({
  initialAccounts, employees, activities
}: {
  initialAccounts: AccountRecord[];
  employees: EmployeeOption[];
  activities: ActivityOption[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [createForm, setCreateForm] = useState({ username: "", password: "", kegiatan_id: "" });
  const [assignmentId, setAssignmentId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [pageError, setPageError] = useState("");

  const admins = accounts.filter((row) => row.role === "admin");
  const operators = accounts.filter((row) => row.role === "operator");
  const activeOperators = operators.filter((row) => row.aktif).length;
  const availableEmployees = employees.filter((employee) =>
    employee.aktif && !accounts.some((account) => account.pegawai_id === employee.id)
  );
  const employee = employees.find((row) => row.id === selectedEmployee);
  const eligibleActivities = activities.filter((activity) =>
    activity.aktif && employee && activity.bagian_id === employee.bagian_id
  );
  const assignmentActivities = activities.filter((activity) =>
    activity.aktif && modal?.type === "assignment" && activity.bagian_id === modal.account.bagian_id
  );

  const filteredOperators = useMemo(() => operators.filter((row) => {
    const text = (row.nama_pegawai + " " + row.nip + " " + row.username + " " +
      row.nama_bagian + " " + row.nama_kegiatan + " " + row.kode_kegiatan).toLowerCase();
    const matchStatus = statusFilter === "all" ||
      (statusFilter === "active" && row.aktif) ||
      (statusFilter === "inactive" && !row.aktif);
    return text.includes(search.toLowerCase()) && matchStatus;
  }), [operators, search, statusFilter]);

  const filterActivities = (items: ActivityOption[]) => items.sort((a,b) =>
    b.tahun-a.tahun || a.nama.localeCompare(b.nama, "id")
  );

  function clearFeedback() { setNotice(""); setPageError(""); setFormError(""); }
  function openCreate() {
    clearFeedback();
    setSelectedEmployee("");
    setCreateForm({ username: "", password: "", kegiatan_id: "" });
    setModal({ type: "create" });
  }
  function closeModal() {
    if (busy) return;
    setModal(null); setFormError(""); setNewPassword(""); setConfirmPassword("");
  }

  async function createOperator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    const chosen = employees.find((row) => row.id === selectedEmployee);
    if (!chosen || !chosen.aktif) { setFormError("Pilih pegawai aktif."); return; }
    if (!createForm.kegiatan_id) { setFormError("Pilih satu subkegiatan untuk operator."); return; }
    if (!createForm.username.trim()) { setFormError("Username wajib diisi."); return; }
    if (createForm.password.length < 8) { setFormError("Password awal minimal 8 karakter."); return; }
    if (createForm.password !== confirmPassword) { setFormError("Konfirmasi password tidak sama."); return; }

    setBusy(true);
    try {
      const result = await invokeAdmin({
        action: "create_operator",
        username: createForm.username.trim().toLowerCase(),
        password: createForm.password,
        pegawai_id: chosen.id,
        kegiatan_id: createForm.kegiatan_id
      });
      const activity = activities.find((row) => row.id === createForm.kegiatan_id);
      setAccounts((current) => [...current, {
        id: String(result?.user?.id ?? "new-" + chosen.id),
        username: createForm.username.trim().toLowerCase(),
        role: "operator",
        pegawai_id: chosen.id,
        nama_pegawai: chosen.nama,
        nip: chosen.nip,
        bagian_id: chosen.bagian_id,
        nama_bagian: chosen.nama_bagian,
        pegawai_aktif: chosen.aktif,
        kegiatan_id: activity?.id ?? null,
        nama_kegiatan: activity?.nama ?? "Belum ditugaskan",
        kode_kegiatan: activity?.kode ?? "",
        tahun_anggaran: activity?.tahun ?? null,
        kegiatan_aktif: activity?.aktif ?? false,
        aktif: true,
        must_change_password: false,
        created_at: new Date().toISOString()
      }]);
      setNotice("Akun operator berhasil dibuat. Username: " + createForm.username.trim().toLowerCase());
      setModal(null);
      setCreateForm({ username: "", password: "", kegiatan_id: "" });
      setConfirmPassword("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Gagal membuat akun operator.");
    } finally { setBusy(false); }
  }

  function openAssignment(row: AccountRecord) {
    clearFeedback();
    setAssignmentId(row.kegiatan_id ?? "");
    setModal({ type: "assignment", account: row });
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== "assignment") return;
    clearFeedback();
    if (!assignmentId) { setFormError("Pilih subkegiatan."); return; }
    setBusy(true);
    try {
      await invokeAdmin({ action: "update_assignment", user_id: modal.account.id, kegiatan_id: assignmentId });
      const activity = activities.find((row) => row.id === assignmentId);
      setAccounts((current) => current.map((row) => row.id === modal.account.id ? {
        ...row, kegiatan_id: assignmentId, nama_kegiatan: activity?.nama ?? "Kegiatan",
        kode_kegiatan: activity?.kode ?? "", tahun_anggaran: activity?.tahun ?? null,
        kegiatan_aktif: activity?.aktif ?? false
      } : row));
      setNotice("Penugasan kegiatan operator berhasil diperbarui.");
      setModal(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Gagal memperbarui kegiatan operator.");
    } finally { setBusy(false); }
  }

  async function toggleAccount(row: AccountRecord) {
    const next = !row.aktif;
    const prompt = next ? "mengaktifkan" : "menonaktifkan";
    if (!window.confirm("Yakin " + prompt + " akun " + row.username + " (" + row.nama_pegawai + ")?")) return;
    setPendingId(row.id); clearFeedback();
    try {
      await invokeAdmin({ action: "set_active", user_id: row.id, aktif: next });
      setAccounts((current) => current.map((item) => item.id === row.id ? { ...item, aktif: next } : item));
      setNotice("Status akun " + row.username + " berhasil diperbarui.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Gagal mengubah status akun.");
    } finally { setPendingId(null); }
  }

  function openPassword(row: AccountRecord) {
    clearFeedback();
    setNewPassword("");
    setConfirmPassword("");
    setModal({ type: "password", account: row });
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== "password") return;
    clearFeedback();
    if (newPassword.length < 8) { setFormError("Password baru minimal 8 karakter."); return; }
    if (newPassword !== confirmPassword) { setFormError("Konfirmasi password tidak sama."); return; }
    setBusy(true);
    try {
      await invokeAdmin({ action: "reset_password", user_id: modal.account.id, password: newPassword });
      setNotice("Password akun " + modal.account.username + " berhasil direset. Sampaikan password baru melalui jalur yang aman.");
      setModal(null);
      setNewPassword(""); setConfirmPassword("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Gagal mereset password.");
    } finally { setBusy(false); }
  }

  return <>
    <div className="master-page-head">
      <div><div className="eyebrow">ADMINISTRASI / AKSES APLIKASI</div><h1>Manajemen Pengguna</h1><p>Kelola akun operator, penempatan pegawai, dan batas akses subkegiatan.</p></div>
      <button className="master-primary-btn" onClick={openCreate} disabled={availableEmployees.length === 0}><UserPlus size={16}/> Buat Akun Operator</button>
    </div>

    <div className="user-summary-grid">
      <article className="user-summary-card"><span className="user-summary-icon"><Users size={18}/></span><div><small>Total akun</small><strong>{accounts.length}</strong></div></article>
      <article className="user-summary-card"><span className="user-summary-icon"><UserRound size={18}/></span><div><small>Operator aktif</small><strong>{activeOperators}</strong></div></article>
      <article className="user-summary-card"><span className="user-summary-icon"><ShieldCheck size={18}/></span><div><small>Admin global</small><strong>{admins.length}</strong></div></article>
      <article className="user-summary-card"><span className="user-summary-icon"><UserPlus size={18}/></span><div><small>Pegawai belum punya akun</small><strong>{availableEmployees.length}</strong></div></article>
    </div>

    {notice && <div className="master-feedback">{notice}</div>}
    {pageError && <div className="master-feedback error">{pageError}</div>}

    <section className="user-admin-card">
      <div className="user-admin-icon"><ShieldCheck size={18}/></div>
      <div className="user-admin-content"><div className="user-admin-title"><b>Akun Admin Global</b><span className="master-status is-active">Aktif</span></div>
        <p>Akun dengan kewenangan pengelolaan seluruh Bagian, pegawai, pejabat, kegiatan, anggaran, dan pengguna.</p>
        <div className="user-admin-tags">{admins.map((row) => <span key={row.id}><b>{row.username}</b> · {row.nama_pegawai}</span>)}</div>
      </div>
    </section>

    <div className="user-section-head"><div><h2>Akun Operator</h2><p>Setiap operator terhubung ke satu pegawai dan satu subkegiatan sesuai Bagian pegawai.</p></div><span className="user-count-pill">{operators.length} akun</span></div>

    <div className="master-toolbar">
      <label className="master-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, NIP, username, atau kegiatan..."/></label>
      <div className="master-toolbar-actions"><select className="master-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status"><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></div>
    </div>

    <div className="master-table-card">
      <div className="master-table-wrap"><table className="master-table user-table">
        <thead><tr><th>PEGAWAI / USERNAME</th><th>BAGIAN</th><th>KEGIATAN YANG DIAKSES</th><th>STATUS AKUN</th><th>DIBUAT</th><th>AKSI</th></tr></thead>
        <tbody>{filteredOperators.length ? filteredOperators.map((row) => <tr key={row.id}>
          <td><strong>{row.nama_pegawai}</strong><small>{row.nip || "NIP belum diisi"}</small><span className="user-username">@{row.username}</span></td>
          <td>{row.nama_bagian}</td>
          <td><strong className="user-activity-name">{row.nama_kegiatan}</strong><small>{row.kode_kegiatan || (row.kegiatan_id ? "" : "Belum ditugaskan")}{row.tahun_anggaran ? " · " + row.tahun_anggaran : ""}</small></td>
          <td><span className={"master-status " + (row.aktif ? "is-active" : "is-inactive")}>{row.aktif ? "Aktif" : "Nonaktif"}</span>{!row.pegawai_aktif && <small className="user-alert-text">Pegawai nonaktif</small>}</td>
          <td>{dateLabel(row.created_at)}</td>
          <td><div className="master-row-actions user-actions">
            <button className="master-icon-btn" title="Ubah kegiatan" aria-label="Ubah kegiatan" onClick={() => openAssignment(row)}><Edit3 size={14}/></button>
            <button className="master-icon-btn" title="Reset password" aria-label="Reset password" onClick={() => openPassword(row)}><KeyRound size={14}/></button>
            <button className="master-secondary-btn" disabled={pendingId === row.id} onClick={() => toggleAccount(row)}>{pendingId === row.id ? "..." : row.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
          </div></td>
        </tr>) : <tr><td colSpan={6} className="master-empty">Belum ada akun operator yang sesuai filter.</td></tr>}</tbody>
      </table></div>
      <div className="master-table-foot"><span>Menampilkan <b>{filteredOperators.length}</b> dari <b>{operators.length}</b> operator</span><span>Akun login menggunakan username, bukan email.</span></div>
    </div>

    <div className="user-access-note">
      <div><LockKeyhole size={17}/></div>
      <p><b>Batas akses saat ini</b><br/>Satu akun operator hanya dapat ditugaskan ke satu subkegiatan. Pegawai dan subkegiatan harus berasal dari Bagian yang sama. Operator tidak dapat melihat kegiatan di luar penugasannya.</p>
    </div>

    {modal?.type === "create" && <div className="master-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="master-modal user-modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
        <div className="master-modal-head"><div><h2 id="create-user-title">Buat Akun Operator</h2><p>Akun akan dibuat dan langsung ditautkan ke satu subkegiatan.</p></div><button className="master-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={createOperator}><div className="master-form-grid">
          <div className="master-field full"><label htmlFor="operator-employee">Pegawai *</label><select id="operator-employee" value={selectedEmployee} onChange={(e) => { setSelectedEmployee(e.target.value); setCreateForm({ ...createForm, kegiatan_id: "" }); }} required><option value="">Pilih pegawai aktif</option>{availableEmployees.map((row) => <option value={row.id} key={row.id}>{row.nama} — {row.nip || "Tanpa NIP"} · {row.nama_bagian}</option>)}</select><span className="field-hint">Pegawai yang sudah memiliki akun tidak ditampilkan.</span></div>
          <div className="master-field full"><label htmlFor="operator-activity">Subkegiatan yang diakses *</label><select id="operator-activity" value={createForm.kegiatan_id} onChange={(e) => setCreateForm({ ...createForm, kegiatan_id: e.target.value })} required disabled={!selectedEmployee}><option value="">{selectedEmployee ? "Pilih subkegiatan" : "Pilih pegawai terlebih dahulu"}</option>{filterActivities(eligibleActivities).map((row) => <option value={row.id} key={row.id}>{row.tahun} · {row.kode} · {row.nama}</option>)}</select><span className="field-hint">{employee ? "Hanya kegiatan milik " + employee.nama_bagian + " yang ditampilkan." : "Pilihan kegiatan mengikuti Bagian pegawai."}</span></div>
          <div className="master-field"><label htmlFor="operator-username">Username *</label><input id="operator-username" autoComplete="off" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0,32) })} placeholder="contoh: operator.perekonomian" minLength={3} maxLength={32} required/><span className="field-hint">3–32 karakter, huruf kecil/angka/._-.</span></div>
          <div className="master-field"><label htmlFor="operator-password">Password awal *</label><input id="operator-password" type="password" autoComplete="new-password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} minLength={8} maxLength={72} placeholder="Minimal 8 karakter" required/></div>
          <div className="master-field full"><label htmlFor="operator-password-confirm">Konfirmasi password *</label><input id="operator-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} maxLength={72} placeholder="Ulangi password awal" required/></div>
        </div>
        {formError && <div className="master-form-error" role="alert">{formError}</div>}
        <div className="user-modal-hint"><LockKeyhole size={14}/> Password disimpan oleh Supabase Auth. Sistem tidak mengirim email; sampaikan username dan password awal secara aman kepada operator.</div>
        <div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={closeModal} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy || !availableEmployees.length}>{busy ? "Membuat akun..." : "Buat Akun Operator"}</button></div></form>
      </section>
    </div>}

    {modal?.type === "assignment" && <div className="master-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="master-modal user-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-title">
        <div className="master-modal-head"><div><h2 id="assignment-title">Ubah Penugasan Operator</h2><p>{modal.account.nama_pegawai} · @{modal.account.username}</p></div><button className="master-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={saveAssignment}><div className="master-form-grid">
          <div className="master-field full"><label htmlFor="operator-change-activity">Subkegiatan *</label><select id="operator-change-activity" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} required><option value="">Pilih subkegiatan</option>{filterActivities(assignmentActivities).map((row) => <option value={row.id} key={row.id}>{row.tahun} · {row.kode} · {row.nama}</option>)}</select><span className="field-hint">Hanya subkegiatan aktif pada {modal.account.nama_bagian}.</span></div>
        </div>{formError && <div className="master-form-error" role="alert">{formError}</div>}<div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={closeModal} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Penugasan"}</button></div></form>
      </section>
    </div>}

    {modal?.type === "password" && <div className="master-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="master-modal user-modal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
        <div className="master-modal-head"><div><h2 id="reset-password-title">Reset Password Operator</h2><p>{modal.account.nama_pegawai} · @{modal.account.username}</p></div><button className="master-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={resetPassword}><div className="master-form-grid">
          <div className="master-field full"><label htmlFor="new-operator-password">Password baru *</label><input id="new-operator-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} maxLength={72} placeholder="Minimal 8 karakter" required/></div>
          <div className="master-field full"><label htmlFor="confirm-operator-password">Konfirmasi password baru *</label><input id="confirm-operator-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} maxLength={72} placeholder="Ulangi password baru" required/></div>
        </div>
        {formError && <div className="master-form-error" role="alert">{formError}</div>}
        <div className="user-modal-hint"><KeyRound size={14}/> Password baru berlaku untuk login berikutnya. Berikan kepada operator melalui jalur komunikasi yang aman.</div>
        <div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={closeModal} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Mereset..." : "Reset Password"}</button></div></form>
      </section>
    </div>}
  </>;
}
