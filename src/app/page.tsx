import { ArrowUpRight, CalendarDays, ClipboardList, FileText, Wallet, Users, MapPin, Plus, Search, Bell, ChevronDown, TrendingUp, Clock3, CheckCircle2, CircleDashed, Plane, Building2, LayoutDashboard, Settings2, ChartNoAxesCombined } from "lucide-react";

const stats = [
  { label: "Perjalanan bulan ini", value: "24", delta: "+12% dari bulan lalu", icon: Plane, tone: "blue" },
  { label: "Menunggu persetujuan", value: "06", delta: "Perlu ditindaklanjuti", icon: Clock3, tone: "amber" },
  { label: "Total realisasi", value: "Rp 48,6 jt", delta: "Bulan berjalan", icon: Wallet, tone: "green" },
  { label: "Pegawai bertugas", value: "38", delta: "Pada periode ini", icon: Users, tone: "violet" }
];
const activities = [
  { code: "SP-014/XI/2026", title: "Koordinasi pengendalian inflasi daerah", person: "Ahmad Fauzi, S.STP.", date: "24 Nov 2026", place: "Semarang", status: "Menunggu persetujuan", tone: "pending" },
  { code: "SP-013/XI/2026", title: "Rapat evaluasi kinerja perangkat daerah", person: "Dewi Anggraini, S.E.", date: "23 Nov 2026", place: "Kajen", status: "Disetujui", tone: "done" },
  { code: "SP-012/XI/2026", title: "Konsultasi penyusunan dokumen perencanaan", person: "Rizky Pratama, S.IP.", date: "21 Nov 2026", place: "Jakarta", status: "Dalam proses", tone: "progress" },
  { code: "SP-011/XI/2026", title: "Monitoring kegiatan ketahanan pangan", person: "Siti Rahmawati, S.P.", date: "20 Nov 2026", place: "Pekalongan", status: "Selesai", tone: "done" }
];
const nav = [
  { section: "MENU UTAMA", items: [{ label: "Ringkasan", icon: LayoutDashboard, active: true }, { label: "Perjalanan Dinas", icon: Plane }, { label: "Dokumen SP & SPPD", icon: FileText }, { label: "Pegawai", icon: Users }] },
  { section: "MANAJEMEN", items: [{ label: "Kegiatan & Anggaran", icon: Wallet }, { label: "Laporan", icon: ChartNoAxesCombined }] }
];
export default function Home() {
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><div><b>SPPD<span>.</span></b><small>SEKRETARIAT DAERAH</small></div></div>
      <div className="workspace"><div className="workspace-icon"><Building2 size={17}/></div><div><b>Sekretariat Daerah</b><small>Kabupaten Pekalongan</small></div><ChevronDown size={15}/></div>
      {nav.map(group => <div className="nav-group" key={group.section}><p>{group.section}</p>{group.items.map(item => <a key={item.label} className={item.active ? "nav-item active" : "nav-item"} href="#"><item.icon size={18}/><span>{item.label}</span>{item.label === "Perjalanan Dinas" && <i>24</i>}</a>)}</div>)}
      <div className="sidebar-bottom"><a className="nav-item" href="#"><Settings2 size={18}/>Pengaturan</a><div className="help-card"><div className="help-icon">?</div><b>Butuh bantuan?</b><p>Pusat bantuan penggunaan aplikasi SPPD.</p><a href="#">Hubungi administrator <ArrowUpRight size={13}/></a></div><div className="user-mini"><div className="avatar">AD</div><div><b>Administrator</b><small>Admin Sistem</small></div><button aria-label="Menu akun"><ChevronDown size={16}/></button></div></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>Ringkasan</b></div><div className="top-actions"><div className="period"><CalendarDays size={15}/> 22 November 2026 <ChevronDown size={14}/></div><button className="icon-btn" aria-label="Notifikasi"><Bell size={18}/><i/></button><div className="top-avatar">AD</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow">MINGGU, 22 NOVEMBER 2026</div><h1>Selamat datang, Administrator <span>✦</span></h1><p>Pantau dan kelola seluruh aktivitas perjalanan dinas dalam satu tempat.</p></div><button className="primary-btn"><Plus size={17}/> Buat perjalanan dinas</button></div>
        <div className="stats-grid">{stats.map(s => <article className="stat-card" key={s.label}><div className="stat-top"><span>{s.label}</span><div className={"stat-icon "+s.tone}><s.icon size={18}/></div></div><strong>{s.value}</strong><small>{s.delta}</small></article>)}</div>
        <div className="section-heading"><div><h2>Aktivitas perjalanan</h2><p>Ringkasan pengajuan dan perjalanan dinas terbaru.</p></div><a href="#">Lihat semua <ArrowUpRight size={15}/></a></div>
        <div className="table-card"><div className="table-toolbar"><div className="tabs"><button className="selected">Semua <span>24</span></button><button>Menunggu <span>06</span></button><button>Disetujui</button><button>Selesai</button></div><div className="table-tools"><button className="search-btn"><Search size={16}/> Cari perjalanan</button><button className="filter-btn">Filter <ChevronDown size={14}/></button></div></div>
          <div className="table-wrap"><table><thead><tr><th>NOMOR SURAT</th><th>KEGIATAN</th><th>PELAKSANA</th><th>TANGGAL</th><th>STATUS</th><th></th></tr></thead><tbody>{activities.map(a=><tr key={a.code}><td><b className="code">{a.code}</b><small className="place"><MapPin size={12}/>{a.place}</small></td><td><b>{a.title}</b><small>Perjalanan dinas</small></td><td>{a.person}</td><td>{a.date}</td><td><span className={"status "+a.tone}><i/>{a.status}</span></td><td><button className="more">···</button></td></tr>)}</tbody></table></div>
          <div className="table-footer"><span>Menampilkan <b>1–4</b> dari <b>24</b> perjalanan</span><div><button disabled>←</button><button className="page-current">1</button><button>2</button><button>3</button><button>→</button></div></div>
        </div>
        <div className="bottom-grid"><article className="insight-card"><div className="insight-head"><div><span className="eyebrow">RINGKASAN ANGGARAN</span><h3>Realisasi perjalanan dinas</h3></div><button>November <ChevronDown size={13}/></button></div><div className="amount-row"><strong>Rp 48.600.000</strong><span><TrendingUp size={14}/> 8,4%</span></div><div className="progress-track"><div/></div><div className="progress-label"><span>Realisasi anggaran</span><b>64,8%</b></div><div className="budget-foot"><span>Terpakai <b>Rp 48,6 jt</b></span><span>Sisa <b>Rp 26,4 jt</b></span></div></article>
        <article className="quick-card"><span className="eyebrow">AKSES CEPAT</span><h3>Mulai pekerjaan</h3><div className="quick-links"><a href="#"><div className="quick-icon blue"><Plus size={17}/></div><span><b>Buat perjalanan baru</b><small>Ajukan perjalanan dinas</small></span><ArrowUpRight size={15}/></a><a href="#"><div className="quick-icon green"><ClipboardList size={17}/></div><span><b>Kelola data pegawai</b><small>Perbarui data pegawai</small></span><ArrowUpRight size={15}/></a></div></article></div>
        <footer>© 2026 Sekretariat Daerah Kabupaten Pekalongan <span>SPPD · Sistem Perjalanan Dinas</span></footer>
      </div>
    </section>
  </main>;
}