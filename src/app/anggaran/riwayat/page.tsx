import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, History, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin-shell";

export const dynamic = "force-dynamic";

const money = (value: number | string) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(Number(value ?? 0));

const date = (value: string) => new Intl.DateTimeFormat("id-ID", {
  day: "2-digit", month: "short", year: "numeric"
}).format(new Date(value + "T00:00:00"));

const mutationLabel: Record<string, string> = {
  tambah: "Penambahan pagu",
  kurang: "Pengurangan pagu",
  penyesuaian_tambah: "Penyesuaian tambah",
  penyesuaian_kurang: "Penyesuaian kurang"
};

export default async function RiwayatMutasiPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("user_akun")
    .select("username,role,pegawai_id,aktif,must_change_password")
    .eq("id", userId).maybeSingle();

  if (!profile || !profile.aktif || profile.must_change_password || profile.role !== "admin" || profile.pegawai_id !== null) {
    redirect("/dashboard");
  }

  const [
    { data: mutations, error: mutationError },
    { data: budgets },
    { data: activities },
    { data: accounts }
  ] = await Promise.all([
    supabase.from("mutasi_anggaran")
      .select("id,anggaran_id,nomor_perubahan,jenis_mutasi,nominal,tanggal,keterangan,pagu_sebelum,pagu_sesudah,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("anggaran").select("id,kegiatan_id,rekening_id,pagu_awal"),
    supabase.from("kegiatan").select("id,kode_subkegiatan,nama_subkegiatan,tahun_anggaran,bagian_id"),
    supabase.from("rekening_belanja").select("id,kode_rekening,nama_rekening")
  ]);

  const budgetMap = new Map((budgets ?? []).map(row => [row.id, row]));
  const activityMap = new Map((activities ?? []).map(row => [row.id, row]));
  const accountMap = new Map((accounts ?? []).map(row => [row.id, row]));
  const rows = (mutations ?? []).map(row => {
    const budget = budgetMap.get(row.anggaran_id);
    const activity = budget ? activityMap.get(budget.kegiatan_id) : null;
    const account = budget ? accountMap.get(budget.rekening_id) : null;
    return {
      ...row,
      activityName: activity?.nama_subkegiatan ?? "Subkegiatan tidak ditemukan",
      activityCode: activity?.kode_subkegiatan ?? "",
      year: activity?.tahun_anggaran ?? "",
      accountCode: account?.kode_rekening ?? "",
      accountName: account?.nama_rekening ?? "Rekening tidak ditemukan"
    };
  });

  const totalAdded = rows.filter(row => ["tambah", "penyesuaian_tambah"].includes(row.jenis_mutasi))
    .reduce((sum, row) => sum + Number(row.nominal), 0);
  const totalReduced = rows.filter(row => ["kurang", "penyesuaian_kurang"].includes(row.jenis_mutasi))
    .reduce((sum, row) => sum + Number(row.nominal), 0);

  return <AdminShell username={profile.username ?? "admin"} active="anggaran">
    <div className="master-page-head">
      <div>
        <div className="eyebrow">KEGIATAN & ANGGARAN / AUDIT TRAIL</div>
        <h1>Riwayat Mutasi Anggaran</h1>
        <p>Seluruh perubahan pagu pada setiap rekening belanja, disusun berdasarkan urutan perubahan.</p>
      </div>
      <Link className="master-secondary-btn" href="/anggaran"><ArrowLeft size={15}/> Kembali ke Anggaran</Link>
    </div>

    <div className="budget-summary-grid">
      <article className="budget-summary-card"><span className="budget-summary-icon"><History size={18}/></span><div><small>Total perubahan</small><strong>{rows.length}</strong></div></article>
      <article className="budget-summary-card"><span className="budget-summary-icon"><Wallet size={18}/></span><div><small>Total penambahan</small><strong>{money(totalAdded)}</strong></div></article>
      <article className="budget-summary-card"><span className="budget-summary-icon"><Wallet size={18}/></span><div><small>Total pengurangan</small><strong>{money(totalReduced)}</strong></div></article>
    </div>

    {mutationError && <div className="master-feedback error">Riwayat mutasi belum dapat dimuat. Periksa izin akses database: {mutationError.message}</div>}

    <div className="master-table-card">
      <div className="master-table-wrap">
        <table className="master-table">
          <thead><tr><th>URUTAN</th><th>SUBKEGIATAN / REKENING</th><th>JENIS PERUBAHAN</th><th>NOMINAL</th><th>PAGU SEBELUM</th><th>PAGU SESUDAH</th><th>TANGGAL</th><th>KETERANGAN</th></tr></thead>
          <tbody>
            {rows.length ? rows.map(row => <tr key={row.id}>
              <td><strong>Perubahan ke-{row.nomor_perubahan}</strong></td>
              <td><strong>{row.activityName}</strong><small>{row.activityCode} · {row.year}</small><small>{row.accountCode} · {row.accountName}</small></td>
              <td><span className={"master-status " + (["tambah", "penyesuaian_tambah"].includes(row.jenis_mutasi) ? "is-active" : "is-inactive")}>{mutationLabel[row.jenis_mutasi] ?? row.jenis_mutasi}</span></td>
              <td><strong>{money(row.nominal)}</strong></td>
              <td>{money(row.pagu_sebelum)}</td>
              <td><strong>{money(row.pagu_sesudah)}</strong></td>
              <td>{date(row.tanggal)}</td>
              <td>{row.keterangan || "—"}</td>
            </tr>) : <tr><td colSpan={8} className="master-empty">Belum ada riwayat mutasi anggaran. Setiap mutasi yang dicatat selanjutnya akan muncul di sini.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="master-table-foot"><span>Menampilkan <b>{rows.length}</b> riwayat perubahan</span><span>Riwayat bersifat permanen dan tidak dapat dihapus atau diubah</span></div>
    </div>
  </AdminShell>;
}
