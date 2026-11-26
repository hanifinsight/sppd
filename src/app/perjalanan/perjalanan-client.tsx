"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, Check, CheckCircle2, ClipboardCheck, Clock3, Eye, FileText,
  MapPin, Plus, Search, Users, Wallet, X, Edit3, UserRound, Trash2, Plane
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ActivityOption = { id: string; bagian_id: string; kode: string; nama: string; tahun: number; nama_bagian: string };
export type BudgetOption = { id: string; kegiatan_id: string; pagu_awal: number; pagu_tersedia: number; komitmen_aktif: number; kode_rekening: string; nama_rekening: string };
export type EmployeeOption = { id: string; bagian_id: string; nama: string; nip: string; status_kepegawaian: string; pangkat_golongan: string; jabatan: string };
export type SignerOption = { id: string; pegawai_id: string; nama: string; jabatan: string; bagian_id: string | null };
export type KpaOption = { id: string; bagian_id: string | null; nama: string };
export type CompanionRecord = { nama: string; tanggal_lahir: string; keterangan: string };
export type TripRecord = {
  id: string; kegiatan_id: string; anggaran_id: string; jenis_perjalanan: string;
  nomor_undangan: string; tanggal_undangan: string; tanggal_acara_mulai: string;
  tanggal_acara_selesai: string; lokasi_acara: string; maksud_perjalanan: string;
  tempat_berangkat: string; tempat_tujuan: string; provinsi_tujuan: string;
  tanggal_berangkat: string; tanggal_kembali: string; alat_angkut: string;
  status: string; penandatangan_sp_id: string; kpa_sppd_id: string; created_at: string;
  nama_kegiatan: string; kode_kegiatan: string; nama_bagian: string;
  nama_peserta: string[]; peserta_ids: string[]; pengikut: CompanionRecord[];
  bbm: number; tol: number; penginapan: number;
};
type TripForm = {
  kegiatan_id: string; anggaran_id: string; jenis_perjalanan: "luar_kota" | "dalam_kota";
  nomor_undangan: string; tanggal_undangan: string; tanggal_acara_mulai: string;
  tanggal_acara_selesai: string; lokasi_acara: string; maksud_perjalanan: string;
  tempat_berangkat: string; tempat_tujuan: string; provinsi_tujuan: string;
  tanggal_berangkat: string; tanggal_kembali: string; alat_angkut: string;
  penandatangan_sp_id: string; peserta_ids: string[]; pengikut: CompanionRecord[];
  bbm: string; tol: string; penginapan: string;
};
type ValidationResult = { valid: boolean; errors: string[]; warnings: string[]; jumlah_peserta?: number; jumlah_hari?: number };
type IssueForm = { nomor_sp: string; nomor_sppd: string; tanggal_terbit: string; penandatangan_sp_id: string };
type PreviewResult = {
  validasi?: ValidationResult;
  biaya?: {
    peserta: { nama: string; kelompok_pegawai: string; tarif_harian: number; jumlah_hari: number; total_uang_harian: number }[];
    rincian_biaya_lain: { jenis: string; nominal: number; keterangan?: string }[];
    total_uh: number; total_bbm: number; total_tol: number; total_penginapan: number; total_biaya: number; jumlah_hari: number;
  } | null;
  catatan?: string;
};

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateLabel = (value: string) => value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00")) : "—";
const digits = (value: string) => value.replace(/[^0-9]/g, "");
const emptyForm = (province: string, activityId = ""): TripForm => ({
  kegiatan_id: activityId, anggaran_id: "", jenis_perjalanan: "luar_kota",
  nomor_undangan: "", tanggal_undangan: "", tanggal_acara_mulai: "",
  tanggal_acara_selesai: "", lokasi_acara: "", maksud_perjalanan: "",
  tempat_berangkat: "", tempat_tujuan: "", provinsi_tujuan: province,
  tanggal_berangkat: "", tanggal_kembali: "", alat_angkut: "",
  penandatangan_sp_id: "", peserta_ids: [], pengikut: [], bbm: "0", tol: "0", penginapan: "0"
});

