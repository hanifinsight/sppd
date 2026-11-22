import { redirect } from "next/navigation";
import PerjalananShell from "@/components/perjalanan-shell";
import { createClient } from "@/lib/supabase/server";
import DokumenClient, { type DocumentRecord, type ArchiveRecord } from "./dokumen-client";

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
      .select("id,perjalanan_id,nomor_sp,tanggal_terbit,nama_penandatangan_snapshot,jabatan_snapshot,created_at")
      .order("tanggal_terbit", { ascending: false }),
    supabase.from("dokumen_sppd")
      .select("id,perjalanan_id,nomor_sppd,tanggal_terbit,nama_ppk_snapshot,jabatan_ppk_snapshot,created_at")
      .order("tanggal_terbit", { ascending: false }),
    supabase.from("perjalanan_dinas")
      .select("id,kegiatan_id,status,jenis_perjalanan,tanggal_berangkat,tanggal_kembali,tempat_tujuan,maksud_perjalanan")
      .order("created_at", { ascending: false }),
    supabase.from("kegiatan")
      .select("id,kode_subkegiatan,nama_subkegiatan"),
    supabase.from("arsip_dokumen")
      .select("id,perjalanan_id,jenis_dokumen,format_file,file_path,nomor_dokumen,tanggal_terbit,versi,status,created_at")
      .order("created_at", { ascending: false })
  ]);

  const trips = (tripResult.data ?? []) as DbRow[];
  const activities = (activityResult.data ?? []) as DbRow[];
  const tripMap = new Map(trips.map((row) => [row.id, row]));
  const activityMap = new Map(activities.map((row) => [row.id, row]));

  const documents: DocumentRecord[] = [
    ...((spResult.data ?? []) as DbRow[]).map((row) => {
      const trip = tripMap.get(row.perjalanan_id);
      const activity = trip ? activityMap.get(trip.kegiatan_id) : undefined;
      return {
        id: row.id,
        perjalananId: row.perjalanan_id,
        type: "sp" as const,
        number: row.nomor_sp ?? "",
        issueDate: row.tanggal_terbit ?? "",
        signerName: row.nama_penandatangan_snapshot ?? "—",
        signerTitle: row.jabatan_snapshot ?? "",
        tripStatus: trip?.status ?? "unknown",
        tripType: trip?.jenis_perjalanan ?? "",
        departureDate: trip?.tanggal_berangkat ?? "",
        returnDate: trip?.tanggal_kembali ?? "",
        destination: trip?.tempat_tujuan ?? "Data perjalanan tidak tersedia",
        purpose: trip?.maksud_perjalanan ?? "",
        activityCode: activity?.kode_subkegiatan ?? "",
        activityName: activity?.nama_subkegiatan ?? "Subkegiatan tidak tersedia",
        createdAt: row.created_at ?? ""
      };
    }),
    ...((sppdResult.data ?? []) as DbRow[]).map((row) => {
      const trip = tripMap.get(row.perjalanan_id);
      const activity = trip ? activityMap.get(trip.kegiatan_id) : undefined;
      return {
        id: row.id,
        perjalananId: row.perjalanan_id,
        type: "sppd" as const,
        number: row.nomor_sppd ?? "",
        issueDate: row.tanggal_terbit ?? "",
        signerName: row.nama_ppk_snapshot ?? "—",
        signerTitle: row.jabatan_ppk_snapshot ?? "",
        tripStatus: trip?.status ?? "unknown",
        tripType: trip?.jenis_perjalanan ?? "",
        departureDate: trip?.tanggal_berangkat ?? "",
        returnDate: trip?.tanggal_kembali ?? "",
        destination: trip?.tempat_tujuan ?? "Data perjalanan tidak tersedia",
        purpose: trip?.maksud_perjalanan ?? "",
        activityCode: activity?.kode_subkegiatan ?? "",
        activityName: activity?.nama_subkegiatan ?? "Subkegiatan tidak tersedia",
        createdAt: row.created_at ?? ""
      };
    })
  ].sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));

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

  const errors = [spResult.error, sppdResult.error, tripResult.error, archiveResult.error].filter(Boolean);
  const pageError = errors.length
    ? "Sebagian data dokumen belum dapat dimuat. Periksa izin akses atau muat ulang halaman."
    : "";

  return (
    <PerjalananShell username={profile.username ?? "Pengguna"} role={profile.role} active="dokumen">
      <DokumenClient documents={documents} archives={archives} pageError={pageError} />
    </PerjalananShell>
  );
}
