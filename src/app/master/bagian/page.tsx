import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin-shell";
import BagianClient, { type BagianRecord } from "./bagian-client";

export const dynamic = "force-dynamic";

export default async function MasterBagianPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_akun")
    .select("username,role,pegawai_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.pegawai_id !== null) {
    redirect("/dashboard");
  }

  const [{ data: bagianData, error: bagianError }, { data: pegawaiData }] = await Promise.all([
    supabase.from("bagian")
      .select("id,nama_bagian,nama_instansi,aktif")
      .order("nama_bagian", { ascending: true }),
    supabase.from("pegawai").select("bagian_id")
  ]);

  if (bagianError) {
    return <AdminShell username={profile.username ?? "admin"} active="bagian">
      <div className="master-feedback error">Data bagian belum dapat dimuat. Periksa izin akses database atau coba muat ulang.</div>
    </AdminShell>;
  }

  const counts = new Map<string, number>();
  (pegawaiData ?? []).forEach((row: { bagian_id: string | null }) => {
    if (row.bagian_id) counts.set(row.bagian_id, (counts.get(row.bagian_id) ?? 0) + 1);
  });
  const initialRows: BagianRecord[] = (bagianData ?? []).map((row) => ({
    id: row.id,
    nama_bagian: row.nama_bagian,
    nama_instansi: row.nama_instansi ?? "",
    aktif: row.aktif,
    jumlah_pegawai: counts.get(row.id) ?? 0
  }));

  return <AdminShell username={profile.username ?? "admin"} active="bagian">
    <BagianClient initialRows={initialRows} />
  </AdminShell>;
}