export default function PerjalananClient({
  role, initialTrips, activities, budgets, employees, signers, kpas, provinces, pageError, startNew = false
}: {
  role: "admin" | "operator"; initialTrips: TripRecord[]; activities: ActivityOption[];
  budgets: BudgetOption[]; employees: EmployeeOption[]; signers: SignerOption[];
  kpas: KpaOption[]; provinces: string[]; pageError: string; startNew?: boolean;
}) {
  const router = useRouter();
  const [trips, setTrips] = useState(initialTrips);
  useEffect(() => { setTrips(initialTrips); }, [initialTrips]);
  const [remoteEmployeeConflicts, setRemoteEmployeeConflicts] = useState<Record<string, { tanggal_berangkat: string; tanggal_kembali: string }>>({});
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(startNew);
  const [editingTrip, setEditingTrip] = useState<TripRecord | null>(null);
  const [form, setForm] = useState<TripForm>(() => emptyForm(provinces.includes("Jawa Tengah") ? "Jawa Tengah" : provinces[0] ?? "", activities[0]?.id ?? ""));
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [resultTrip, setResultTrip] = useState<TripRecord | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [issuingTrip, setIssuingTrip] = useState<TripRecord | null>(null);
  const [issueForm, setIssueForm] = useState<IssueForm>({
    nomor_sp: "", nomor_sppd: "",
    tanggal_terbit: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    penandatangan_sp_id: ""
  });
  const [issueError, setIssueError] = useState("");
  const [issueBusy, setIssueBusy] = useState(false);


  useEffect(() => {
    let active = true;
    if (!form.kegiatan_id || !form.tanggal_berangkat || !form.tanggal_kembali || form.tanggal_kembali < form.tanggal_berangkat) {
      setRemoteEmployeeConflicts({});
      setAvailabilityChecking(false);
      setAvailabilityError("");
      return () => { active = false; };
    }
    setAvailabilityChecking(true);
    setAvailabilityError("");
    setRemoteEmployeeConflicts({});
    const supabase = createClient();
    Promise.resolve(supabase.rpc("sppd_cek_ketersediaan_pegawai", {
      p_kegiatan_id: form.kegiatan_id,
      p_tanggal_berangkat: form.tanggal_berangkat,
      p_tanggal_kembali: form.tanggal_kembali,
      p_perjalanan_id: editingTrip?.id ?? null
    })).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAvailabilityError("Ketersediaan pegawai belum dapat diperiksa. Muat ulang halaman atau coba lagi.");
        return;
      }
      const next: Record<string, { tanggal_berangkat: string; tanggal_kembali: string }> = {};
      (data ?? []).forEach((row: { pegawai_id: string; tanggal_berangkat: string; tanggal_kembali: string }) => {
        next[row.pegawai_id] = { tanggal_berangkat: row.tanggal_berangkat, tanggal_kembali: row.tanggal_kembali };
      });
      setRemoteEmployeeConflicts(next);
    }).catch(() => {
      if (active) setAvailabilityError("Ketersediaan pegawai belum dapat diperiksa. Muat ulang halaman atau coba lagi.");
    }).finally(() => {
      if (active) setAvailabilityChecking(false);
    });
    return () => { active = false; };
  }, [form.kegiatan_id, form.tanggal_berangkat, form.tanggal_kembali, editingTrip?.id]);

  const activeDrafts = trips.filter((trip) => trip.status === "draft").length;
  const publishedTrips = trips.filter((trip) => trip.status === "published").length;
  const cancelledTrips = trips.filter((trip) => trip.status === "cancelled").length;
  const filteredTrips = useMemo(() => trips.filter((trip) => {
    const text = [trip.maksud_perjalanan, trip.tempat_tujuan, trip.nama_kegiatan, trip.kode_kegiatan, trip.nama_bagian, trip.nama_peserta.join(" ")].join(" ").toLowerCase();
    return text.includes(search.toLowerCase()) && (statusFilter === "all" || trip.status === statusFilter);
  }), [trips, search, statusFilter]);

  const selectedActivity = activities.find((row) => row.id === form.kegiatan_id);
  const activityBudgets = budgets.filter((row) => row.kegiatan_id === form.kegiatan_id);
  const selectedBudget = activityBudgets.find((row) => row.id === form.anggaran_id) ?? activityBudgets[0];
  const selectedKpa = selectedActivity ? kpas.find((row) => row.bagian_id === selectedActivity.bagian_id) : undefined;
  const eligibleEmployees = employees.filter((row) => selectedActivity && row.bagian_id === selectedActivity.bagian_id &&
    (row.nama + " " + row.nip + " " + row.jabatan).toLowerCase().includes(participantSearch.toLowerCase()));
  const employeeConflict = (pegawaiId: string) => {
    const remote = remoteEmployeeConflicts[pegawaiId];
    if (remote) return { ...remote, maksud_perjalanan: "Perjalanan dinas lain" };
    if (!form.tanggal_berangkat || !form.tanggal_kembali) return undefined;
    return trips.find((trip) =>
      trip.id !== editingTrip?.id &&
      trip.status !== "cancelled" &&
      trip.peserta_ids.includes(pegawaiId) &&
      trip.tanggal_berangkat <= form.tanggal_kembali &&
      trip.tanggal_kembali >= form.tanggal_berangkat
    );
  };
  const isEselonII = (signer: SignerOption) => /eselon\s*ii|jabatan pimpinan tinggi pratama|sekretaris daerah|asisten|kepala dinas|kepala badan|staf ahli/i.test(signer.jabatan);
  const eligibleSigners = (participantIds: string[]) => signers.filter((signer) => !participantIds.includes(signer.pegawai_id) || isEselonII(signer));
  const activeSigners = signers;

  function updateForm<K extends keyof TripForm>(key: K, value: TripForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function openNew() {
    setEditingTrip(null);
    const nextForm = emptyForm(provinces.includes("Jawa Tengah") ? "Jawa Tengah" : provinces[0] ?? "", activities[0]?.id ?? "");
    const firstBudget = budgets.find((row) => row.kegiatan_id === activities[0]?.id);
    nextForm.anggaran_id = firstBudget?.id ?? "";
    setForm(nextForm);
    setFormError("");
    setParticipantSearch("");
    setShowForm(true);
  }
  function openEdit(trip: TripRecord) {
    setEditingTrip(trip);
    setForm({
      kegiatan_id: trip.kegiatan_id, anggaran_id: trip.anggaran_id,
      jenis_perjalanan: trip.jenis_perjalanan === "dalam_kota" ? "dalam_kota" : "luar_kota",
      nomor_undangan: trip.nomor_undangan, tanggal_undangan: trip.tanggal_undangan,
      tanggal_acara_mulai: trip.tanggal_acara_mulai, tanggal_acara_selesai: trip.tanggal_acara_selesai,
      lokasi_acara: trip.lokasi_acara, maksud_perjalanan: trip.maksud_perjalanan,
      tempat_berangkat: trip.tempat_berangkat, tempat_tujuan: trip.tempat_tujuan,
      provinsi_tujuan: trip.provinsi_tujuan, tanggal_berangkat: trip.tanggal_berangkat,
      tanggal_kembali: trip.tanggal_kembali, alat_angkut: trip.alat_angkut,
      penandatangan_sp_id: trip.penandatangan_sp_id, peserta_ids: trip.peserta_ids,
      pengikut: trip.pengikut, bbm: String(trip.bbm), tol: String(trip.tol), penginapan: String(trip.penginapan)
    });
    setFormError("");
    setParticipantSearch("");
    setShowForm(true);
  }
  function handleActivityChange(activityId: string) {
    const budget = budgets.find((row) => row.kegiatan_id === activityId);
    setForm((current) => ({ ...current, kegiatan_id: activityId, anggaran_id: budget?.id ?? "", penandatangan_sp_id: "" }));
  }
  function toggleParticipant(id: string) {
    if (!form.peserta_ids.includes(id)) {
      if (!form.tanggal_berangkat || !form.tanggal_kembali) {
        setFormError("Isi tanggal berangkat dan tanggal kembali terlebih dahulu untuk memeriksa ketersediaan pegawai.");
        return;
      }
      if (availabilityChecking || availabilityError) {
        setFormError(availabilityError || "Sedang memeriksa jadwal perjalanan pegawai. Tunggu sebentar.");
        return;
      }
      const conflict = employeeConflict(id);
      if (conflict) {
        const person = employees.find((row) => row.id === id);
        setFormError(`${person?.nama ?? "Pegawai"} sudah dijadwalkan pada perjalanan dinas lain tanggal ${dateLabel(conflict.tanggal_berangkat)} s.d. ${dateLabel(conflict.tanggal_kembali)}.`);
        return;
      }
    }
    setFormError("");
    setForm((current) => ({ ...current, peserta_ids: current.peserta_ids.includes(id)
      ? current.peserta_ids.filter((value) => value !== id) : [...current.peserta_ids, id] }));
  }
  function addCompanion() {
    setForm((current) => ({ ...current, pengikut: [...current.pengikut, { nama: "", tanggal_lahir: "", keterangan: "" }] }));
  }
  function updateCompanion(index: number, key: keyof CompanionRecord, value: string) {
    setForm((current) => ({ ...current, pengikut: current.pengikut.map((row, i) => i === index ? { ...row, [key]: value } : row) }));
  }
  function removeCompanion(index: number) {
    setForm((current) => ({ ...current, pengikut: current.pengikut.filter((_, i) => i !== index) }));
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!selectedActivity) return setFormError("Pilih subkegiatan terlebih dahulu.");
    if (!selectedBudget) return setFormError("Subkegiatan ini belum memiliki alokasi anggaran aktif.");
    if (!selectedKpa) return setFormError("Pengaturan pejabat untuk kegiatan ini belum lengkap. Hubungi Admin Global.");
    if (form.peserta_ids.length === 0) return setFormError("Pilih minimal satu pegawai sebagai peserta perjalanan.");
    if (editingTrip?.status === "published") {
      const signer = signers.find((item) => item.id === form.penandatangan_sp_id);
      if (!signer) return setFormError("Pilih penandatangan SP yang aktif.");
      const signerIsParticipant = form.peserta_ids.includes(signer.pegawai_id);
      const isEselonII = /eselon\\s*ii|jabatan pimpinan tinggi pratama|sekretaris daerah|asisten|kepala dinas|kepala badan|staf ahli/i.test(signer.jabatan);
      if (signerIsParticipant && !isEselonII) return setFormError("Penandatangan SP tidak boleh menjadi peserta perjalanan dinas, kecuali pejabat Eselon II.");
    }
    if (!form.tanggal_berangkat || !form.tanggal_kembali || !form.tanggal_acara_mulai || !form.tanggal_acara_selesai) return setFormError("Lengkapi tanggal perjalanan dan tanggal acara.");
    if (form.tanggal_kembali < form.tanggal_berangkat) return setFormError("Tanggal kembali tidak boleh sebelum tanggal berangkat.");
    if (availabilityChecking) return setFormError("Tunggu sebentar, sistem sedang memeriksa ketersediaan pegawai.");
    if (availabilityError) return setFormError(availabilityError);
    if (form.tanggal_acara_selesai < form.tanggal_acara_mulai) return setFormError("Tanggal acara selesai tidak boleh sebelum tanggal mulai.");
    if (!form.maksud_perjalanan.trim() || !form.lokasi_acara.trim() || !form.tempat_berangkat.trim() || !form.tempat_tujuan.trim() || !form.provinsi_tujuan) {
      return setFormError("Lengkapi maksud perjalanan, lokasi acara, asal, tujuan, dan provinsi tujuan.");
    }
    if (form.peserta_ids.some((id) => !employees.some((person) => person.id === id && person.bagian_id === selectedActivity.bagian_id))) {
      return setFormError("Pastikan seluruh peserta merupakan pegawai aktif pada Bagian subkegiatan yang dipilih.");
    }
    const conflictingParticipant = form.peserta_ids.map((id) => ({ id, conflict: employeeConflict(id) })).find((item) => item.conflict);
    if (conflictingParticipant?.conflict) {
      const person = employees.find((row) => row.id === conflictingParticipant.id);
      const conflict = conflictingParticipant.conflict;
      return setFormError(`${person?.nama ?? "Pegawai"} sudah memiliki perjalanan dinas lain pada ${dateLabel(conflict.tanggal_berangkat)} s.d. ${dateLabel(conflict.tanggal_kembali)}. Hapus pegawai tersebut atau ubah rentang tanggal perjalanan.`);
    }
    const payload = {
      perjalanan: {
        kegiatan_id: selectedActivity.id, anggaran_id: selectedBudget.id,
        jenis_perjalanan: form.jenis_perjalanan, nomor_undangan: form.nomor_undangan.trim(),
        tanggal_undangan: form.tanggal_undangan, tanggal_acara_mulai: form.tanggal_acara_mulai,
        tanggal_acara_selesai: form.tanggal_acara_selesai, lokasi_acara: form.lokasi_acara.trim(),
        maksud_perjalanan: form.maksud_perjalanan.trim(), tempat_berangkat: form.tempat_berangkat.trim(),
        tempat_tujuan: form.tempat_tujuan.trim(), provinsi_tujuan: form.provinsi_tujuan,
        tanggal_berangkat: form.tanggal_berangkat, tanggal_kembali: form.tanggal_kembali,
        alat_angkut: form.alat_angkut.trim(),
        ...(editingTrip?.status === "published" ? { penandatangan_sp_id: form.penandatangan_sp_id } : {})
      },
      peserta: form.peserta_ids.map((pegawai_id) => ({ pegawai_id })),
      pengikut: form.pengikut.filter((row) => row.nama.trim()).map((row) => ({
        nama: row.nama.trim(), tanggal_lahir: row.tanggal_lahir, keterangan: row.keterangan.trim()
      })),
      biaya: { bbm: Number(form.bbm || 0), tol: Number(form.tol || 0), penginapan: Number(form.penginapan || 0) }
    };

    setBusy(true);
    try {
      const supabase = createClient();
      const rpcName = editingTrip?.status === "published" ? "sppd_perbarui_perjalanan_terbit" : "sppd_simpan_draft";
      const { data, error } = await supabase.rpc(rpcName, { p_payload: payload, p_perjalanan_id: editingTrip?.id ?? null });
      if (error) throw new Error(error.message);
      const tripId = String(data);
      const { error: managerError } = await supabase.from("perjalanan_dinas").update({
        kpa_sppd_id: selectedKpa.id
      }).eq("id", tripId);
      if (managerError) throw new Error("Draf tersimpan, tetapi pengaturan KPA gagal ditautkan: " + managerError.message);
      setShowForm(false);
      setEditingTrip(null);
      setNotice(editingTrip?.status === "published" ? "Seluruh data perjalanan terbit berhasil diperbarui. Komitmen anggaran dihitung ulang." : editingTrip ? "Draf perjalanan berhasil diperbarui." : "Draf perjalanan berhasil dibuat.");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Draf perjalanan gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft(trip: TripRecord) {
    if (trip.status !== "draft") return setActionError("Hanya draf yang boleh dihapus. Perjalanan terbit/dibatalkan dipertahankan sebagai riwayat.");
    if (!window.confirm("Hapus permanen draf perjalanan ke " + trip.tempat_tujuan + "? Data yang dihapus tidak dapat dipulihkan.")) return;
    setActionBusy(trip.id); setActionError(""); setNotice("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("perjalanan_dinas").delete().eq("id", trip.id).eq("status", "draft");
      if (error) throw error;
      setTrips(current => current.filter(item => item.id !== trip.id));
      setNotice("Draf perjalanan berhasil dihapus.");
    } catch (e) { setActionError(e instanceof Error ? e.message : "Draf tidak dapat dihapus. Periksa relasi data."); }
    finally { setActionBusy(""); }
  }

  async function validateTrip(trip: TripRecord) {
    setActionBusy(trip.id); setValidation(null); setPreview(null); setResultTrip(trip);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("sppd_validasi_draft", { p_perjalanan_id: trip.id });
      if (error) throw new Error(error.message);
      setValidation(data as ValidationResult);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Validasi tidak berhasil dijalankan.");
      setResultTrip(null);
    } finally { setActionBusy(null); }
  }

  async function previewCosts(trip: TripRecord) {
    setActionBusy(trip.id); setValidation(null); setPreview(null); setResultTrip(trip);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("sppd_pratinjau_biaya", { p_perjalanan_id: trip.id });
      if (error) throw new Error(error.message);
      const result = data as PreviewResult;
      setPreview(result);
      setValidation(result.validasi ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Pratinjau biaya tidak berhasil dijalankan.");
      setResultTrip(null);
    } finally { setActionBusy(null); }
  }

  function openIssue(trip: TripRecord) {
    setIssuingTrip(trip);
    setIssueError("");
    const availableSigners = eligibleSigners(trip.peserta_ids);
    const currentSigner = availableSigners.find((signer) => signer.id === trip.penandatangan_sp_id);
    setIssueForm({
      nomor_sp: "",
      nomor_sppd: "",
      tanggal_terbit: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
      penandatangan_sp_id: currentSigner?.id || availableSigners[0]?.id || ""
    });
  }

  async function publishTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issuingTrip) return;
    setIssueError("");
    if (!issueForm.tanggal_terbit || !issueForm.penandatangan_sp_id) {
      setIssueError("Lengkapi tanggal terbit dan penandatangan SP.");
      return;
    }
    const selectedSigner = eligibleSigners(issuingTrip.peserta_ids).find((signer) => signer.id === issueForm.penandatangan_sp_id);
    if (!selectedSigner) { setIssueError("Penandatangan SP tidak boleh menjadi peserta perjalanan dinas, kecuali pejabat Eselon II."); return; }
    const activity = activities.find((row) => row.id === issuingTrip.kegiatan_id);
    const kpa = activity ? kpas.find((row) => row.bagian_id === activity.bagian_id) : undefined;
    if (!kpa) {
      setIssueError("KPA aktif untuk Bagian kegiatan belum dikonfigurasi. Hubungi Admin Global.");
      return;
    }
    setIssueBusy(true);
    try {
      const supabase = createClient();
      const { data: validationData, error: validationError } = await supabase.rpc("sppd_validasi_draft", {
        p_perjalanan_id: issuingTrip.id
      });
      if (validationError) throw new Error(validationError.message);
      const result = validationData as ValidationResult;
      if (!result.valid) {
        throw new Error("Draf belum lolos validasi: " + (result.errors ?? []).join("; "));
      }
      const { data, error } = await supabase.rpc("sppd_terbitkan", {
        p_perjalanan_id: issuingTrip.id,
        p_nomor_sp: issueForm.nomor_sp.trim() || null,
        p_nomor_sppd: issueForm.nomor_sppd.trim() || null,
        p_tanggal_terbit: issueForm.tanggal_terbit,
        p_penandatangan_sp_id: issueForm.penandatangan_sp_id
      });
      if (error) throw new Error(error.message);
      const resultData = data as { total_biaya?: number; nama_kpa?: string };
      setNotice("SP dan SPPD berhasil diterbitkan. Penandatangan SPPD otomatis: " + (resultData.nama_kpa ?? kpa.nama) + ". Total komitmen " + money(Number(resultData.total_biaya ?? 0)) + ".");
      setIssuingTrip(null);
      router.refresh();
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Penerbitan SP/SPPD gagal.");
    } finally {
      setIssueBusy(false);
    }
  }

  const statusName = (status: string) => status === "draft" ? "Draf" : status === "published" ? "Diterbitkan" : status === "cancelled" ? "Dibatalkan" : status;
  const statusClass = (status: string) => status === "published" ? "done" : status === "cancelled" ? "muted" : "pending";

  return (
    <div className="trip-page">
      <div className="trip-heading">
        <div><div className="eyebrow">ADMINISTRASI PERJALANAN DINAS</div><h1>Perjalanan Dinas</h1><p>{role === "admin" ? "Kelola seluruh pengajuan perjalanan dinas, peserta, dan perhitungan biaya." : "Kelola perjalanan dinas pada subkegiatan yang ditugaskan kepada akun Anda."}</p></div>
        <button className="primary-btn" onClick={openNew} disabled={activities.length === 0}><Plus size={17}/> Buat perjalanan</button>
      </div>
      {notice && <div className="trip-notice"><CheckCircle2 size={17}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Tutup"><X size={15}/></button></div>}
      {pageError && <div className="master-feedback error">{pageError}</div>}{actionError && <div className="master-feedback error">{actionError}</div>}
      <div className="trip-stats">
        <article><span>Total perjalanan</span><strong>{trips.length}</strong><small>Dalam lingkup akses akun</small></article>
        <article><span>Draf</span><strong>{activeDrafts}</strong><small>Menunggu pemeriksaan</small></article>
        <article><span>Diterbitkan</span><strong>{publishedTrips}</strong><small>SP/SPPD diterbitkan</small></article>
        <article><span>Dibatalkan</span><strong>{cancelledTrips}</strong><small>Riwayat pembatalan</small></article>
      </div>
      <section className="trip-list-card">
        <div className="trip-list-toolbar">
          <div><h2>Daftar pengajuan</h2><p>Gunakan pencarian untuk menemukan perjalanan berdasarkan maksud, tujuan, atau subkegiatan.</p></div>
          <div className="trip-tools">
            <div className="trip-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari perjalanan..." /></div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter status">
              <option value="all">Semua status</option><option value="draft">Draf</option><option value="published">Diterbitkan</option><option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>
        <div className="trip-table-wrap">
          <table className="trip-table"><thead><tr><th>PERJALANAN</th><th>KEGIATAN</th><th>TUJUAN</th><th>WAKTU</th><th>PESERTA</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody>{filteredTrips.length ? filteredTrips.map((trip) => (
              <tr key={trip.id}>
                <td data-label="Perjalanan"><b>{trip.maksud_perjalanan}</b><small>{trip.jenis_perjalanan === "luar_kota" ? "Luar kota" : "Dalam kota"} · {trip.nama_bagian}</small></td>
                <td data-label="Kegiatan"><b>{trip.kode_kegiatan || "Subkegiatan"}</b><small>{trip.nama_kegiatan}</small></td>
                <td data-label="Tujuan"><span className="trip-destination"><MapPin size={13}/>{trip.tempat_tujuan}</span><small>{trip.provinsi_tujuan}</small></td>
                <td data-label="Waktu">{dateLabel(trip.tanggal_berangkat)}<small>s.d. {dateLabel(trip.tanggal_kembali)}</small></td>
                <td data-label="Peserta"><span className="trip-participant-count"><Users size={14}/>{trip.peserta_ids.length} orang</span><small>{trip.peserta_ids.length > 4 ? "Daftar pada lampiran" : trip.nama_peserta.slice(0,2).join(", ") || "Belum dipilih"}</small></td>
                <td data-label="Status"><span className={"trip-status " + statusClass(trip.status)}><i/>{statusName(trip.status)}</span></td>
                <td data-label="Aksi"><div className="trip-row-actions">
                  {(trip.status === "draft" || trip.status === "published") && <button className={trip.status === "published" ? "trip-edit-cost" : ""} onClick={() => openEdit(trip)} title="Edit seluruh data perjalanan"><Edit3 size={15}/>{trip.status === "published" && <span>Edit</span>}</button>}
                  {trip.status === "draft" && <button onClick={() => validateTrip(trip)} title="Validasi draf" disabled={actionBusy === trip.id}><ClipboardCheck size={15}/></button>}
                  {trip.status === "draft" && <button onClick={() => previewCosts(trip)} title="Pratinjau biaya" disabled={actionBusy === trip.id}><Eye size={15}/></button>}
                  {trip.status === "draft" && <button onClick={() => openIssue(trip)} title="Terbitkan SP dan SPPD"><FileText size={15}/></button>}\n                  {trip.status === "draft" && <button onClick={() => deleteDraft(trip)} title="Hapus draf" disabled={actionBusy === trip.id}><Trash2 size={15}/></button>}
                  
                </div></td>
              </tr>
            )) : <tr><td colSpan={7} className="trip-empty"><Plane size={24}/><b>Belum ada perjalanan yang cocok</b><span>Buat pengajuan baru atau ubah kata kunci pencarian.</span></td></tr>}</tbody>
          </table>
        </div>
        <div className="trip-list-footer">Menampilkan <b>{filteredTrips.length}</b> dari <b>{trips.length}</b> perjalanan</div>
      </section>

      {showForm && <div className="trip-modal-backdrop" role="presentation">
        <section className="trip-modal" role="dialog" aria-modal="true" aria-labelledby="trip-form-title">
          <div className="trip-modal-header"><div><span className="eyebrow">FORMULIR PENGAJUAN</span><h2 id="trip-form-title">{editingTrip?.status === "published" ? "Edit perjalanan yang telah terbit" : editingTrip ? "Ubah draf perjalanan" : "Buat perjalanan dinas"}</h2><p>{editingTrip?.status === "published" ? "Semua rincian perjalanan dapat diperbarui. Dokumen SP/SPPD yang sudah terbit tetap dipertahankan." : "Lengkapi rincian perjalanan sebelum draf disimpan."}</p></div>
            <button className="trip-close" onClick={() => setShowForm(false)} aria-label="Tutup"><X size={18}/></button>
          </div>
          <form onSubmit={saveDraft}>
            <div className="trip-form-body">
              <section className="trip-form-section">
                <div className="trip-section-title"><span>01</span><div><h3>Informasi kegiatan</h3><p>Pilih subkegiatan dan sumber anggaran yang sesuai.</p></div></div>
                <div className="trip-form-grid">
                  <label className="trip-field trip-field-wide">Subkegiatan
                    <select required value={form.kegiatan_id} onChange={(event) => handleActivityChange(event.target.value)}>
                      <option value="">Pilih subkegiatan</option>{activities.map((item) => <option value={item.id} key={item.id}>{item.kode ? item.kode + " — " : ""}{item.nama} · {item.nama_bagian} · {item.tahun}</option>)}
                    </select>
                  </label>
                  <label className="trip-field trip-field-wide">Rekening / alokasi anggaran
                    <select required value={selectedBudget?.id ?? ""} onChange={(event) => updateForm("anggaran_id", event.target.value)}>
                      <option value="">Pilih alokasi anggaran</option>{activityBudgets.map((budget) => <option value={budget.id} key={budget.id}>{budget.kode_rekening} — {budget.nama_rekening}</option>)}
                    </select>
                    {selectedBudget && <small className="trip-field-note">Pagu tersedia: <b>{money(selectedBudget.pagu_tersedia)}</b> · Komitmen: {money(selectedBudget.komitmen_aktif)}</small>}
                    {!activityBudgets.length && form.kegiatan_id && <small className="trip-field-error">Belum ada alokasi anggaran aktif untuk subkegiatan ini.</small>}
                  </label>
                  <label className="trip-field">Jenis perjalanan<select value={form.jenis_perjalanan} onChange={(event) => updateForm("jenis_perjalanan", event.target.value as TripForm["jenis_perjalanan"])}><option value="luar_kota">Perjalanan dinas luar kota</option><option value="dalam_kota">Perjalanan dinas dalam kota</option></select></label>
                  <label className="trip-field">Alat angkut<input value={form.alat_angkut} onChange={(event) => updateForm("alat_angkut", event.target.value)} placeholder="Contoh: Kendaraan dinas" /></label>
                  <label className="trip-field">Nomor undangan (opsional)<input value={form.nomor_undangan} onChange={(event) => updateForm("nomor_undangan", event.target.value)} placeholder="Nomor surat undangan" /></label>
                  <label className="trip-field">Tanggal undangan (opsional)<input type="date" value={form.tanggal_undangan} onChange={(event) => updateForm("tanggal_undangan", event.target.value)} /></label>
                </div>
              </section>
              <section className="trip-form-section">
                <div className="trip-section-title"><span>02</span><div><h3>Waktu dan tujuan</h3><p>Masukkan tanggal perjalanan serta lokasi kegiatan.</p></div></div>
                <div className="trip-form-grid">
                  <label className="trip-field">Tanggal berangkat<input required type="date" value={form.tanggal_berangkat} onChange={(event) => updateForm("tanggal_berangkat", event.target.value)} /></label>
                  <label className="trip-field">Tanggal kembali<input required type="date" min={form.tanggal_berangkat || undefined} value={form.tanggal_kembali} onChange={(event) => updateForm("tanggal_kembali", event.target.value)} /></label>
                  <label className="trip-field">Tanggal acara mulai<input required type="date" value={form.tanggal_acara_mulai} onChange={(event) => updateForm("tanggal_acara_mulai", event.target.value)} /></label>
                  <label className="trip-field">Tanggal acara selesai<input required type="date" min={form.tanggal_acara_mulai || undefined} value={form.tanggal_acara_selesai} onChange={(event) => updateForm("tanggal_acara_selesai", event.target.value)} /></label>
                  <label className="trip-field">Tempat berangkat<input required value={form.tempat_berangkat} onChange={(event) => updateForm("tempat_berangkat", event.target.value)} placeholder="Contoh: Kajen" /></label>
                  <label className="trip-field">Tempat tujuan<input required value={form.tempat_tujuan} onChange={(event) => updateForm("tempat_tujuan", event.target.value)} placeholder="Kota / kabupaten tujuan" /></label>
                  <label className="trip-field">Provinsi tujuan<select required value={form.provinsi_tujuan} onChange={(event) => updateForm("provinsi_tujuan", event.target.value)}><option value="">Pilih provinsi</option>{provinces.map((province) => <option key={province} value={province}>{province}</option>)}</select></label>
                  <label className="trip-field">Lokasi acara<input required value={form.lokasi_acara} onChange={(event) => updateForm("lokasi_acara", event.target.value)} placeholder="Nama gedung / alamat lokasi acara" /></label>
                  <label className="trip-field trip-field-wide">Maksud perjalanan<textarea required rows={3} value={form.maksud_perjalanan} onChange={(event) => updateForm("maksud_perjalanan", event.target.value)} placeholder="Uraikan maksud dan tujuan perjalanan dinas..." /></label>
                </div>
              </section>
              <section className="trip-form-section">
                <div className="trip-section-title"><span>03</span><div><h3>Peserta perjalanan</h3><p>Pilih pegawai aktif dari Bagian yang memiliki subkegiatan.</p></div></div>
                <div className="trip-participant-head"><div className="trip-search"><Search size={15}/><input value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} placeholder="Cari nama atau NIP..." /></div><span>{form.peserta_ids.length} peserta dipilih</span></div>
                {!form.tanggal_berangkat || !form.tanggal_kembali
                  ? <div className="trip-field-note">Isi tanggal berangkat dan kembali terlebih dahulu agar sistem dapat memeriksa jadwal pegawai.</div>
                  : availabilityChecking
                    ? <div className="trip-field-note">Memeriksa ketersediaan jadwal pegawai...</div>
                    : availabilityError
                      ? <div className="trip-form-error"><AlertCircle size={15}/>{availabilityError}</div>
                      : <div className="trip-field-note">Pemeriksaan jadwal selesai. Pegawai yang memiliki perjalanan dinas pada rentang tanggal ini akan dinonaktifkan.</div>}
                <div className="trip-employee-list">
                  {eligibleEmployees.length ? eligibleEmployees.map((person) => {
                    const conflict = employeeConflict(person.id);
                    const selected = form.peserta_ids.includes(person.id);
                    return <label className={"trip-employee-option " + (selected ? "selected" : "") + (conflict ? " unavailable" : "")} key={person.id}>
                      <input type="checkbox" checked={selected} disabled={!selected && (!form.tanggal_berangkat || !form.tanggal_kembali || availabilityChecking || Boolean(availabilityError) || Boolean(conflict))} onChange={() => toggleParticipant(person.id)} /><span className="trip-check"><Check size={13}/></span>
                      <span className="trip-employee-avatar"><UserRound size={16}/></span><span className="trip-employee-info"><b>{person.nama}</b><small>{person.nip || "NIP belum tersedia"} · {person.pangkat_golongan || person.status_kepegawaian}</small>
                      {conflict && <small className="trip-employee-conflict">Tidak tersedia: perjalanan lain {dateLabel(conflict.tanggal_berangkat)} s.d. {dateLabel(conflict.tanggal_kembali)}</small>}</span>
                    </label>;
                  }) : <div className="trip-no-employee">Tidak ada pegawai aktif yang sesuai dengan Bagian subkegiatan.</div>}
                </div>
                {form.peserta_ids.length > 4 && <div className="trip-attachment-hint"><FileText size={16}/><span>Lebih dari 4 peserta. Daftar nama pegawai akan ditempatkan pada lampiran dokumen.</span></div>}
              </section>
              {editingTrip?.status === "published" && <section className="trip-form-section">
                <div className="trip-section-title"><span>04</span><div><h3>Penandatangan Surat Perintah</h3><p>Pejabat yang menjadi peserta tidak boleh menandatangani SP sendiri, kecuali Eselon II.</p></div></div>
                <label className="trip-field trip-field-wide">Penandatangan SP
                  <select required value={form.penandatangan_sp_id} onChange={(event) => updateForm("penandatangan_sp_id", event.target.value)}>
                    <option value="">Pilih penandatangan SP</option>
                    {signers.map((signer) => <option value={signer.id} key={signer.id}>{signer.nama} — {signer.jabatan}</option>)}
                  </select>
                </label>
              </section>}
              <section className="trip-form-section">
                <div className="trip-section-title"><span>{editingTrip?.status === "published" ? "05" : "04"}</span><div><h3>Pengikut dan biaya lainnya</h3><p>Pengikut bersifat opsional. BBM dan tol diinput manual untuk rombongan.</p></div></div>
                <div className="trip-companion-list">{form.pengikut.map((person, index) => <div className="trip-companion-row" key={index}>
                  <label className="trip-field">Nama pengikut<input value={person.nama} onChange={(event) => updateCompanion(index, "nama", event.target.value)} placeholder="Nama lengkap" /></label>
                  <label className="trip-field">Tanggal lahir<input type="date" value={person.tanggal_lahir} onChange={(event) => updateCompanion(index, "tanggal_lahir", event.target.value)} /></label>
                  <label className="trip-field">Keterangan<input value={person.keterangan} onChange={(event) => updateCompanion(index, "keterangan", event.target.value)} placeholder="Hubungan / keterangan" /></label>
                  <button type="button" className="trip-icon-danger" onClick={() => removeCompanion(index)} aria-label="Hapus pengikut"><Trash2 size={16}/></button>
                </div>)}</div>
                <button type="button" className="trip-add-link" onClick={addCompanion}><Plus size={15}/> Tambah pengikut</button>
                <div className="trip-form-grid trip-cost-grid">
                  <label className="trip-field">Biaya BBM (Rp)<input inputMode="numeric" value={form.bbm} onChange={(event) => updateForm("bbm", digits(event.target.value))} placeholder="0" /></label>
                  <label className="trip-field">Biaya tol (Rp)<input inputMode="numeric" value={form.tol} onChange={(event) => updateForm("tol", digits(event.target.value))} placeholder="0" /></label>
                  <label className="trip-field">Biaya penginapan (Rp)<input inputMode="numeric" value={form.penginapan} onChange={(event) => updateForm("penginapan", digits(event.target.value))} placeholder="0" /></label>
                </div>
              </section>
            </div>
            {formError && <div className="trip-form-error"><AlertCircle size={16}/>{formError}</div>}
            <div className="trip-modal-footer"><span><Clock3 size={14}/> {editingTrip?.status === "published" ? "Komitmen anggaran dihitung ulang saat disimpan." : "Disimpan sebagai draf, belum diterbitkan."}</span><div>
              <button type="button" className="secondary-btn" onClick={() => setShowForm(false)} disabled={busy}>Tutup</button>
              <button type="submit" className="primary-btn" disabled={busy}>{busy ? "Menyimpan..." : <><CheckCircle2 size={16}/> {editingTrip?.status === "published" ? "Simpan perubahan" : "Simpan draf"}</>}</button>
            </div></div>
          </form>
        </section>
      </div>}

      {issuingTrip && <div className="trip-modal-backdrop" role="presentation">
        <section className="trip-result-modal" role="dialog" aria-modal="true" aria-labelledby="trip-issue-title">
          <div className="trip-modal-header">
            <div><span className="eyebrow">PENERBITAN DOKUMEN</span><h2 id="trip-issue-title">Terbitkan SP dan SPPD</h2><p>{issuingTrip.maksud_perjalanan} · {issuingTrip.tempat_tujuan}</p></div>
            <button className="trip-close" onClick={() => setIssuingTrip(null)} aria-label="Tutup"><X size={18}/></button>
          </div>
          <form onSubmit={publishTrip}>
            <div className="trip-result-body">
              <div className="trip-form-grid">
                <label className="trip-field">Nomor Surat Perintah (SP)
                  <input value={issueForm.nomor_sp} onChange={(event) => setIssueForm((current) => ({ ...current, nomor_sp: event.target.value }))} placeholder="Kosongkan untuk diisi manual (ditulis tangan)" />
                  <small className="trip-field-note">Opsional</small>
                </label>
                <label className="trip-field">Nomor SPPD
                  <input value={issueForm.nomor_sppd} onChange={(event) => setIssueForm((current) => ({ ...current, nomor_sppd: event.target.value }))} placeholder="Kosongkan untuk diisi manual (ditulis tangan)" />
                  <small className="trip-field-note">Opsional</small>
                </label>
                <label className="trip-field trip-field-wide">Tanggal terbit
                  <input required type="date" value={issueForm.tanggal_terbit} onChange={(event) => setIssueForm((current) => ({ ...current, tanggal_terbit: event.target.value }))} />
                </label>
                <label className="trip-field trip-field-wide">Penandatangan Surat Perintah (SP)
                  <select required value={issueForm.penandatangan_sp_id} onChange={(event) => setIssueForm((current) => ({ ...current, penandatangan_sp_id: event.target.value }))}>
                    <option value="">Pilih penandatangan SP</option>
                    {eligibleSigners(issuingTrip.peserta_ids).map((signer) => <option value={signer.id} key={signer.id}>{signer.nama} — {signer.jabatan}</option>)}
                  </select>
                </label>
              </div>
              <div className="trip-validation-banner valid" style={{ marginTop: 16 }}>
                <CheckCircle2 size={19}/>
                <div><b>Penandatangan SPPD ditetapkan otomatis oleh sistem</b><span>{activities.find((row) => row.id === issuingTrip.kegiatan_id)?.nama_bagian ?? "Bagian kegiatan"} · KPA: {kpas.find((row) => row.bagian_id === activities.find((activity) => activity.id === issuingTrip.kegiatan_id)?.bagian_id)?.nama ?? "Belum dikonfigurasi"}</span></div>
              </div>
              <p className="trip-field-note">Sistem memvalidasi draf dan ketersediaan anggaran sebelum menerbitkan. Penerbitan akan mengikat komitmen anggaran; setelah diterbitkan, draf tidak dapat diubah seperti sebelumnya.</p>
              {issueError && <div className="trip-form-error"><AlertCircle size={16}/>{issueError}</div>}
            </div>
            <div className="trip-modal-footer"><span><Wallet size={14}/> Komitmen anggaran dibuat saat penerbitan berhasil.</span><div>
              <button type="button" className="secondary-btn" onClick={() => setIssuingTrip(null)} disabled={issueBusy}>Batal</button>
              <button type="submit" className="primary-btn" disabled={issueBusy}>{issueBusy ? "Memproses..." : <><FileText size={16}/> Terbitkan</>}</button>
            </div></div>
          </form>
        </section>
      </div>}

      {resultTrip && <div className="trip-modal-backdrop" role="presentation">
        <section className="trip-result-modal" role="dialog" aria-modal="true" aria-labelledby="trip-result-title">
          <div className="trip-modal-header"><div><span className="eyebrow">PEMERIKSAAN PENGAJUAN</span><h2 id="trip-result-title">{preview ? "Pratinjau biaya perjalanan" : "Hasil validasi draf"}</h2><p>{resultTrip.maksud_perjalanan} · {resultTrip.tempat_tujuan}</p></div>
            <button className="trip-close" onClick={() => { setResultTrip(null); setValidation(null); setPreview(null); }} aria-label="Tutup"><X size={18}/></button>
          </div>
          <div className="trip-result-body">
            {validation && <div className={"trip-validation-banner " + (validation.valid ? "valid" : "invalid")}>
              {validation.valid ? <CheckCircle2 size={19}/> : <AlertCircle size={19}/>}
              <div><b>{validation.valid ? "Draf lolos validasi awal" : "Draf belum siap diterbitkan"}</b><span>{validation.valid ? (validation.jumlah_peserta ?? resultTrip.peserta_ids.length) + " peserta · " + (validation.jumlah_hari ?? "—") + " hari perjalanan" : "Periksa hal-hal yang perlu dilengkapi di bawah ini."}</span></div>
            </div>}
            {validation?.errors?.length ? <div className="trip-check-list"><h3>Perlu diperbaiki</h3>{validation.errors.map((item, index) => <div key={index}><AlertCircle size={15}/>{item}</div>)}</div> : null}
            {validation?.warnings?.length ? <div className="trip-check-list warning"><h3>Catatan pemeriksaan</h3>{validation.warnings.map((item, index) => <div key={index}><AlertCircle size={15}/>{item}</div>)}</div> : null}
            {preview?.biaya && <>
              <div className="trip-cost-summary"><span>Total perkiraan biaya</span><strong>{money(preview.biaya.total_biaya)}</strong><small>{preview.biaya.jumlah_hari} hari perjalanan · belum menjadi komitmen anggaran</small></div>
              <div className="trip-cost-lines"><div><span>Uang Harian</span><b>{money(preview.biaya.total_uh)}</b></div><div><span>BBM</span><b>{money(preview.biaya.total_bbm)}</b></div><div><span>Tol</span><b>{money(preview.biaya.total_tol)}</b></div><div><span>Penginapan</span><b>{money(preview.biaya.total_penginapan)}</b></div></div>
              <h3 className="trip-result-subtitle">Rincian Uang Harian peserta</h3>
              <div className="trip-preview-table"><table><thead><tr><th>Nama peserta</th><th>Kelompok</th><th>Tarif / hari</th><th>Jumlah</th></tr></thead><tbody>{preview.biaya.peserta.map((item, index) => <tr key={index}><td>{item.nama}</td><td>{item.kelompok_pegawai}</td><td>{money(item.tarif_harian)}</td><td>{money(item.total_uang_harian)}</td></tr>)}</tbody></table></div>
              {preview.catatan && <p className="trip-field-note">{preview.catatan}</p>}
            </>}
          </div>
          <div className="trip-modal-footer"><span><Wallet size={14}/> Perhitungan mengikuti tarif UH aktif pada database.</span><div><button className="secondary-btn" onClick={() => { setResultTrip(null); setValidation(null); setPreview(null); }}>Tutup</button></div></div>
        </section>
      </div>}
    </div>
  );
}
