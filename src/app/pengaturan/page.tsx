import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin-shell";
import PengelolaClient, {
  type EmployeeOption, type SectionOption, type ActivityOption,
  type ManagerRecord, type SignerRecord
} from "./pengelola-client";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  const supabase = await createClient();
  const { data: { claims } } = await supabase.auth.getClaims();
  const userId = claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("user_akun")
    .select("username,role,pegawai_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.pegawai_id !== null) {
    redirect("/dashboard");
  }

  const [
    { data: employeeRows, error: employeeError },
    { data: sectionRows },
    { data: activityRows },
    { data: managerRows, error: managerError },
    { data: assignmentRows },
    { data: signerRows, error: signerError },
    { data: positionRows }
  ] = await Promise.all([
    supabase.from("pegawai")
      .select("id,nama,nip,jabatan,nomenklatur_jabatan,bagian_id,aktif")
      .order("nama", { ascending: true }),
    supabase.from("bagian")
      .select("id,nama_bagian,aktif")
      .order("nama_bagian", { ascending: true }),
    supabase.from("kegiatan")
      .select("id,kode_subkegiatan,nama_subkegiatan,tahun_anggaran,bagian_id,aktif")
      .order("tahun_anggaran", { ascending: false }),
    supabase.from("pejabat_pengelola")
      .select("id,pegawai_id,jenis_peran,bagian_id,kegiatan_id,status_penugasan,aktif")
      .order("jenis_peran", { ascending: true }),
    supabase.from("pejabat_pengelola_kegiatan")
      .select("id,pejabat_pengelola_id,kegiatan_id"),
    supabase.from("pejabat_dokumen")
      .select("id,pegawai_id,jenis_peran,jabatan_dokumen,aktif")
      .eq("jenis_peran", "penandatangan_sp")
      .order("created_at", { ascending: true }),
    supabase.from("master_jabatan")
      .select("nama,eselon")
      .eq("aktif", true)
  ]);

  if (employeeError || managerError || signerError) {
    return <AdminShell username={profile.username ?? "admin"} active="pengelola">
      <div className="master-feedback error">Data pejabat dan pengelola belum dapat dimuat. Periksa koneksi dan izin database, lalu muat ulang.</div>
    </AdminShell>;
  }

  const positionMap = new Map((positionRows ?? []).map((row) => [row.nama, row.eselon ?? ""]));
  const employees: EmployeeOption[] = (employeeRows ?? []).map((row) => ({
    id: row.id,
    nama: row.nama,
    nip: row.nip ?? "",
    jabatan: row.jabatan ?? "",
    nomenklatur_jabatan: row.nomenklatur_jabatan ?? "",
    bagian_id: row.bagian_id,
    aktif: row.aktif,
    eselon: positionMap.get(row.jabatan ?? "") ?? ""
  }));
  const sections: SectionOption[] = (sectionRows ?? []).map((row) => ({
    id: row.id, nama: row.nama_bagian, aktif: row.aktif
  }));
  const activities: ActivityOption[] = (activityRows ?? []).map((row) => ({
    id: row.id,
    kode: (row.kode_subkegiatan ?? "").trim(),
    nama: row.nama_subkegiatan.trim(),
    tahun: row.tahun_anggaran,
    bagian_id: row.bagian_id,
    aktif: row.aktif
  }));
  const assignmentsByManager = new Map<string, string[]>();
  (assignmentRows ?? []).forEach((row) => {
    const list = assignmentsByManager.get(row.pejabat_pengelola_id) ?? [];
    if (!list.includes(row.kegiatan_id)) list.push(row.kegiatan_id);
    assignmentsByManager.set(row.pejabat_pengelola_id, list);
  });
  const managers: ManagerRecord[] = (managerRows ?? []).map((row) => {
    const assigned = assignmentsByManager.get(row.id) ?? [];
    if (row.kegiatan_id && !assigned.includes(row.kegiatan_id)) assigned.unshift(row.kegiatan_id);
    return {
      id: row.id,
      pegawai_id: row.pegawai_id,
      jenis_peran: row.jenis_peran,
      bagian_id: row.bagian_id,
      kegiatan_id: row.kegiatan_id,
      status_penugasan: row.status_penugasan,
      aktif: row.aktif,
      activity_ids: assigned
    };
  });
  const signers: SignerRecord[] = (signerRows ?? []).map((row) => ({
    id: row.id,
    pegawai_id: row.pegawai_id,
    jabatan_dokumen: row.jabatan_dokumen,
    aktif: row.aktif
  }));

  return <AdminShell username={profile.username ?? "admin"} active="pengelola">
    <PengelolaClient
      initialManagers={managers}
      initialSigners={signers}
      employees={employees}
      sections={sections}
      activities={activities}
    />
  </AdminShell>;
}
