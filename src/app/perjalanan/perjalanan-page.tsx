import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PerjalananShell from "@/components/perjalanan-shell";
import PerjalananClient, {
  type ActivityOption, type BudgetOption, type EmployeeOption, type SignerOption,
  type KpaOption, type TripRecord, type CompanionRecord
} from "./perjalanan-client";

export const dynamic = "force-dynamic";

type DbRow = Record<string, any>;

export default async function PerjalananPage({ startNew = false }: { startNew?: boolean }) {
  const perfStart = performance.now();
  const markPerf = (phase: string) => {
    console.info(`[SPPD_PERF] /perjalanan ${phase}: ${Math.round(performance.now() - perfStart)}ms`);
  };
  const supabase = await createClient();
  markPerf("client");
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  markPerf("auth");
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("user_akun")
    .select("username,role,pegawai_id,aktif,must_change_password")
    .eq("id", userId)
    .maybeSingle();
  markPerf("profile");

  if (!profile || !profile.aktif || profile.must_change_password) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "operator") redirect("/dashboard");
  if (profile.role === "admin" && profile.pegawai_id !== null) redirect("/dashboard");
  if (profile.role === "operator" && !profile.pegawai_id) redirect("/dashboard");

  const isAdmin = profile.role === "admin";
  const [
    activityResult, sectionResult, budgetResult, accountResult, summaryResult,
    employeeResult, signerResult, kpaResult, tripResult, participantResult,
    companionResult, otherCostResult, rateResult
  ] = await Promise.all([
    supabase.from("kegiatan")
      .select("id,bagian_id,kode_subkegiatan,nama_subkegiatan,tahun_anggaran,aktif")
      .eq("aktif", true)
      .order("tahun_anggaran", { ascending: false })
      .order("nama_subkegiatan", { ascending: true }),
    supabase.from("bagian").select("id,nama_bagian,aktif").eq("aktif", true).order("nama_bagian"),
    supabase.from("anggaran").select("id,kegiatan_id,rekening_id,pagu_awal,aktif").eq("aktif", true),
    supabase.from("rekening_belanja").select("id,kode_rekening,nama_rekening,aktif").eq("aktif", true),
    supabase.from("v_ringkasan_anggaran").select("anggaran_id,pagu_setelah_mutasi,komitmen_aktif,pagu_tersedia"),
    supabase.from("pegawai")
      .select("id,bagian_id,nama,nip,status_kepegawaian,pangkat_golongan,jabatan,aktif")
      .eq("aktif", true).order("nama"),
    supabase.from("pejabat_dokumen")
      .select("id,pegawai_id,jabatan_dokumen")
      .eq("jenis_peran", "penandatangan_sp").eq("aktif", true),
    supabase.from("pejabat_pengelola")
      .select("id,pegawai_id,bagian_id")
      .eq("jenis_peran", "KPA").eq("aktif", true),
    supabase.from("perjalanan_dinas")
      .select("id,kegiatan_id,anggaran_id,jenis_perjalanan,nomor_undangan,tanggal_undangan,tanggal_acara_mulai,tanggal_acara_selesai,lokasi_acara,maksud_perjalanan,tempat_berangkat,tempat_tujuan,provinsi_tujuan,tanggal_berangkat,tanggal_kembali,alat_angkut,status,penandatangan_sp_id,kpa_sppd_id,created_at,updated_at")
      .order("created_at", { ascending: false }),
    supabase.from("perjalanan_peserta").select("perjalanan_id,pegawai_id,nama_snapshot"),
    supabase.from("perjalanan_pengikut").select("perjalanan_id,nama,tanggal_lahir,keterangan"),
    supabase.from("perjalanan_biaya_lain").select("perjalanan_id,jenis_biaya,nominal"),
    supabase.from("tarif_uang_harian").select("provinsi").eq("aktif", true)
  ]);
  markPerf("13 parallel queries");

  const activityRows = (activityResult.data ?? []) as DbRow[];
  const sectionRows = (sectionResult.data ?? []) as DbRow[];
  const employeeRows = (employeeResult.data ?? []) as DbRow[];
  const accountRows = (accountResult.data ?? []) as DbRow[];
  const sectionMap = new Map(sectionRows.map((row) => [row.id, row.nama_bagian]));
  const employeeMap = new Map(employeeRows.map((row) => [row.id, row]));
  const accountMap = new Map(accountRows.map((row) => [row.id, row]));
  const summaryMap = new Map(((summaryResult.data ?? []) as DbRow[]).map((row) => [row.anggaran_id, row]));

  const activities: ActivityOption[] = activityRows.map((row) => ({
    id: row.id,
    bagian_id: row.bagian_id,
    kode: (row.kode_subkegiatan ?? "").trim(),
    nama: (row.nama_subkegiatan ?? "").trim(),
    tahun: Number(row.tahun_anggaran),
    nama_bagian: sectionMap.get(row.bagian_id) ?? "Bagian",
  }));

  const budgets: BudgetOption[] = (budgetResult.data ?? []).map((row: DbRow) => {
    const account = accountMap.get(row.rekening_id);
    const summary = summaryMap.get(row.id);
    return {
      id: row.id,
      kegiatan_id: row.kegiatan_id,
      pagu_awal: Number(row.pagu_awal ?? 0),
      pagu_tersedia: Number(summary?.pagu_tersedia ?? row.pagu_awal ?? 0),
      komitmen_aktif: Number(summary?.komitmen_aktif ?? 0),
      kode_rekening: account?.kode_rekening ?? "",
      nama_rekening: account?.nama_rekening ?? "Rekening perjalanan dinas",
    };
  });

  const employees: EmployeeOption[] = employeeRows.map((row) => ({
    id: row.id,
    bagian_id: row.bagian_id,
    nama: row.nama,
    nip: row.nip ?? "",
    status_kepegawaian: row.status_kepegawaian,
    pangkat_golongan: row.pangkat_golongan ?? "",
    jabatan: row.jabatan ?? "",
  }));

  const signers: SignerOption[] = ((signerResult.data ?? []) as DbRow[]).map((row) => {
    const employee = employeeMap.get(row.pegawai_id);
    return {
      id: row.id,
      pegawai_id: row.pegawai_id,
      nama: employee?.nama ?? "Pejabat tidak ditemukan",
      jabatan: row.jabatan_dokumen ?? employee?.jabatan ?? "",
      bagian_id: employee?.bagian_id ?? null,
    };
  });

  const kpas: KpaOption[] = ((kpaResult.data ?? []) as DbRow[]).map((row) => ({
    id: row.id,
    bagian_id: row.bagian_id,
    nama: employeeMap.get(row.pegawai_id)?.nama ?? "Pejabat KPA",
  }));

  const peopleByTrip = new Map<string, string[]>();
  const participantIdsByTrip = new Map<string, string[]>();
  ((participantResult.data ?? []) as DbRow[]).forEach((row) => {
    const names = peopleByTrip.get(row.perjalanan_id) ?? [];
    names.push(row.nama_snapshot ?? "Peserta");
    peopleByTrip.set(row.perjalanan_id, names);
    const ids = participantIdsByTrip.get(row.perjalanan_id) ?? [];
    ids.push(row.pegawai_id);
    participantIdsByTrip.set(row.perjalanan_id, ids);
  });

  const companionsByTrip = new Map<string, CompanionRecord[]>();
  ((companionResult.data ?? []) as DbRow[]).forEach((row) => {
    const values = companionsByTrip.get(row.perjalanan_id) ?? [];
    values.push({ nama: row.nama, tanggal_lahir: row.tanggal_lahir ?? "", keterangan: row.keterangan ?? "" });
    companionsByTrip.set(row.perjalanan_id, values);
  });

  const costsByTrip = new Map<string, { bbm: number; tol: number; penginapan: number }>();
  ((otherCostResult.data ?? []) as DbRow[]).forEach((row) => {
    const value = costsByTrip.get(row.perjalanan_id) ?? { bbm: 0, tol: 0, penginapan: 0 };
    if (row.jenis_biaya === "bbm") value.bbm = Number(row.nominal ?? 0);
    if (row.jenis_biaya === "tol") value.tol = Number(row.nominal ?? 0);
    if (row.jenis_biaya === "penginapan") value.penginapan = Number(row.nominal ?? 0);
    costsByTrip.set(row.perjalanan_id, value);
  });

  const activityMap = new Map(activities.map((row) => [row.id, row]));
  const trips: TripRecord[] = ((tripResult.data ?? []) as DbRow[]).map((row) => {
    const activity = activityMap.get(row.kegiatan_id);
    const costs = costsByTrip.get(row.id) ?? { bbm: 0, tol: 0, penginapan: 0 };
    return {
      id: row.id,
      kegiatan_id: row.kegiatan_id,
      anggaran_id: row.anggaran_id,
      jenis_perjalanan: row.jenis_perjalanan,
      nomor_undangan: row.nomor_undangan ?? "",
      tanggal_undangan: row.tanggal_undangan ?? "",
      tanggal_acara_mulai: row.tanggal_acara_mulai,
      tanggal_acara_selesai: row.tanggal_acara_selesai,
      lokasi_acara: row.lokasi_acara,
      maksud_perjalanan: row.maksud_perjalanan,
      tempat_berangkat: row.tempat_berangkat,
      tempat_tujuan: row.tempat_tujuan,
      provinsi_tujuan: row.provinsi_tujuan,
      tanggal_berangkat: row.tanggal_berangkat,
      tanggal_kembali: row.tanggal_kembali,
      alat_angkut: row.alat_angkut ?? "",
      status: row.status,
      penandatangan_sp_id: row.penandatangan_sp_id ?? "",
      kpa_sppd_id: row.kpa_sppd_id ?? "",
      created_at: row.created_at,
      nama_kegiatan: activity?.nama ?? "Kegiatan",
      kode_kegiatan: activity?.kode ?? "",
      nama_bagian: activity?.nama_bagian ?? "Bagian",
      nama_peserta: peopleByTrip.get(row.id) ?? [],
      peserta_ids: participantIdsByTrip.get(row.id) ?? [],
      pengikut: companionsByTrip.get(row.id) ?? [],
      bbm: costs.bbm,
      tol: costs.tol,
      penginapan: costs.penginapan,
    };
  });

  const queryErrors = [
    activityResult.error, budgetResult.error, accountResult.error,
    employeeResult.error, tripResult.error, participantResult.error
  ].filter(Boolean);
  const pageError = queryErrors.length
    ? "Sebagian data perjalanan belum dapat dimuat. Periksa izin akses Supabase atau muat ulang halaman."
    : "";

  const provinces = Array.from(new Set(((rateResult.data ?? []) as DbRow[]).map((row) => String(row.provinsi))))
    .filter(Boolean).sort((a, b) => a.localeCompare(b, "id"));
  markPerf("transform");

  return (
    <PerjalananShell username={profile.username ?? "Pengguna"} role={profile.role}>
      <PerjalananClient
        role={profile.role}
        initialTrips={trips}
        activities={activities}
        budgets={budgets}
        employees={employees}
        signers={signers}
        kpas={kpas}
        provinces={provinces}
        pageError={pageError}
        startNew={startNew}
      />
    </PerjalananShell>
  );
}
