import { redirect } from "next/navigation";
import PerjalananShell from "@/components/perjalanan-shell";
import { createClient } from "@/lib/supabase/server";
import DokumenClient, { type TripRecord, type ArchiveRecord } from "./dokumen-client";

export const dynamic = "force-dynamic";
type DbRow = Record<string, any>;

export default async function DokumenPage() {
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

  const [spResult, sppdResult, tripResult, activityResult, archiveResult] = await Promise.all([
    supabase.from("dokumen_sp")
      .select("id,perjalanan_id,nomor_sp,tanggal_terbit,nama_penandatangan_snapshot,jabatan_snapshot")
      .order("tanggal_terbit", { ascending: false }),
    supabase.from("dokumen_sppd")
      .select("id,perjalanan_id,nomor_sppd,tanggal_terbit,nama_ppk_snapshot,jabatan_ppk_snapshot")
      .order("tanggal_terbit", { ascending: false }),
    supabase.from("perjalanan_dinas")
      .select("id,kegiatan_id,status,jenis_perjalanan,tanggal_acara_mulai,tanggal_acara_selesai,lokasi_acara,maksud_perjalanan,tempat_berangkat,tempat_tujuan,provinsi_tujuan,tanggal_berangkat,tanggal_kembali,alat_angkut,nomor_undangan")
      .order("tanggal_acara_mulai", { ascending: false }),
    supabase.from("kegiatan")
      .select("id,kode_subkegiatan,nama_subkegiatan"),
    supabase.from("arsip_dokumen")
      .select("id,perjalanan_id,jenis_dokumen,format_file,file_path,nomor_dokumen,tanggal_terbit,versi,status,created_at")
      .order("created_at", { ascending: false })
  ]);

  const trips = (tripResult.data ?? []) as DbRow[];
  const tripIds = trips.map((row) => row.id as string);
  const [participantsResult, costsResult, ratesResult] = tripIds.length ? await Promise.all([
    supabase.from("perjalanan_peserta")
      .select("id,perjalanan_id,nama_snapshot,nip_snapshot,pangkat_snapshot,jabatan_snapshot")
      .in("perjalanan_id", tripIds)
      .order("created_at", { ascending: true }),
    supabase.from("perjalanan_biaya_lain")
      .select("perjalanan_id,jenis_biaya,nominal,keterangan")
      .in("perjalanan_id", tripIds),
    supabase.from("perjalanan_biaya_peserta")
      .select("perjalanan_peserta_id,jumlah_hari,tarif_snapshot,total_uang_harian")
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  const activityMap = new Map(((activityResult.data ?? []) as DbRow[]).map((row) => [row.id, row]));
  const spMap = new Map(((spResult.data ?? []) as DbRow[]).map((row) => [row.perjalanan_id, row]));
  const sppdMap = new Map(((sppdResult.data ?? []) as DbRow[]).map((row) => [row.perjalanan_id, row]));
  const ratesMap = new Map(((ratesResult.data ?? []) as DbRow[]).map((row) => [row.perjalanan_peserta_id, row]));
  const participantsByTrip = new Map<string, DbRow[]>();
  for (const person of (participantsResult.data ?? []) as DbRow[]) {
    const current = participantsByTrip.get(person.perjalanan_id) ?? [];
    current.push(person);
    participantsByTrip.set(person.perjalanan_id, current);
  }
  const costsByTrip = new Map<string, DbRow[]>();
  for (const cost of (costsResult.data ?? []) as DbRow[]) {
    const current = costsByTrip.get(cost.perjalanan_id) ?? [];
    current.push(cost);
    costsByTrip.set(cost.perjalanan_id, current);
  }

  const documents: TripRecord[] = trips
    .filter((trip) => spMap.has(trip.id) || sppdMap.has(trip.id))
    .map((trip) => {
      const activity = activityMap.get(trip.kegiatan_id);
      const sp = spMap.get(trip.id);
      const sppd = sppdMap.get(trip.id);
      const participants = participantsByTrip.get(trip.id) ?? [];
      const tripRates = participants.map((person) => ratesMap.get(person.id)).filter(Boolean) as DbRow[];
      const otherCosts = costsByTrip.get(trip.id) ?? [];
      const sumCost = (includes: string[]) => otherCosts
        .filter((item) => includes.some((word) => String(item.jenis_biaya ?? "").toLowerCase().includes(word)))
        .reduce((sum, item) => sum + Number(item.nominal ?? 0), 0);
      const allowance = tripRates.reduce((sum, item) => sum + Number(item.total_uang_harian ?? 0), 0);
      const extras = otherCosts.reduce((sum, item) => sum + Number(item.nominal ?? 0), 0);

      return {
        id: trip.id,
        status: trip.status ?? "",
        tripType: trip.jenis_perjalanan ?? "",
        activityDate: trip.tanggal_acara_mulai ?? "",
        activityEndDate: trip.tanggal_acara_selesai ?? "",
        departureDate: trip.tanggal_berangkat ?? "",
        returnDate: trip.tanggal_kembali ?? "",
        departurePlace: trip.tempat_berangkat ?? "",
        destination: trip.tempat_tujuan ?? "",
        destinationProvince: trip.provinsi_tujuan ?? "",
        activityLocation: trip.lokasi_acara ?? "",
        purpose: trip.maksud_perjalanan ?? "",
        transport: trip.alat_angkut ?? "",
        invitationNumber: trip.nomor_undangan ?? "",
        activityCode: activity?.kode_subkegiatan ?? "",
        activityName: activity?.nama_subkegiatan ?? "Subkegiatan tidak tersedia",
        sp: sp ? {
          id: sp.id,
          number: sp.nomor_sp ?? "",
          issueDate: sp.tanggal_terbit ?? "",
          signerName: sp.nama_penandatangan_snapshot ?? "—",
          signerTitle: sp.jabatan_snapshot ?? ""
        } : null,
        sppd: sppd ? {
          id: sppd.id,
          number: sppd.nomor_sppd ?? "",
          issueDate: sppd.tanggal_terbit ?? "",
          signerName: sppd.nama_ppk_snapshot ?? "—",
          signerTitle: sppd.jabatan_ppk_snapshot ?? ""
        } : null,
        participants: participants.map((person) => {
          const rate = ratesMap.get(person.id);
          return {
            id: person.id,
            name: person.nama_snapshot ?? "—",
            nip: person.nip_snapshot ?? "",
            rank: person.pangkat_snapshot ?? "",
            job: person.jabatan_snapshot ?? "",
            days: Number(rate?.jumlah_hari ?? 0),
            allowance: Number(rate?.total_uang_harian ?? 0)
          };
        }),
        costs: {
          allowance,
          bbm: sumCost(["bbm", "tiket"]),
          toll: sumCost(["tol"]),
          lodging: sumCost(["penginapan", "hotel"]),
          other: Math.max(0, extras - sumCost(["bbm", "tiket", "tol", "penginapan", "hotel"])),
          total: allowance + extras
        }
      };
    })
    .sort((a, b) => (b.activityDate || "").localeCompare(a.activityDate || ""));

  const archives: ArchiveRecord[] = ((archiveResult.data ?? []) as DbRow[]).map((row) => ({
    id: row.id,
    perjalananId: row.perjalanan_id,
    type: row.jenis_dokumen,
    format: row.format_file,
    filePath: row.file_path,
    number: row.nomor_dokumen ?? "",
    issueDate: row.tanggal_terbit ?? "",
    version: Number(row.versi ?? 1),
    status: row.status ?? "aktif",
    createdAt: row.created_at ?? ""
  }));

  const errors = [spResult.error, sppdResult.error, tripResult.error, activityResult.error, archiveResult.error, participantsResult.error, costsResult.error].filter(Boolean);
  const pageError = errors.length
    ? "Sebagian data perjalanan belum dapat dimuat. Periksa izin akses atau muat ulang halaman."
    : "";

  return (
    <PerjalananShell username={profile.username ?? "Pengguna"} role={profile.role} active="dokumen">
      <DokumenClient documents={documents} archives={archives} pageError={pageError} />
    </PerjalananShell>
  );
}
