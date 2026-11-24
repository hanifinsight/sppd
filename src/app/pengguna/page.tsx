import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin-shell";
import PenggunaClient, {
  type AccountRecord, type EmployeeOption, type ActivityOption
} from "./pengguna-client";

export const dynamic = "force-dynamic";

export default async function PenggunaPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("user_akun")
    .select("username,role,pegawai_id,aktif,must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.aktif || profile.must_change_password || profile.role !== "admin" || profile.pegawai_id !== null) {
    redirect("/dashboard");
  }

  const [
    { data: accounts, error: accountError },
    { data: employeeRows },
    { data: activityRows },
    { data: sectionRows },
    { data: assignmentRows, error: assignmentError }
  ] = await Promise.all([
    supabase.from("user_akun")
      .select("id,pegawai_id,role,aktif,created_at,username,must_change_password")
      .order("created_at", { ascending: false }),
    supabase.from("pegawai")
      .select("id,nama,nip,bagian_id,aktif")
      .order("nama", { ascending: true }),
    supabase.from("kegiatan")
      .select("id,bagian_id,kode_subkegiatan,nama_subkegiatan,tahun_anggaran,aktif")
      .order("tahun_anggaran", { ascending: false }),
    supabase.from("bagian")
      .select("id,nama_bagian,aktif")
      .order("nama_bagian", { ascending: true }),
    supabase.from("operator_kegiatan")
      .select("user_id,kegiatan_id")
  ]);

  if (accountError || assignmentError) {
    return <AdminShell username={profile.username ?? "admin"} active="pengguna">
      <div className="master-feedback error">Daftar akun belum dapat dimuat. Periksa izin baca RLS untuk Admin Global, lalu coba muat ulang.</div>
    </AdminShell>;
  }

  const sectionMap = new Map((sectionRows ?? []).map((row) => [row.id, row.nama_bagian]));
  const employeeMap = new Map((employeeRows ?? []).map((row) => [row.id, row]));
  const activityMap = new Map((activityRows ?? []).map((row) => [row.id, row]));
  const assignmentMap = new Map<string, string[]>();
  for (const row of assignmentRows ?? []) {
    const current = assignmentMap.get(row.user_id) ?? [];
    current.push(row.kegiatan_id);
    assignmentMap.set(row.user_id, current);
  }

  const employeeOptions: EmployeeOption[] = (employeeRows ?? []).map((row) => ({
    id: row.id, nama: row.nama, nip: row.nip ?? "", bagian_id: row.bagian_id,
    nama_bagian: sectionMap.get(row.bagian_id) ?? "Bagian tidak ditemukan", aktif: row.aktif
  }));
  const activityOptions: ActivityOption[] = (activityRows ?? []).map((row) => ({
    id: row.id, bagian_id: row.bagian_id, kode: (row.kode_subkegiatan ?? "").trim(),
    nama: row.nama_subkegiatan.trim(), tahun: row.tahun_anggaran, aktif: row.aktif,
    nama_bagian: sectionMap.get(row.bagian_id) ?? "Bagian tidak ditemukan"
  }));
  const accountRecords: AccountRecord[] = (accounts ?? []).map((row) => {
    const employee = row.pegawai_id ? employeeMap.get(row.pegawai_id) : null;
    const activityIds = assignmentMap.get(row.id) ?? [];
    const assignedActivities = activityIds.map((id) => activityMap.get(id)).filter(Boolean);
    return {
      id: row.id,
      username: row.username ?? "",
      role: row.role,
      pegawai_id: row.pegawai_id,
      nama_pegawai: employee?.nama ?? (row.role === "admin" ? "Admin Global" : "Pegawai tidak ditemukan"),
      nip: employee?.nip ?? "",
      bagian_id: employee?.bagian_id ?? null,
      nama_bagian: employee ? (sectionMap.get(employee.bagian_id) ?? "Bagian tidak ditemukan") : "Seluruh Sekretariat Daerah",
      pegawai_aktif: employee?.aktif ?? true,
      kegiatan_ids: activityIds,
      nama_kegiatan: assignedActivities.map((item) => item!.nama_subkegiatan.trim()).join(" • ") || "Belum ditugaskan",
      kode_kegiatan: assignedActivities.map((item) => [item!.kode_subkegiatan, item!.tahun_anggaran].filter(Boolean).join(" · ")).join(" | "),
      aktif: row.aktif,
      must_change_password: row.must_change_password,
      created_at: row.created_at
    };
  });

  return <AdminShell username={profile.username ?? "admin"} active="pengguna">
    <PenggunaClient
      initialAccounts={accountRecords}
      employees={employeeOptions}
      activities={activityOptions}
    />
  </AdminShell>;
}
