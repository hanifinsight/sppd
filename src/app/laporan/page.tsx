import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PerjalananShell from "@/components/perjalanan-shell";
import LaporanClient, { type ReportTrip } from "./laporan-client";

export const dynamic = "force-dynamic";
type DbRow = Record<string, any>;

export default async function LaporanPage({
  searchParams
}: {
  searchParams: Promise<{ tahun?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const requestedYear = Number(params.tahun ?? currentYear);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= currentYear + 1
    ? requestedYear
    : currentYear;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("user_akun")
    .select("username,role,pegawai_id,aktif,must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.aktif || profile.must_change_password) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "operator") redirect("/dashboard");
  if (profile.role === "admin" && profile.pegawai_id !== null) redirect("/dashboard");
  if (profile.role === "operator" && !profile.pegawai_id) redirect("/dashboard");

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [tripResult, activityResult, sectionResult] = await Promise.all([
    supabase.from("perjalanan_dinas")
      .select("id,kegiatan_id,jenis_perjalanan,status,maksud_perjalanan,tempat_berangkat,tempat_tujuan,provinsi_tujuan,tanggal_berangkat,tanggal_kembali,tanggal_acara_mulai,tanggal_acara_selesai")
      .gte("tanggal_berangkat", from)
      .lte("tanggal_berangkat", to)
      .order("tanggal_berangkat", { ascending: false }),
    supabase.from("kegiatan").select("id,bagian_id,kode_subkegiatan,nama_subkegiatan"),
    supabase.from("bagian").select("id,nama_bagian")
  ]);

  const tripRows = (tripResult.data ?? []) as DbRow[];
  const tripIds = tripRows.map((row) => String(row.id));
  const [participantsResult, otherCostsResult] = tripIds.length ? await Promise.all([
    supabase.from("perjalanan_peserta")
      .select("id,perjalanan_id,nama_snapshot")
      .in("perjalanan_id", tripIds),
    supabase.from("perjalanan_biaya_lain")
      .select("perjalanan_id,jenis_biaya,nominal")
      .in("perjalanan_id", tripIds)
  ]) : [
    { data: [], error: null },
    { data: [], error: null }
  ];

  const participants = (participantsResult.data ?? []) as DbRow[];
  const participantIds = participants.map((row) => String(row.id));
  const allowanceResult = participantIds.length
    ? await supabase.from("perjalanan_biaya_peserta")
        .select("perjalanan_peserta_id,total_uang_harian")
        .in("perjalanan_peserta_id", participantIds)
    : { data: [], error: null };

  const activityMap = new Map(((activityResult.data ?? []) as DbRow[]).map((row) => [row.id, row]));
  const sectionMap = new Map(((sectionResult.data ?? []) as DbRow[]).map((row) => [row.id, row.nama_bagian]));
  const participantCount = new Map<string, number>();
  const allowanceByTrip = new Map<string, number>();
  const participantTripMap = new Map<string, string>();

  for (const person of participants) {
    const tripId = String(person.perjalanan_id);
    participantCount.set(tripId, (participantCount.get(tripId) ?? 0) + 1);
    participantTripMap.set(String(person.id), tripId);
  }

  for (const row of (allowanceResult.data ?? []) as DbRow[]) {
    const tripId = participantTripMap.get(String(row.perjalanan_peserta_id));
    if (!tripId) continue;
    allowanceByTrip.set(tripId, (allowanceByTrip.get(tripId) ?? 0) + Number(row.total_uang_harian ?? 0));
  }

  const otherCostByTrip = new Map<string, number>();
  for (const row of (otherCostsResult.data ?? []) as DbRow[]) {
    const tripId = String(row.perjalanan_id);
    otherCostByTrip.set(tripId, (otherCostByTrip.get(tripId) ?? 0) + Number(row.nominal ?? 0));
  }

  const trips: ReportTrip[] = tripRows.map((row) => {
    const activity = activityMap.get(row.kegiatan_id);
    const sectionId = String(activity?.bagian_id ?? "");
    const id = String(row.id);
    const allowance = allowanceByTrip.get(id) ?? 0;
    const otherCost = otherCostByTrip.get(id) ?? 0;
    return {
      id,
      year,
      type: String(row.jenis_perjalanan ?? ""),
      status: String(row.status ?? ""),
      purpose: String(row.maksud_perjalanan ?? ""),
      origin: String(row.tempat_berangkat ?? ""),
      destination: String(row.tempat_tujuan ?? ""),
      province: String(row.provinsi_tujuan ?? ""),
      departureDate: String(row.tanggal_berangkat ?? ""),
      returnDate: String(row.tanggal_kembali ?? ""),
      activityStart: String(row.tanggal_acara_mulai ?? ""),
      activityEnd: String(row.tanggal_acara_selesai ?? ""),
      activityCode: String(activity?.kode_subkegiatan ?? ""),
      activityName: String(activity?.nama_subkegiatan ?? "Subkegiatan tidak tersedia"),
      sectionId,
      sectionName: String(sectionMap.get(sectionId) ?? "Bagian tidak tersedia"),
      participantCount: participantCount.get(id) ?? 0,
      allowance,
      otherCost,
      totalRecordedCost: allowance + otherCost
    };
  });

  const errors = [
    tripResult.error, activityResult.error, sectionResult.error,
    participantsResult.error, otherCostsResult.error, allowanceResult.error
  ].filter(Boolean);
  const pageError = errors.length
    ? "Sebagian data laporan belum dapat dimuat. Periksa izin akses atau muat ulang halaman."
    : "";

  return (
    <PerjalananShell username={profile.username ?? "Pengguna"} role={profile.role} active="laporan">
      <LaporanClient year={year} currentYear={currentYear} trips={trips} pageError={pageError} />
    </PerjalananShell>
  );
}
