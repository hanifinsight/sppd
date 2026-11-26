"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, Building2, CheckCircle2, Coins, Edit3,
  FilePlus2, Plus, Search, Wallet, X, Users, AlertTriangle, ReceiptText, Trash2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ActivityRecord = {
  id: string;
  bagian_id: string;
  nama_bagian: string;
  kode_subkegiatan: string;
  nama_subkegiatan: string;
  tahun_anggaran: number;
  aktif: boolean;
  pptk_names?: string[];
};
export type AccountRecord = {
  id: string;
  kode_rekening: string;
  nama_rekening: string;
  kategori: "penetapan" | "perubahan";
  perubahan_ke: number | null;
  aktif: boolean;
};
export type BudgetRecord = {
  id: string;
  kegiatan_id: string;
  rekening_id: string;
  pagu_awal: number;
  aktif: boolean;
  nama_subkegiatan: string;
  kode_subkegiatan: string;
  tahun_anggaran: number;
  nama_bagian: string;
  kode_rekening: string;
  nama_rekening: string;
  pagu_setelah_mutasi: number;
  komitmen_aktif: number;
  pagu_tersedia: number;
};
type SectionOption = { id: string; nama: string; aktif: boolean };
type ActivityForm = { bagian_id: string; kode_subkegiatan: string; nama_subkegiatan: string; tahun_anggaran: string };
type AccountForm = { kode_rekening: string; nama_rekening: string; kategori: "penetapan" | "perubahan"; perubahan_ke: string };
type BudgetForm = { kegiatan_id: string; rekening_id: string; pagu_awal: string };
type MutationForm = {
  jenis_mutasi: "tambah" | "kurang" | "penyesuaian_tambah" | "penyesuaian_kurang";
  nominal: string;
  tanggal: string;
  keterangan: string;
};

const formatMoney = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(value);
const moneyInput = (value: string) => value.replace(/[^0-9]/g, "");
const mutationLabels: Record<MutationForm["jenis_mutasi"], string> = {
  tambah: "Penambahan pagu",
  kurang: "Pengurangan pagu",
  penyesuaian_tambah: "Penyesuaian tambah",
  penyesuaian_kurang: "Penyesuaian kurang"
};

