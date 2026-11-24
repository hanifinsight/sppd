import { redirect } from "next/navigation";
import {
  ArrowUpRight, CalendarDays, ClipboardList, FileText, Wallet, Users,
  MapPin, Plus, Search, ChevronDown, Plane, Clock3
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PerjalananShell from "@/components/perjalanan-shell";

type Trip = {
  id: string;
  maksud_perjalanan: string;
  tempat_tujuan: string;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  status: string;
  jenis_perjalanan: string;
};

const money = (n: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(n);

const date = (s: string) => new Intl.DateTimeFormat("id-ID", {
  day: "2-digit", month: "short", year: "numeric"
}).format(new Date(s + "T00:00:00"));

export default async function Home() {
  const supabase = await createClient();
  const { data: { claims } } = await supabase.auth.getClaims();
  const userId = claims?.sub;
  if (!userId) redirect("/login");

  const [
    { count: tripCount },
    { count: employeeCount },
    { data: budgets },
    { data: trips },
    { data: profile }
  ] = await Promise.all([
    supabase.from("perjalanan_dinas").select("id", { count: "exact", head: true }),
    supabase.from("pegawai").select("id", { count: "exact", head: true }).eq("aktif", true),
    supabase.from("anggaran").select("pagu_awal").eq("aktif", true),
    supabase.from("perjalanan_dinas")
      .select("id,maksud_perjalanan,tempat_tujuan,tanggal_berangkat,tanggal_kembali,status,jenis_perjalanan")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("user_akun").select("username,role,pegawai_id,aktif,must_change_password").eq("id", userId).maybeSingle()
  ]);

  if (!profile || !profile.aktif || profile.must_change_password) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "operator") redirect("/dashboard");
  if (profile.role === "admin" && profile.pegawai_id !== null) redirect("/dashboard");
  if (profile.role === "operator" && !profile.pegawai_id) redirect("/dashboard");

  const budgetTotal = (budgets ?? []).reduce((sum, row) => sum + Number(row.pagu_awal ?? 0), 0);
  const recent = (trips ?? []) as Trip[];
  const stats = [
    { label: "Total perjalanan", value: String(tripCount ?? 0), hint: "Seluruh pengajuan", icon: Plane, tone: "blue" },
    { label: "Pegawai aktif", value: String(employeeCount ?? 0), hint: "Terdaftar dalam sistem", icon: Users, tone: "violet" },
    { label: "Pagu anggaran", value: money(budgetTotal), hint: "Total pagu aktif", icon: Wallet, tone: "green" },
    { label: "Dalam proses", value: String(recent.filter((trip) => trip.status === "draft").length), hint: "Dari 5 data terbaru", icon: Clock3, tone: "amber" }
  ];
  const statusLabel = (status: string) => status === "draft" ? "Draf" : status === "published" ? "Diterbitkan" : status === "cancelled" ? "Dibatalkan" : status;
  const statusTone = (status: string) => status === "published" ? "done" : status === "cancelled" ? "progress" : "pending";

  return (
    <PerjalananShell
      username={profile.username ?? "Pengguna"}
      role={profile.role}
      active="dashboard"
    >
      <div className="dashboard-inner">
        <div className="welcome-row">
          <div>
            <div className="eyebrow">SISTEM PERJALANAN DINAS</div>
            <h1>Selamat datang, {profile.username ?? "Pengguna"} <span>✦</span></h1>
            <p>Pantau dan kelola aktivitas perjalanan dinas dalam satu tempat.</p>
          </div>
          <a className="primary-btn" href="/perjalanan/baru"><Plus size={17}/> Buat perjalanan dinas</a>
        </div>

        <div className="stats-grid">
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <div className="stat-top">
                <span>{stat.label}</span>
                <div className={"stat-icon " + stat.tone}><stat.icon size={18}/></div>
              </div>
              <strong>{stat.value}</strong>
              <small>{stat.hint}</small>
            </article>
          ))}
        </div>

        <div className="section-heading">
          <div><h2>Aktivitas perjalanan</h2><p>Data pengajuan terbaru dari database SPPD.</p></div>
          <a href="/perjalanan">Lihat semua <ArrowUpRight size={15}/></a>
        </div>

        <div className="table-card dashboard-activity-card">
          <div className="table-toolbar">
            <div className="tabs"><button className="selected" type="button">Terbaru <span>{recent.length}</span></button></div>
            <div className="table-tools"><span className="search-btn"><Search size={16}/> Data aktual Supabase</span></div>
          </div>
          <div className="table-wrap dashboard-table-wrap">
            <table className="dashboard-table">
              <thead><tr><th>JENIS</th><th>KEGIATAN / MAKSUD</th><th>TUJUAN</th><th>TANGGAL BERANGKAT</th><th>STATUS</th></tr></thead>
              <tbody>
                {recent.length ? recent.map((trip) => (
                  <tr key={trip.id}>
                    <td data-label="Jenis"><b className="code">{trip.jenis_perjalanan === "luar_kota" ? "Luar kota" : "Dalam kota"}</b><small className="place"><MapPin size={12}/>{trip.tempat_tujuan}</small></td>
                    <td data-label="Kegiatan / Maksud"><b>{trip.maksud_perjalanan}</b><small>Perjalanan dinas</small></td>
                    <td data-label="Tujuan">{trip.tempat_tujuan}</td>
                    <td data-label="Tanggal berangkat">{date(trip.tanggal_berangkat)} – {date(trip.tanggal_kembali)}</td>
                    <td data-label="Status"><span className={"status " + statusTone(trip.status)}><i/>{statusLabel(trip.status)}</span></td>
                  </tr>
                )) : <tr><td colSpan={5} className="empty-state">Belum ada data perjalanan dinas yang dapat ditampilkan.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span>Menampilkan <b>{recent.length}</b> data terbaru · total <b>{tripCount ?? 0}</b> perjalanan</span>
            <a href="/perjalanan">Buka daftar perjalanan →</a>
          </div>
        </div>

        <div className="bottom-grid">
          <article className="insight-card">
            <div className="insight-head"><div><span className="eyebrow">RINGKASAN ANGGARAN</span><h3>Total pagu anggaran aktif</h3></div><Wallet size={18}/></div>
            <div className="amount-row"><strong>{money(budgetTotal)}</strong></div>
            <p className="budget-note">Nilai pagu diambil langsung dari tabel anggaran. Realisasi dan sisa anggaran akan ditampilkan setelah perhitungan komitmen diintegrasikan.</p>
          </article>
          <article className="quick-card">
            <span className="eyebrow">AKSES CEPAT</span><h3>Mulai pekerjaan</h3>
            <div className="quick-links">
              <a href="/perjalanan/baru"><div className="quick-icon blue"><Plus size={17}/></div><span><b>Buat perjalanan baru</b><small>Ajukan perjalanan dinas</small></span><ArrowUpRight size={15}/></a>
              <a href="/pegawai"><div className="quick-icon green"><ClipboardList size={17}/></div><span><b>Kelola data pegawai</b><small>Periksa data pegawai</small></span><ArrowUpRight size={15}/></a>
            </div>
          </article>
        </div>
        <footer>© 2026 Sekretariat Daerah Kabupaten Pekalongan <span>SPPD · Sistem Perjalanan Dinas</span></footer>
      </div>
    </PerjalananShell>
  );
}
