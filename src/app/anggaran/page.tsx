import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin-shell";
import AnggaranClient, {
  type ActivityRecord, type AccountRecord, type BudgetRecord
} from "./anggaran-client";

export const dynamic = "force-dynamic";

export default async function AnggaranPage() {
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
    { data: activityRows, error: activityError },
    { data: sectionRows },
    { data: accountRows, error: accountError },
    { data: budgetRows, error: budgetError },
    { data: summaryRows, error: summaryError },
    { data: pptkRows },
    { data: assignmentRows },
    { data: employeeRows }
  ] = await Promise.all([
    supabase.from("kegiatan")
      .select("id,bagian_id,kode_subkegiatan,nama_subkegiatan,tahun_anggaran,aktif")
      .order("tahun_anggaran", { ascending: false })
      .order("nama_subkegiatan", { ascending: true }),
    supabase.from("bagian")
      .select("id,nama_bagian,aktif")
      .order("nama_bagian", { ascending: true }),
    supabase.from("rekening_belanja")
      .select("id,kode_rekening,nama_rekening,aktif")
      .order("kode_rekening", { ascending: true }),
    supabase.from("anggaran")
      .select("id,kegiatan_id,rekening_id,pagu_awal,aktif"),
    supabase.from("v_ringkasan_anggaran").select("*"),
    supabase.from("pejabat_pengelola")
      .select("id,pegawai_id,kegiatan_id,aktif")
      .eq("jenis_peran", "PPTK")
      .eq("aktif", true),
    supabase.from("pejabat_pengelola_kegiatan")
      .select("pejabat_pengelola_id,kegiatan_id"),
    supabase.from("pegawai").select("id,nama")
  ]);

  if (activityError || accountError || budgetError) {
    return <AdminShell username={profile.username ?? "admin"} active="anggaran">
      <div className="master-feedback error">Data kegiatan dan anggaran belum dapat dimuat. Periksa izin akses database dan coba muat ulang.</div>
    </AdminShell>;
  }

  const sectionMap = new Map((sectionRows ?? []).map((row) => [row.id, row.nama_bagian]));
  const activities: ActivityRecord[] = (activityRows ?? []).map((row) => ({
    id: row.id,
    bagian_id: row.bagian_id,
    nama_bagian: sectionMap.get(row.bagian_id) ?? "Bagian tidak ditemukan",
    kode_subkegiatan: (row.kode_subkegiatan ?? "").trim(),
    nama_subkegiatan: row.nama_subkegiatan.trim(),
    tahun_anggaran: row.tahun_anggaran,
    aktif: row.aktif
  }));
  const accounts: AccountRecord[] = (accountRows ?? []).map((row) => ({
    id: row.id,
    kode_rekening: row.kode_rekening.trim(),
    nama_rekening: row.nama_rekening.trim(),
    aktif: row.aktif
  }));
  const summaryMap = new Map<string, { pagu_setelah_mutasi: number; komitmen_aktif: number; pagu_tersedia: number }>();
  (summaryRows ?? []).forEach((row) => summaryMap.set(row.anggaran_id, {
    pagu_setelah_mutasi: Number(row.pagu_setelah_mutasi ?? 0),
    komitmen_aktif: Number(row.komitmen_aktif ?? 0),
    pagu_tersedia: Number(row.pagu_tersedia ?? 0)
  }));
  const accountMap = new Map(accounts.map((row) => [row.id, row]));
  const activityMap = new Map(activities.map((row) => [row.id, row]));
  const summaryAvailable = !summaryError;
  const budgets: BudgetRecord[] = (budgetRows ?? []).map((row) => {
    const summary = summaryMap.get(row.id);
    const activity = activityMap.get(row.kegiatan_id);
    const account = accountMap.get(row.rekening_id);
    return {
      id: row.id,
      kegiatan_id: row.kegiatan_id,
      rekening_id: row.rekening_id,
      pagu_awal: Number(row.pagu_awal ?? 0),
      aktif: row.aktif,
      nama_subkegiatan: activity?.nama_subkegiatan ?? "Kegiatan tidak ditemukan",
      kode_subkegiatan: activity?.kode_subkegiatan ?? "",
      tahun_anggaran: activity?.tahun_anggaran ?? 0,
      nama_bagian: activity?.nama_bagian ?? "Bagian tidak ditemukan",
      kode_rekening: account?.kode_rekening ?? "",
      nama_rekening: account?.nama_rekening ?? "Rekening tidak ditemukan",
      pagu_setelah_mutasi: summary?.pagu_setelah_mutasi ?? Number(row.pagu_awal ?? 0),
      komitmen_aktif: summary?.komitmen_aktif ?? 0,
      pagu_tersedia: summary?.pagu_tersedia ?? Number(row.pagu_awal ?? 0)
    };
  });

  const people = new Map((employeeRows ?? []).map((row) => [row.id, row.nama]));
  const pptkByActivity = new Map<string, string[]>();
  (pptkRows ?? []).forEach((row) => {
    if (row.kegiatan_id) {
      const values = pptkByActivity.get(row.kegiatan_id) ?? [];
      values.push(people.get(row.pegawai_id) ?? "PPTK");
      pptkByActivity.set(row.kegiatan_id, values);
    }
  });
  const pptkIds = new Set((pptkRows ?? []).map((row) => row.id));
  (assignmentRows ?? []).forEach((row) => {
    if (pptkIds.has(row.pejabat_pengelola_id)) {
      const manager = (pptkRows ?? []).find((item) => item.id === row.pejabat_pengelola_id);
      const values = pptkByActivity.get(row.kegiatan_id) ?? [];
      const name = manager ? (people.get(manager.pegawai_id) ?? "PPTK") : "";
      if (name && !values.includes(name)) values.push(name);
      pptkByActivity.set(row.kegiatan_id, values);
    }
  });

  return <AdminShell username={profile.username ?? "admin"} active="anggaran">
    <AnggaranClient
      initialActivities={activities.map((row) => ({ ...row, pptk_names: pptkByActivity.get(row.id) ?? [] }))}
      initialAccounts={accounts}
      initialBudgets={budgets}
      sections={(sectionRows ?? []).map((row) => ({ id: row.id, nama: row.nama_bagian, aktif: row.aktif }))}
      summaryAvailable={summaryAvailable}
    />
  </AdminShell>;
}
