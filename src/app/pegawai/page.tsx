import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin-shell";
import PegawaiClient, { type PegawaiRecord, type ReferenceOption } from "./pegawai-client";

export const dynamic = "force-dynamic";

export default async function PegawaiPage() {
  const supabase = await createClient();
  const { data: { claims } } = await supabase.auth.getClaims();
  const userId = claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("user_akun")
    .select("username,role,pegawai_id,aktif,must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.aktif || profile.must_change_password || profile.role !== "admin" || profile.pegawai_id !== null) {
    redirect("/dashboard");
  }

  const [
    { data: employees, error: employeeError },
    { data: sections },
    { data: ranks },
    { data: positions }
  ] = await Promise.all([
    supabase.from("pegawai")
      .select("id,bagian_id,nama,nip,status_kepegawaian,pangkat_golongan,jabatan,instansi,aktif,nomenklatur_jabatan")
      .order("nama", { ascending: true }),
    supabase.from("bagian")
      .select("id,nama_bagian,aktif")
      .order("nama_bagian", { ascending: true }),
    supabase.from("master_pangkat_golongan")
      .select("id,nama,urutan")
      .eq("aktif", true)
      .order("urutan", { ascending: true }),
    supabase.from("master_jabatan")
      .select("id,nama,jenis_jabatan,jenjang_jabatan,eselon,urutan")
      .eq("aktif", true)
      .order("urutan", { ascending: true })
  ]);

  if (employeeError) {
    return <AdminShell username={profile.username ?? "admin"} active="pegawai">
      <div className="master-feedback error">Data pegawai belum dapat dimuat. Periksa izin akses database atau coba muat ulang.</div>
    </AdminShell>;
  }

  const sectionMap = new Map((sections ?? []).map((section) => [section.id, section.nama_bagian]));
  const initialRows: PegawaiRecord[] = (employees ?? []).map((row) => ({
    ...row,
    nama_bagian: row.bagian_id ? (sectionMap.get(row.bagian_id) ?? "Bagian tidak ditemukan") : "Belum ditempatkan"
  }));
  const sectionOptions: ReferenceOption[] = (sections ?? []).map((row) => ({ id: row.id, nama: row.nama_bagian, aktif: row.aktif }));
  const rankOptions: ReferenceOption[] = (ranks ?? []).map((row) => ({ id: row.id, nama: row.nama, aktif: true }));
  const positionOptions: ReferenceOption[] = (positions ?? []).map((row) => ({
    id: row.id,
    nama: row.nama,
    aktif: true,
    detail: [row.jenjang_jabatan, row.eselon && row.eselon !== "TB" ? "Eselon " + row.eselon : ""].filter(Boolean).join(" · ")
  }));

  return <AdminShell username={profile.username ?? "admin"} active="pegawai">
    <PegawaiClient initialRows={initialRows} sections={sectionOptions} ranks={rankOptions} positions={positionOptions}/>
  </AdminShell>;
}
