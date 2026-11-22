import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin-shell";
import PenggunaClient, {
  type AccountRecord, type EmployeeOption, type ActivityOption, type SectionOption
} from "./pengguna-client";

export const dynamic = "force-dynamic";

export default async function PenggunaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("user_akun")
    .select("username,role,pegawai_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.pegawai_id !== null) {
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
  const assignmentMap = new Map((assignmentRows ?? []).map((row) => [row.user_id, row.kegiatan_id]));

  const employeeOptions: EmployeeOption[] = (employeeRows ?? []).map((row) => ({
    id: row.id, nama: row.nama, nip: row.nip ?? "", bagian_id: row.bagian_id,
    nama_bagian: sectionMap.get(row.bagian_id) ?? "Bagian tidak ditemukan", aktif: row.aktif
  }));
  const activityOptions: ActivityOption[] = (activityRows ?? []).map((row) => ({
    id: row.id, bagian_id: row.bagian_id, kode: (row.kode_subkegiatan ?? "").trim(),
    nama: row.nama_subkegiatan.trim(), tahun: row.tahun_anggaran, aktif: row.aktif,
    nama_bagian: sectionMap.get(row.bagian_id) ?? "Bagian tidak ditemukan"
  }));
  const sections: SectionOption[] = (sectionRows ?? []).map((row) => ({
    id: row.id, nama: row.nama_bagian, aktif: row.aktif
  }));

  const accountRecords: AccountRecord[] = (accounts ?? []).map((row) => {
    const employee = row.pegawai_id ? employeeMap.get(row.pegawai_id) : null;
    const activityId = assignmentMap.get(row.id) ?? null;
    const activity = activityId ? activityMap.get(activityId) : null;
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
      kegiatan_id: activityId,
      nama_kegiatan: activity ? activity.nama_subkegiatan.trim() : "Belum ditugaskan",
      kode_kegiatan: activity ? (activity.kode_subkegiatan ?? "").trim() : "",
      tahun_anggaran: activity?.tahun_anggaran ?? null,
      kegiatan_aktif: activity?.aktif ?? false,
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
      sections={sections}
    />
  </AdminShell>;
}