export default function AnggaranClient({
  initialActivities, initialAccounts, initialBudgets, sections, summaryAvailable
}: {
  initialActivities: ActivityRecord[];
  initialAccounts: AccountRecord[];
  initialBudgets: BudgetRecord[];
  sections: SectionOption[];
  summaryAvailable: boolean;
}) {
  const [activities, setActivities] = useState(initialActivities);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [tab, setTab] = useState<"activity" | "account" | "budget">("activity");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [modal, setModal] = useState<"activity" | "account" | "budget" | "mutation" | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [mutationBudgetId, setMutationBudgetId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityForm>({
    bagian_id: "", kode_subkegiatan: "", nama_subkegiatan: "", tahun_anggaran: String(new Date().getFullYear())
  });
  const [accountForm, setAccountForm] = useState<AccountForm>({ kode_rekening: "", nama_rekening: "", kategori: "penetapan", perubahan_ke: "" });
  const [budgetForm, setBudgetForm] = useState<BudgetForm>({ kegiatan_id: "", rekening_id: "", pagu_awal: "" });
  const [mutationForm, setMutationForm] = useState<MutationForm>({
    jenis_mutasi: "tambah", nominal: "", tanggal: "", keterangan: ""
  });
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [pageError, setPageError] = useState("");

  const filteredActivities = useMemo(() => activities.filter((row) => {
    const text = (row.kode_subkegiatan + " " + row.nama_subkegiatan + " " + row.nama_bagian).toLowerCase();
    return text.includes(search.toLowerCase())
      && (sectionFilter === "all" || row.bagian_id === sectionFilter)
      && (yearFilter === "all" || String(row.tahun_anggaran) === yearFilter);
  }), [activities, search, sectionFilter, yearFilter]);
  const filteredAccounts = useMemo(() => accounts.filter((row) =>
    (row.kode_rekening + " " + row.nama_rekening).toLowerCase().includes(search.toLowerCase())
  ), [accounts, search]);
  const filteredBudgets = useMemo(() => budgets.filter((row) =>
    (row.kode_subkegiatan + " " + row.nama_subkegiatan + " " + row.kode_rekening + " " + row.nama_rekening + " " + row.nama_bagian)
      .toLowerCase().includes(search.toLowerCase())
  ), [budgets, search]);

  const activeActivities = activities.filter((row) => row.aktif).length;
  const activeAccounts = accounts.filter((row) => row.aktif).length;
  const activeBudgets = budgets.filter((row) => row.aktif);
  const totalPagu = activeBudgets.reduce((sum, row) => sum + row.pagu_setelah_mutasi, 0);
  const totalCommitment = activeBudgets.reduce((sum, row) => sum + row.komitmen_aktif, 0);
  const totalAvailable = activeBudgets.reduce((sum, row) => sum + row.pagu_tersedia, 0);
  const years = Array.from(new Set(activities.map((row) => row.tahun_anggaran))).sort((a,b) => b-a);
  const mutationBudget = budgets.find((row) => row.id === mutationBudgetId) ?? null;
  const allowedSections = sections.filter((row) => row.aktif || row.id === activityForm.bagian_id);
  const allowedActivities = activities.filter((row) => row.aktif);
  const allowedAccounts = accounts.filter((row) => row.aktif);

  function clearFeedback() { setNotice(""); setPageError(""); setFormError(""); }

  function openNewActivity() {
    clearFeedback();
    setEditingActivityId(null);
    setActivityForm({
      bagian_id: sections.find((row) => row.aktif)?.id ?? "",
      kode_subkegiatan: "",
      nama_subkegiatan: "",
      tahun_anggaran: String(new Date().getFullYear())
    });
    setModal("activity");
  }
  function openEditActivity(row: ActivityRecord) {
    clearFeedback();
    setEditingActivityId(row.id);
    setActivityForm({
      bagian_id: row.bagian_id,
      kode_subkegiatan: row.kode_subkegiatan,
      nama_subkegiatan: row.nama_subkegiatan,
      tahun_anggaran: String(row.tahun_anggaran)
    });
    setModal("activity");
  }
  function openNewAccount() {
    clearFeedback();
    setEditingAccountId(null);
    setAccountForm({ kode_rekening: "", nama_rekening: "", kategori: "penetapan", perubahan_ke: "" });
    setModal("account");
  }
  function openEditAccount(row: AccountRecord) {
    clearFeedback();
    setEditingAccountId(row.id);
    setAccountForm({ kode_rekening: row.kode_rekening, nama_rekening: row.nama_rekening, kategori: row.kategori, perubahan_ke: row.perubahan_ke ? String(row.perubahan_ke) : "" });
    setModal("account");
  }
  function openNewBudget() {
    clearFeedback();
    setBudgetForm({
      kegiatan_id: allowedActivities[0]?.id ?? "",
      rekening_id: allowedAccounts[0]?.id ?? "",
      pagu_awal: ""
    });
    setModal("budget");
  }
  function openMutation(row: BudgetRecord) {
    clearFeedback();
    setMutationBudgetId(row.id);
    setMutationForm({
      jenis_mutasi: "tambah",
      nominal: "",
      tanggal: row.tahun_anggaran ? row.tahun_anggaran + "-01-01" : "",
      keterangan: ""
    });
    setModal("mutation");
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    const code = activityForm.kode_subkegiatan.trim();
    const name = activityForm.nama_subkegiatan.trim();
    const year = Number(activityForm.tahun_anggaran);
    if (!activityForm.bagian_id) { setFormError("Pilih Bagian terlebih dahulu."); return; }
    if (!name) { setFormError("Nama subkegiatan wajib diisi."); return; }
    if (!Number.isInteger(year) || year < 2000 || year > 2200) { setFormError("Tahun anggaran harus antara 2000 sampai 2200."); return; }
    const duplicate = activities.some((row) => row.id !== editingActivityId && row.tahun_anggaran === year &&
      ((code && row.kode_subkegiatan.replace(/\s/g,"") === code.replace(/\s/g,"")) ||
       (row.bagian_id === activityForm.bagian_id && row.nama_subkegiatan.trim().toLowerCase() === name.toLowerCase())));
    if (duplicate) { setFormError("Kode atau nama subkegiatan sudah terdaftar pada tahun anggaran tersebut."); return; }

    setBusy(true);
    const supabase = createClient();
    const payload = {
      bagian_id: activityForm.bagian_id,
      kode_subkegiatan: code || null,
      nama_subkegiatan: name,
      tahun_anggaran: year
    };
    try {
      if (editingActivityId) {
        const { data, error } = await supabase.from("kegiatan").update(payload).eq("id", editingActivityId)
          .select("id,bagian_id,kode_subkegiatan,nama_subkegiatan,tahun_anggaran,aktif").single();
        if (error) throw error;
        const section = sections.find((row) => row.id === data.bagian_id);
        setActivities((current) => current.map((row) => row.id === editingActivityId ? {
          ...row, ...data, kode_subkegiatan: (data.kode_subkegiatan ?? "").trim(),
          nama_subkegiatan: data.nama_subkegiatan.trim(), nama_bagian: section?.nama ?? row.nama_bagian
        } : row));
        setNotice("Data subkegiatan berhasil diperbarui.");
      } else {
        const { data, error } = await supabase.from("kegiatan").insert(payload)
          .select("id,bagian_id,kode_subkegiatan,nama_subkegiatan,tahun_anggaran,aktif").single();
        if (error) throw error;
        const section = sections.find((row) => row.id === data.bagian_id);
        setActivities((current) => [...current, {
          ...data, kode_subkegiatan: (data.kode_subkegiatan ?? "").trim(),
          nama_subkegiatan: data.nama_subkegiatan.trim(), nama_bagian: section?.nama ?? "Bagian tidak ditemukan", pptk_names: []
        }].sort((a,b) => b.tahun_anggaran-a.tahun_anggaran || a.nama_subkegiatan.localeCompare(b.nama_subkegiatan, "id")));
        setNotice("Subkegiatan baru berhasil ditambahkan.");
      }
      setModal(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan subkegiatan.");
    } finally { setBusy(false); }
  }

  async function toggleActivity(row: ActivityRecord) {
    if (!window.confirm("Yakin " + (row.aktif ? "menonaktifkan" : "mengaktifkan") + " subkegiatan ini?")) return;
    setPendingId(row.id);
    clearFeedback();
    const supabase = createClient();
    const { data, error } = await supabase.from("kegiatan").update({ aktif: !row.aktif })
      .eq("id", row.id).select("aktif").single();
    if (error) setPageError(error.message);
    else {
      setActivities((current) => current.map((item) => item.id === row.id ? { ...item, aktif: data.aktif } : item));
      setNotice("Status subkegiatan berhasil diperbarui.");
    }
    setPendingId(null);
  }

  async function deleteActivity(row: ActivityRecord) {
    if (!window.confirm("Hapus permanen subkegiatan \"" + row.nama_subkegiatan + "\"? Penghapusan hanya dapat dilakukan jika belum dipakai pada anggaran, perjalanan dinas, atau penugasan pengelola.")) return;
    setPendingId(row.id);
    clearFeedback();
    const supabase = createClient();
    try {
      const checks = await Promise.all([
        supabase.from("anggaran").select("id", { count: "exact", head: true }).eq("kegiatan_id", row.id),
        supabase.from("perjalanan_dinas").select("id", { count: "exact", head: true }).eq("kegiatan_id", row.id),
        supabase.from("operator_kegiatan").select("kegiatan_id", { count: "exact", head: true }).eq("kegiatan_id", row.id),
        supabase.from("pejabat_pengelola").select("id", { count: "exact", head: true }).eq("kegiatan_id", row.id),
        supabase.from("pejabat_pengelola_kegiatan").select("kegiatan_id", { count: "exact", head: true }).eq("kegiatan_id", row.id)
      ]);
      const failedCheck = checks.find((result) => result.error);
      if (failedCheck?.error) throw new Error("Pemeriksaan relasi data gagal. Subkegiatan tidak dihapus demi keamanan: " + failedCheck.error.message);
      const used = checks.reduce((sum, result) => sum + (result.count ?? 0), 0);
      if (used > 0) {
        setPageError("Subkegiatan tidak dapat dihapus karena sudah digunakan pada " + used + " data anggaran, perjalanan dinas, atau penugasan pengelola. Nonaktifkan subkegiatan jika tidak digunakan lagi.");
        return;
      }
      const { error } = await supabase.from("kegiatan").delete().eq("id", row.id);
      if (error) throw error;
      setActivities((current) => current.filter((item) => item.id !== row.id));
      setNotice("Subkegiatan berhasil dihapus.");
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Gagal menghapus subkegiatan.");
    } finally {
      setPendingId(null);
    }
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    const code = accountForm.kode_rekening.trim();
    const name = accountForm.nama_rekening.trim();
    if (!code || !name) { setFormError("Kode dan nama rekening wajib diisi."); return; }
    const perubahanKe = accountForm.kategori === "perubahan" ? Number(accountForm.perubahan_ke) : null;
    if (accountForm.kategori === "perubahan" && (!Number.isInteger(perubahanKe) || (perubahanKe ?? 0) < 1)) {
      setFormError("Nomor perubahan wajib diisi mulai dari perubahan ke-1.");
      return;
    }
    const duplicate = accounts.some((row) => row.id !== editingAccountId && row.kode_rekening.toLowerCase() === code.toLowerCase());
    if (duplicate) { setFormError("Kode rekening tersebut sudah digunakan."); return; }

    setBusy(true);
    const supabase = createClient();
    const payload = { kode_rekening: code, nama_rekening: name, kategori: accountForm.kategori, perubahan_ke: perubahanKe };
    try {
      if (editingAccountId) {
        const { data, error } = await supabase.from("rekening_belanja").update(payload).eq("id", editingAccountId)
          .select("id,kode_rekening,nama_rekening,kategori,perubahan_ke,aktif").single();
        if (error) throw error;
        setAccounts((current) => current.map((row) => row.id === editingAccountId ? data : row));
        setNotice("Data rekening belanja berhasil diperbarui.");
      } else {
        const { data, error } = await supabase.from("rekening_belanja").insert({ ...payload, aktif: true })
          .select("id,kode_rekening,nama_rekening,kategori,perubahan_ke,aktif").single();
        if (error) throw error;
        setAccounts((current) => [...current, data].sort((a,b) => a.kode_rekening.localeCompare(b.kode_rekening)));
        setNotice("Rekening belanja berhasil ditambahkan.");
      }
      setModal(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan rekening belanja.");
    } finally { setBusy(false); }
  }


  async function deleteAccount(row: AccountRecord) {
    const linkedCount = budgets.filter((budget) => budget.rekening_id === row.id).length;
    if (linkedCount > 0) {
      setPageError("Rekening tidak dapat dihapus karena masih digunakan pada " + linkedCount + " alokasi anggaran. Nonaktifkan rekening jika tidak digunakan lagi.");
      return;
    }
    if (!window.confirm("Hapus permanen rekening belanja " + row.kode_rekening + " — " + row.nama_rekening + "?")) return;
    setPendingId(row.id);
    clearFeedback();
    const supabase = createClient();
    try {
      // Recheck the relationship in the database immediately before deletion.
      const { count, error: checkError } = await supabase.from("anggaran")
        .select("id", { count: "exact", head: true }).eq("rekening_id", row.id);
      if (checkError) throw checkError;
      if ((count ?? 0) > 0) {
        setPageError("Rekening tidak dapat dihapus karena sudah digunakan pada alokasi anggaran. Muat ulang daftar untuk melihat data terbaru.");
        return;
      }
      const { error } = await supabase.from("rekening_belanja").delete().eq("id", row.id);
      if (error) throw error;
      setAccounts((current) => current.filter((item) => item.id !== row.id));
      setNotice("Rekening belanja berhasil dihapus.");
    } catch (e) {
      // Supabase/PostgREST errors are plain objects, not always Error instances.
      // Preserve the database message so the actual constraint/policy failure is visible.
      const dbError = e as { message?: string; details?: string; hint?: string; code?: string };
      const message = [dbError?.message, dbError?.details, dbError?.hint]
        .filter((part): part is string => Boolean(part))
        .join(" — ");
      setPageError(message || (e instanceof Error ? e.message : "Gagal menghapus rekening belanja."));
      if (dbError?.code) console.error("Gagal menghapus rekening belanja:", dbError.code, e);
    } finally {
      setPendingId(null);
    }
  }

  async function toggleAccount(row: AccountRecord) {
    if (!window.confirm("Yakin " + (row.aktif ? "menonaktifkan" : "mengaktifkan") + " rekening " + row.kode_rekening + "?")) return;
    setPendingId(row.id);
    clearFeedback();
    const supabase = createClient();
    const { data, error } = await supabase.from("rekening_belanja").update({ aktif: !row.aktif })
      .eq("id", row.id).select("aktif").single();
    if (error) setPageError(error.message);
    else {
      setAccounts((current) => current.map((item) => item.id === row.id ? { ...item, aktif: data.aktif } : item));
      setNotice("Status rekening belanja berhasil diperbarui.");
    }
    setPendingId(null);
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    const amount = Number(budgetForm.pagu_awal);
    if (!budgetForm.kegiatan_id || !budgetForm.rekening_id) { setFormError("Pilih subkegiatan dan rekening belanja."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setFormError("Pagu awal harus lebih besar dari nol."); return; }
    if (budgets.some((row) => row.kegiatan_id === budgetForm.kegiatan_id && row.rekening_id === budgetForm.rekening_id)) {
      setFormError("Alokasi untuk kombinasi subkegiatan dan rekening ini sudah tersedia. Gunakan menu Mutasi untuk mengubah pagu.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.from("anggaran")
        .insert({ kegiatan_id: budgetForm.kegiatan_id, rekening_id: budgetForm.rekening_id, pagu_awal: amount, aktif: true })
        .select("id,kegiatan_id,rekening_id,pagu_awal,aktif").single();
      if (error) throw error;
      const activity = activities.find((row) => row.id === data.kegiatan_id);
      const account = accounts.find((row) => row.id === data.rekening_id);
      setBudgets((current) => [...current, {
        id: data.id, kegiatan_id: data.kegiatan_id, rekening_id: data.rekening_id,
        pagu_awal: Number(data.pagu_awal), aktif: data.aktif,
        nama_subkegiatan: activity?.nama_subkegiatan ?? "Kegiatan",
        kode_subkegiatan: activity?.kode_subkegiatan ?? "",
        tahun_anggaran: activity?.tahun_anggaran ?? 0,
        nama_bagian: activity?.nama_bagian ?? "",
        kode_rekening: account?.kode_rekening ?? "",
        nama_rekening: account?.nama_rekening ?? "",
        pagu_setelah_mutasi: Number(data.pagu_awal), komitmen_aktif: 0, pagu_tersedia: Number(data.pagu_awal)
      }]);
      setNotice("Alokasi anggaran berhasil dibuat.");
      setModal(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal membuat alokasi anggaran.");
    } finally { setBusy(false); }
  }

  async function saveMutation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    if (!mutationBudget) { setFormError("Data anggaran tidak ditemukan."); return; }
    const amount = Number(mutationForm.nominal);
    if (!Number.isFinite(amount) || amount <= 0) { setFormError("Nominal mutasi harus lebih besar dari nol."); return; }
    if (!mutationForm.tanggal) { setFormError("Tanggal mutasi wajib diisi."); return; }
    if (!mutationForm.keterangan.trim()) { setFormError("Keterangan mutasi wajib diisi."); return; }

    setBusy(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("sppd_catat_mutasi_anggaran", {
        p_anggaran_id: mutationBudget.id,
        p_jenis_mutasi: mutationForm.jenis_mutasi,
        p_nominal: amount,
        p_tanggal: mutationForm.tanggal,
        p_keterangan: mutationForm.keterangan.trim()
      });
      if (error) throw error;
      const { data: summary, error: summaryError } = await supabase.from("v_ringkasan_anggaran")
        .select("anggaran_id,pagu_setelah_mutasi,komitmen_aktif,pagu_tersedia")
        .eq("anggaran_id", mutationBudget.id).maybeSingle();
      if (summaryError) throw summaryError;
      if (summary) {
        setBudgets((current) => current.map((row) => row.id === mutationBudget.id ? {
          ...row,
          pagu_setelah_mutasi: Number(summary.pagu_setelah_mutasi),
          komitmen_aktif: Number(summary.komitmen_aktif),
          pagu_tersedia: Number(summary.pagu_tersedia)
        } : row));
      }
      setNotice("Mutasi anggaran berhasil dicatat.");
      setModal(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Mutasi anggaran ditolak. Periksa komitmen aktif dan pagu tersedia.");
    } finally { setBusy(false); }
  }

  async function toggleBudget(row: BudgetRecord) {
    if (row.aktif && row.komitmen_aktif > 0) {
      setPageError("Alokasi tidak dapat dinonaktifkan karena masih memiliki komitmen aktif.");
      return;
    }
    if (!window.confirm("Yakin " + (row.aktif ? "menonaktifkan" : "mengaktifkan") + " alokasi anggaran ini?")) return;
    setPendingId(row.id);
    clearFeedback();
    const supabase = createClient();
    const { data, error } = await supabase.from("anggaran").update({ aktif: !row.aktif })
      .eq("id", row.id).select("aktif").single();
    if (error) setPageError(error.message);
    else {
      setBudgets((current) => current.map((item) => item.id === row.id ? { ...item, aktif: data.aktif } : item));
      setNotice("Status alokasi anggaran berhasil diperbarui.");
    }
    setPendingId(null);
  }

  async function deleteBudget(row: BudgetRecord) {
    if (row.komitmen_aktif > 0) { setPageError("Alokasi tidak dapat dihapus karena masih memiliki komitmen perjalanan dinas."); return; }
    if (!window.confirm("Hapus permanen alokasi " + row.nama_subkegiatan + " — " + row.nama_rekening + "? Riwayat mutasi/relasi yang masih ada akan mencegah penghapusan.")) return;
    setPendingId(row.id); clearFeedback();
    try {
      const supabase = createClient();
      const { count, error: checkError } = await supabase.from("perjalanan_dinas")
        .select("id", { count: "exact", head: true }).eq("anggaran_id", row.id);
      if (checkError) throw checkError;
      if ((count ?? 0) > 0) throw new Error("Alokasi sudah digunakan pada perjalanan dinas. Nonaktifkan jika tidak digunakan lagi.");
      const { error } = await supabase.from("anggaran").delete().eq("id", row.id);
      if (error) throw error;
      setBudgets(current => current.filter(item => item.id !== row.id));
      setNotice("Alokasi anggaran berhasil dihapus.");
    } catch (e) { setPageError(e instanceof Error ? e.message : "Alokasi tidak dapat dihapus karena masih memiliki relasi."); }
    finally { setPendingId(null); }
  }

  function closeModal() { if (!busy) setModal(null); }

  return <>
    <div className="master-page-head">
      <div><div className="eyebrow">DATA MASTER / PERENCANAAN ANGGARAN</div><h1>Kegiatan & Anggaran</h1><p>Kelola subkegiatan, rekening belanja, alokasi pagu, dan sisa anggaran perjalanan dinas.</p></div>
      {tab === "activity" && <button className="master-primary-btn" onClick={openNewActivity}><Plus size={16}/> Tambah Subkegiatan</button>}
      {tab === "account" && <button className="master-primary-btn" onClick={openNewAccount}><Plus size={16}/> Tambah Rekening</button>}
      {tab === "budget" && <button className="master-primary-btn" onClick={openNewBudget} disabled={!allowedActivities.length || !allowedAccounts.length}><Plus size={16}/> Tambah Alokasi Anggaran</button>}
    </div>

    <div className="budget-summary-grid">
      <article className="budget-summary-card"><span className="budget-summary-icon"><Building2 size={18}/></span><div><small>Subkegiatan aktif</small><strong>{activeActivities}</strong></div></article>
      <article className="budget-summary-card"><span className="budget-summary-icon"><ReceiptText size={18}/></span><div><small>Rekening aktif</small><strong>{activeAccounts}</strong></div></article>
      <article className="budget-summary-card"><span className="budget-summary-icon"><Wallet size={18}/></span><div><small>Total pagu aktif</small><strong>{formatMoney(totalPagu)}</strong></div></article>
      <article className="budget-summary-card"><span className="budget-summary-icon"><Coins size={18}/></span><div><small>Pagu tersedia</small><strong>{formatMoney(totalAvailable)}</strong></div></article>
    </div>
    <div className="budget-commitment-line"><span><CheckCircle2 size={14}/> Komitmen aktif: <b>{formatMoney(totalCommitment)}</b></span><span>Nilai berdasarkan alokasi aktif</span></div>

    {notice && <div className="master-feedback">{notice}</div>}
    {pageError && <div className="master-feedback error">{pageError}</div>}
    {!summaryAvailable && <div className="budget-warning"><AlertTriangle size={15}/> Ringkasan pagu setelah mutasi belum dapat dibaca. Angka sementara menggunakan pagu awal; periksa akses view anggaran sebelum mencatat mutasi.</div>}

    <div className="official-tabs budget-tabs">
      <button className={tab === "activity" ? "active" : ""} onClick={() => { setTab("activity"); setSearch(""); clearFeedback(); }}><Building2 size={15}/> Subkegiatan</button>
      <button className={tab === "account" ? "active" : ""} onClick={() => { setTab("account"); setSearch(""); clearFeedback(); }}><ReceiptText size={15}/> Rekening Belanja</button>
      <button className={tab === "budget" ? "active" : ""} onClick={() => { setTab("budget"); setSearch(""); clearFeedback(); }}><Wallet size={15}/> Alokasi Anggaran</button>
    </div>

    {tab === "activity" && <>
      <div className="master-toolbar">
        <label className="master-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode atau nama subkegiatan..."/></label>
        <div className="master-toolbar-actions">
          <select className="master-filter" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} aria-label="Filter bagian"><option value="all">Semua Bagian</option>{sections.map((row) => <option key={row.id} value={row.id}>{row.nama}</option>)}</select>
          <select className="master-filter" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} aria-label="Filter tahun"><option value="all">Semua Tahun</option>{years.map((year) => <option value={year} key={year}>{year}</option>)}</select>
        </div>
      </div>
      <div className="master-table-card">
        <div className="master-table-wrap"><table className="master-table budget-activity-table">
          <thead><tr><th>KODE SUBKEGIATAN</th><th>NAMA SUBKEGIATAN</th><th>BAGIAN</th><th>TAHUN</th><th>PPTK</th><th>STATUS</th><th>AKSI</th></tr></thead>
          <tbody>{filteredActivities.length ? filteredActivities.map((row) => <tr key={row.id}>
            <td><strong>{row.kode_subkegiatan || "—"}</strong></td><td><strong>{row.nama_subkegiatan}</strong></td>
            <td>{row.nama_bagian}</td><td>{row.tahun_anggaran}</td>
            <td>{row.pptk_names?.length ? row.pptk_names.join(", ") : <span className="muted">Belum ditetapkan</span>}</td>
            <td><span className={"master-status " + (row.aktif ? "is-active" : "is-inactive")}>{row.aktif ? "Aktif" : "Nonaktif"}</span></td>
            <td><div className="master-row-actions"><button className="master-icon-btn" title="Ubah subkegiatan" aria-label="Ubah subkegiatan" onClick={() => openEditActivity(row)}><Edit3 size={14}/></button><button className="master-secondary-btn" disabled={pendingId === row.id} onClick={() => toggleActivity(row)}>{pendingId === row.id ? "..." : row.aktif ? "Nonaktifkan" : "Aktifkan"}</button><button className="master-icon-btn" title="Hapus subkegiatan" aria-label="Hapus subkegiatan" disabled={pendingId === row.id} onClick={() => deleteActivity(row)}><Trash2 size={14}/></button></div></td>
          </tr>) : <tr><td colSpan={7} className="master-empty">Tidak ada subkegiatan yang sesuai.</td></tr>}</tbody>
        </table></div>
        <div className="master-table-foot"><span>Menampilkan <b>{filteredActivities.length}</b> dari <b>{activities.length}</b> subkegiatan</span><span>{activeActivities} aktif · {sections.length} bagian</span></div>
      </div>
    </>}

    {tab === "account" && <>
      <div className="master-toolbar">
        <label className="master-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode atau uraian rekening..."/></label>
        <div className="master-toolbar-actions"><span className="master-admin-pill">{accounts.length} rekening terdaftar</span></div>
      </div>
      <div className="master-table-card">
        <div className="master-table-wrap"><table className="master-table">
          <thead><tr><th>KODE REKENING</th><th>NAMA REKENING BELANJA</th><th>KATEGORI</th><th>DIPAKAI PADA ALOKASI</th><th>STATUS</th><th>AKSI</th></tr></thead>
          <tbody>{filteredAccounts.length ? filteredAccounts.map((row) => <tr key={row.id}>
            <td><strong>{row.kode_rekening}</strong></td><td>{row.nama_rekening}</td>
            <td><span className="master-status is-active">{row.kategori === "penetapan" ? "Penetapan" : `Perubahan ke-${row.perubahan_ke}`}</span></td>
            <td>{budgets.filter((budget) => budget.rekening_id === row.id).length} alokasi</td>
            <td><span className={"master-status " + (row.aktif ? "is-active" : "is-inactive")}>{row.aktif ? "Aktif" : "Nonaktif"}</span></td>
            <td><div className="master-row-actions"><button className="master-icon-btn" title="Ubah rekening" aria-label="Ubah rekening" onClick={() => openEditAccount(row)}><Edit3 size={14}/></button><button className="master-secondary-btn" disabled={pendingId === row.id} onClick={() => toggleAccount(row)}>{pendingId === row.id ? "..." : row.aktif ? "Nonaktifkan" : "Aktifkan"}</button><button className="master-icon-btn" title="Hapus rekening" aria-label="Hapus rekening" disabled={pendingId === row.id} onClick={() => deleteAccount(row)}><Trash2 size={14}/></button></div></td>
          </tr>) : <tr><td colSpan={6} className="master-empty">Tidak ada rekening belanja yang sesuai.</td></tr>}</tbody>
        </table></div>
        <div className="master-table-foot"><span>Menampilkan <b>{filteredAccounts.length}</b> dari <b>{accounts.length}</b> rekening</span><span>Rekening nonaktif tidak muncul untuk alokasi baru</span></div>
      </div>
    </>}

    {tab === "budget" && <>
      <div className="budget-policy-note"><ShieldCheckIcon/> Perubahan pagu dicatat sebagai mutasi. Sistem menolak pengurangan yang membuat pagu setelah mutasi lebih kecil daripada komitmen perjalanan dinas yang masih aktif.</div>
      <div className="master-toolbar">
        <label className="master-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari subkegiatan atau rekening..."/></label>
        <div className="master-toolbar-actions"><span className="master-admin-pill">{budgets.length} alokasi</span></div>
      </div>
      <div className="master-table-card">
        <div className="master-table-wrap"><table className="master-table budget-table">
          <thead><tr><th>KEGIATAN / REKENING</th><th>PAGU SETELAH MUTASI</th><th>KOMITMEN AKTIF</th><th>PAGU TERSEDIA</th><th>STATUS</th><th>AKSI</th></tr></thead>
          <tbody>{filteredBudgets.length ? filteredBudgets.map((row) => <tr key={row.id}>
            <td><strong>{row.nama_subkegiatan}</strong><small>{row.kode_subkegiatan} · {row.tahun_anggaran} · {row.nama_bagian}</small><small className="budget-account-text">{row.kode_rekening} · {row.nama_rekening}</small></td>
            <td><strong>{formatMoney(row.pagu_setelah_mutasi)}</strong><small>Pagu awal {formatMoney(row.pagu_awal)}</small></td>
            <td>{formatMoney(row.komitmen_aktif)}</td>
            <td><strong className={row.pagu_tersedia < 0 ? "budget-negative" : "budget-positive"}>{formatMoney(row.pagu_tersedia)}</strong></td>
            <td><span className={"master-status " + (row.aktif ? "is-active" : "is-inactive")}>{row.aktif ? "Aktif" : "Nonaktif"}</span></td>
            <td><div className="budget-actions"><button className="master-primary-btn budget-mutation-btn" onClick={() => openMutation(row)} disabled={!row.aktif || !summaryAvailable}><ArrowUpRight size={13}/> Mutasi</button><button className="master-secondary-btn" disabled={pendingId === row.id} onClick={() => toggleBudget(row)}>{pendingId === row.id ? "..." : row.aktif ? "Nonaktifkan" : "Aktifkan"}</button><button className="master-icon-btn" title="Hapus alokasi" aria-label="Hapus alokasi" disabled={pendingId === row.id} onClick={() => deleteBudget(row)}><Trash2 size={14}/></button></div></td>
          </tr>) : <tr><td colSpan={6} className="master-empty">Belum ada alokasi anggaran yang sesuai.</td></tr>}</tbody>
        </table></div>
        <div className="master-table-foot"><span>Menampilkan <b>{filteredBudgets.length}</b> dari <b>{budgets.length}</b> alokasi</span><span>Penyesuaian pagu tersimpan pada riwayat mutasi</span></div>
      </div>
    </>}

    {modal === "activity" && <div className="master-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="master-modal" role="dialog" aria-modal="true" aria-labelledby="activity-modal-title">
        <div className="master-modal-head"><div><h2 id="activity-modal-title">{editingActivityId ? "Ubah Subkegiatan" : "Tambah Subkegiatan"}</h2><p>Masukkan kode, nama, Bagian, dan tahun anggaran.</p></div><button className="master-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={saveActivity}><div className="master-form-grid">
          <div className="master-field full"><label htmlFor="activity-section">Bagian *</label><select id="activity-section" value={activityForm.bagian_id} onChange={(e) => setActivityForm({ ...activityForm, bagian_id: e.target.value })} required><option value="">Pilih Bagian</option>{allowedSections.map((row) => <option value={row.id} key={row.id}>{row.nama}</option>)}</select></div>
          <div className="master-field"><label htmlFor="activity-code">Kode Subkegiatan</label><input id="activity-code" value={activityForm.kode_subkegiatan} onChange={(e) => setActivityForm({ ...activityForm, kode_subkegiatan: e.target.value })} placeholder="Contoh: 4.01.03.2.01.0002" maxLength={80}/></div>
          <div className="master-field"><label htmlFor="activity-year">Tahun Anggaran *</label><input id="activity-year" type="number" min="2000" max="2200" step="1" value={activityForm.tahun_anggaran} onChange={(e) => setActivityForm({ ...activityForm, tahun_anggaran: e.target.value })} required/></div>
          <div className="master-field full"><label htmlFor="activity-name">Nama Subkegiatan *</label><textarea id="activity-name" value={activityForm.nama_subkegiatan} onChange={(e) => setActivityForm({ ...activityForm, nama_subkegiatan: e.target.value })} placeholder="Nama lengkap subkegiatan sesuai dokumen anggaran" required maxLength={500}/></div>

        </div>{formError && <div className="master-form-error" role="alert">{formError}</div>}<div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={closeModal} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Subkegiatan"}</button></div></form>
      </section>
    </div>}

    {modal === "account" && <div className="master-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="master-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <div className="master-modal-head"><div><h2 id="account-modal-title">{editingAccountId ? "Ubah Rekening Belanja" : "Tambah Rekening Belanja"}</h2><p>Masukkan kode, uraian, dan kategori rekening belanja.</p></div><button className="master-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={saveAccount}><div className="master-form-grid">
          <div className="master-field full"><label htmlFor="account-code">Kode Rekening *</label><input id="account-code" value={accountForm.kode_rekening} onChange={(e) => setAccountForm({ ...accountForm, kode_rekening: e.target.value })} placeholder="Contoh: 5.1.02.04.001.00001" required maxLength={100}/></div>
          <div className="master-field full"><label htmlFor="account-name">Nama Rekening *</label><textarea id="account-name" value={accountForm.nama_rekening} onChange={(e) => setAccountForm({ ...accountForm, nama_rekening: e.target.value })} placeholder="Contoh: Belanja Perjalanan Dinas Biasa" required maxLength={300}/></div>
          <div className="master-field full"><label htmlFor="account-category">Kategori Rekening *</label><select id="account-category" value={accountForm.kategori} onChange={(e) => setAccountForm({ ...accountForm, kategori: e.target.value as AccountForm["kategori"], perubahan_ke: e.target.value === "perubahan" ? accountForm.perubahan_ke : "" })}><option value="penetapan">Penetapan</option><option value="perubahan">Perubahan</option></select></div>
          {accountForm.kategori === "perubahan" && <div className="master-field full"><label htmlFor="account-change-number">Perubahan Ke- *</label><input id="account-change-number" type="number" min="1" step="1" value={accountForm.perubahan_ke} onChange={(e) => setAccountForm({ ...accountForm, perubahan_ke: e.target.value })} placeholder="Contoh: 1" required/><span className="field-hint">Isi nomor urut perubahan, misalnya 1 untuk Perubahan ke-1.</span></div>}

        </div>{formError && <div className="master-form-error" role="alert">{formError}</div>}<div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={closeModal} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Rekening"}</button></div></form>
      </section>
    </div>}

    {modal === "budget" && <div className="master-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="master-modal" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title">
        <div className="master-modal-head"><div><h2 id="budget-modal-title">Tambah Alokasi Anggaran</h2><p>Pasangkan satu subkegiatan dengan rekening belanja dan tetapkan pagu awal.</p></div><button className="master-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={saveBudget}><div className="master-form-grid">
          <div className="master-field full"><label htmlFor="budget-activity">Subkegiatan *</label><select id="budget-activity" value={budgetForm.kegiatan_id} onChange={(e) => setBudgetForm({ ...budgetForm, kegiatan_id: e.target.value })} required><option value="">Pilih subkegiatan</option>{allowedActivities.map((row) => <option value={row.id} key={row.id}>{row.tahun_anggaran} · {row.kode_subkegiatan} · {row.nama_subkegiatan}</option>)}</select></div>
          <div className="master-field full"><label htmlFor="budget-account">Rekening Belanja *</label><select id="budget-account" value={budgetForm.rekening_id} onChange={(e) => setBudgetForm({ ...budgetForm, rekening_id: e.target.value })} required><option value="">Pilih rekening belanja</option>{allowedAccounts.map((row) => <option value={row.id} key={row.id}>{row.kode_rekening} · {row.nama_rekening} · {row.kategori === "penetapan" ? "Penetapan" : `Perubahan ke-${row.perubahan_ke}`}</option>)}</select></div>
          <div className="master-field full"><label htmlFor="budget-pagu">Pagu Awal (Rp) *</label><input id="budget-pagu" type="number" min="1" step="1" value={budgetForm.pagu_awal} onChange={(e) => setBudgetForm({ ...budgetForm, pagu_awal: moneyInput(e.target.value) })} placeholder="Contoh: 83669100" required/><span className="field-hint">Pagu awal hanya dicatat saat alokasi dibuat. Perubahan berikutnya dilakukan melalui Mutasi Anggaran.</span></div>
        </div>{formError && <div className="master-form-error" role="alert">{formError}</div>}<div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={closeModal} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Alokasi"}</button></div></form>
      </section>
    </div>}

    {modal === "mutation" && mutationBudget && <div className="master-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="master-modal" role="dialog" aria-modal="true" aria-labelledby="mutation-modal-title">
        <div className="master-modal-head"><div><h2 id="mutation-modal-title">Mutasi Anggaran</h2><p>{mutationBudget.nama_subkegiatan} · {mutationBudget.kode_rekening}</p></div><button className="master-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup"><X size={16}/></button></div>
        <form className="master-form" onSubmit={saveMutation}><div className="mutation-current-box">
          <div><small>Pagu setelah mutasi saat ini</small><strong>{formatMoney(mutationBudget.pagu_setelah_mutasi)}</strong></div>
          <div><small>Komitmen aktif</small><strong>{formatMoney(mutationBudget.komitmen_aktif)}</strong></div>
          <div><small>Pagu tersedia</small><strong>{formatMoney(mutationBudget.pagu_tersedia)}</strong></div>
        </div><div className="master-form-grid">
          <div className="master-field full"><label htmlFor="mutation-type">Jenis mutasi *</label><select id="mutation-type" value={mutationForm.jenis_mutasi} onChange={(e) => setMutationForm({ ...mutationForm, jenis_mutasi: e.target.value as MutationForm["jenis_mutasi"] })}>{Object.entries(mutationLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></div>
          <div className="master-field"><label htmlFor="mutation-amount">Nominal (Rp) *</label><input id="mutation-amount" type="number" min="1" step="1" value={mutationForm.nominal} onChange={(e) => setMutationForm({ ...mutationForm, nominal: moneyInput(e.target.value) })} placeholder="Nominal mutasi" required/></div>
          <div className="master-field"><label htmlFor="mutation-date">Tanggal *</label><input id="mutation-date" type="date" value={mutationForm.tanggal} onChange={(e) => setMutationForm({ ...mutationForm, tanggal: e.target.value })} required/></div>
          <div className="master-field full"><label htmlFor="mutation-note">Keterangan *</label><textarea id="mutation-note" value={mutationForm.keterangan} onChange={(e) => setMutationForm({ ...mutationForm, keterangan: e.target.value })} placeholder="Dasar atau alasan perubahan pagu" required maxLength={500}/></div>
        </div>
        {formError && <div className="master-form-error" role="alert">{formError}</div>}
        <div className="master-form-actions"><button type="button" className="master-secondary-btn" onClick={closeModal} disabled={busy}>Batal</button><button className="master-primary-btn" disabled={busy}>{busy ? "Mencatat..." : "Simpan Mutasi"}</button></div></form>
      </section>
    </div>}
  </>;
}

function ShieldCheckIcon() {
  return <span className="budget-policy-icon"><CheckCircle2 size={16}/></span>;
}
