import { ArrowUpRight, CalendarDays, ClipboardList, FileText, Wallet, Users, MapPin, Plus, Search, Bell, ChevronDown, Plane, Building2, LayoutDashboard, Settings2, ChartNoAxesCombined, Clock3, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Trip = { id:string; maksud_perjalanan:string; tempat_tujuan:string; tanggal_berangkat:string; tanggal_kembali:string; status:string; jenis_perjalanan:string };
const money=(n:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
const date=(s:string)=>new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(s+"T00:00:00"));

export default async function Home() {
  const supabase=await createClient();
  const [{count:tripCount},{count:employeeCount},{data:budgets},{data:trips},{data:userData}] = await Promise.all([
    supabase.from("perjalanan_dinas").select("id",{count:"exact",head:true}),
    supabase.from("pegawai").select("id",{count:"exact",head:true}).eq("aktif",true),
    supabase.from("anggaran").select("pagu_awal").eq("aktif",true),
    supabase.from("perjalanan_dinas").select("id,maksud_perjalanan,tempat_tujuan,tanggal_berangkat,tanggal_kembali,status,jenis_perjalanan").order("created_at",{ascending:false}).limit(5),
    supabase.auth.getUser()
  ]);
  const budgetTotal=(budgets??[]).reduce((sum,row)=>sum+Number(row.pagu_awal??0),0);
  const recent=(trips??[]) as Trip[];
  const {data:profile}=userData.user ? await supabase.from("user_akun").select("username,role,pegawai_id").eq("id",userData.user.id).maybeSingle() : {data:null};
  const stats=[
    {label:"Total perjalanan",value:String(tripCount??0),hint:"Seluruh pengajuan",icon:Plane,tone:"blue"},
    {label:"Pegawai aktif",value:String(employeeCount??0),hint:"Terdaftar dalam sistem",icon:Users,tone:"violet"},
    {label:"Pagu anggaran",value:money(budgetTotal),hint:"Total pagu aktif",icon:Wallet,tone:"green"},
    {label:"Dalam proses",value:String(recent.filter(t=>t.status==="draft").length),hint:"Dari 5 data terbaru",icon:Clock3,tone:"amber"}
  ];
  const statusLabel=(s:string)=>s==="draft"?"Draf":s==="published"?"Diterbitkan":s==="cancelled"?"Dibatalkan":s;
  const statusTone=(s:string)=>s==="published"?"done":s==="cancelled"?"progress":"pending";
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><div><b>SPPD<span>.</span></b><small>SEKRETARIAT DAERAH</small></div></div>
      <div className="workspace"><div className="workspace-icon"><Building2 size={17}/></div><div><b>Sekretariat Daerah</b><small>Kabupaten Pekalongan</small></div><ChevronDown size={15}/></div>
      <div className="nav-group"><p>MENU UTAMA</p><a className="nav-item active" href="/dashboard"><LayoutDashboard size={18}/><span>Ringkasan</span></a><a className="nav-item" href="/perjalanan"><Plane size={18}/><span>Perjalanan Dinas</span></a><a className="nav-item" href="/dokumen"><FileText size={18}/><span>Dokumen SP & SPPD</span></a><a className="nav-item" href="/pegawai"><Users size={18}/><span>Data Pegawai</span></a>{profile?.role==="admin" && !profile?.pegawai_id && <a className="nav-item" href="/master/bagian"><Building2 size={18}/><span>Master Bagian</span></a>}</div>
      <div className="nav-group"><p>MANAJEMEN</p><a className="nav-item" href="/anggaran"><Wallet size={18}/><span>Kegiatan & Anggaran</span></a>{profile?.role==="admin" && !profile?.pegawai_id && <a className="nav-item" href="/pengguna"><Users size={18}/><span>Manajemen Pengguna</span></a>}<a className="nav-item" href="/laporan"><ChartNoAxesCombined size={18}/><span>Laporan</span></a></div>
      <div className="sidebar-bottom"><a className="nav-item" href="/pengaturan"><Settings2 size={18}/>Pengaturan</a><div className="help-card"><div className="help-icon">?</div><b>Butuh bantuan?</b><p>Pusat bantuan penggunaan aplikasi SPPD.</p><a href="mailto:administrator@setda.pekalongankab.go.id">Hubungi administrator <ArrowUpRight size={13}/></a></div><div className="user-mini"><div className="avatar">AD</div><div><b>{profile?.username??"Pengguna"}</b><small>{profile?.role==="admin"?"Administrator":"Operator"}</small></div><form action="/auth/signout" method="post"><button type="submit" className="logout-button" aria-label="Keluar dari aplikasi" title="Keluar"><LogOut size={15}/><span>Keluar</span></button></form></div></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>Ringkasan</b></div><div className="top-actions"><form className="dashboard-mobile-logout" action="/auth/signout" method="post"><button type="submit" aria-label="Keluar dari aplikasi"><LogOut size={15}/><span>Keluar</span></button></form><div className="period"><CalendarDays size={15}/> Data terkini <ChevronDown size={14}/></div><button className="icon-btn" aria-label="Notifikasi"><Bell size={18}/></button><div className="top-avatar">SP</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow">SISTEM PERJALANAN DINAS</div><h1>Selamat datang, {profile?.username??"Pengguna"} <span>✦</span></h1><p>Pantau dan kelola aktivitas perjalanan dinas dalam satu tempat.</p></div><a className="primary-btn" href="/perjalanan/baru"><Plus size={17}/> Buat perjalanan dinas</a></div>
        <div className="stats-grid">{stats.map(s=><article className="stat-card" key={s.label}><div className="stat-top"><span>{s.label}</span><div className={"stat-icon "+s.tone}><s.icon size={18}/></div></div><strong>{s.value}</strong><small>{s.hint}</small></article>)}</div>
        <div className="section-heading"><div><h2>Aktivitas perjalanan</h2><p>Data pengajuan terbaru dari database SPPD.</p></div><a href="/perjalanan">Lihat semua <ArrowUpRight size={15}/></a></div>
        <div className="table-card"><div className="table-toolbar"><div className="tabs"><button className="selected">Terbaru <span>{recent.length}</span></button></div><div className="table-tools"><span className="search-btn"><Search size={16}/> Data aktual Supabase</span></div></div>
          <div className="table-wrap"><table><thead><tr><th>JENIS</th><th>KEGIATAN / MAKSUD</th><th>TUJUAN</th><th>TANGGAL BERANGKAT</th><th>STATUS</th></tr></thead><tbody>{recent.length?recent.map(t=><tr key={t.id}><td><b className="code">{t.jenis_perjalanan==="luar_kota"?"Luar kota":"Dalam kota"}</b><small className="place"><MapPin size={12}/>{t.tempat_tujuan}</small></td><td><b>{t.maksud_perjalanan}</b><small>Perjalanan dinas</small></td><td>{t.tempat_tujuan}</td><td>{date(t.tanggal_berangkat)} – {date(t.tanggal_kembali)}</td><td><span className={"status "+statusTone(t.status)}><i/>{statusLabel(t.status)}</span></td></tr>):<tr><td colSpan={5} className="empty-state">Belum ada data perjalanan dinas yang dapat ditampilkan.</td></tr>}</tbody></table></div>
          <div className="table-footer"><span>Menampilkan <b>{recent.length}</b> data terbaru · total <b>{tripCount??0}</b> perjalanan</span><a href="/perjalanan">Buka daftar perjalanan →</a></div>
        </div>
        <div className="bottom-grid"><article className="insight-card"><div className="insight-head"><div><span className="eyebrow">RINGKASAN ANGGARAN</span><h3>Total pagu anggaran aktif</h3></div><Wallet size={18}/></div><div className="amount-row"><strong>{money(budgetTotal)}</strong></div><p className="budget-note">Nilai pagu diambil langsung dari tabel anggaran. Realisasi dan sisa anggaran akan ditampilkan setelah perhitungan komitmen diintegrasikan.</p></article>
        <article className="quick-card"><span className="eyebrow">AKSES CEPAT</span><h3>Mulai pekerjaan</h3><div className="quick-links"><a href="/perjalanan/baru"><div className="quick-icon blue"><Plus size={17}/></div><span><b>Buat perjalanan baru</b><small>Ajukan perjalanan dinas</small></span><ArrowUpRight size={15}/></a><a href="/pegawai"><div className="quick-icon green"><ClipboardList size={17}/></div><span><b>Kelola data pegawai</b><small>Periksa data pegawai</small></span><ArrowUpRight size={15}/></a></div></article></div>
        <footer>© 2026 Sekretariat Daerah Kabupaten Pekalongan <span>SPPD · Sistem Perjalanan Dinas</span></footer>
      </div>
    </section>
  </main>;
}