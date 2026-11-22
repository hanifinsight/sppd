import Link from "next/link";
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Building2, CalendarClock,
  CheckCircle2, ClipboardCheck, FileCheck2, LockKeyhole, MapPinned, Plane,
  ShieldCheck, Sparkles, Users, Wallet
} from "lucide-react";

const features = [
  {
    icon: Plane,
    number: "01",
    title: "Perjalanan dinas terkelola",
    description: "Satukan proses perjalanan dinas dalam kota maupun luar kota dalam alur kerja yang lebih jelas dan tertata."
  },
  {
    icon: FileCheck2,
    number: "02",
    title: "Administrasi dokumen",
    description: "Bantu penyiapan Surat Tugas dan SPPD agar informasi perjalanan tersusun rapi dan mudah ditelusuri."
  },
  {
    icon: Users,
    number: "03",
    title: "Data pegawai terpusat",
    description: "Gunakan data pegawai sebagai dasar pengisian peserta perjalanan, tanpa perlu mengetik ulang informasi yang sama."
  },
  {
    icon: Wallet,
    number: "04",
    title: "Kegiatan dan anggaran",
    description: "Hubungkan pengajuan perjalanan dengan kegiatan serta pagu anggaran yang menjadi acuan pelaksanaannya."
  }
];

const steps = [
  { icon: ClipboardCheck, title: "Siapkan pengajuan", text: "Pilih kegiatan, lengkapi maksud perjalanan, tujuan, jadwal, dan peserta." },
  { icon: FileCheck2, title: "Periksa administrasi", text: "Tinjau informasi perjalanan dan kelengkapan dokumen sebelum diterbitkan." },
  { icon: Activity, title: "Pantau proses", text: "Lihat status pengajuan dan informasi perjalanan melalui satu ruang kerja." }
];

export default function LandingPage() {
  return (
    <main id="top" className="landing-page">
      <header className="lp-header">
        <div className="lp-nav lp-container">
          <Link href="/" className="lp-brand" aria-label="SPPD beranda">
            <span className="lp-brand-mark">S</span>
            <span className="lp-brand-copy"><b>SPPD<span>.</span></b><small>SEKRETARIAT DAERAH</small></span>
          </Link>
          <nav className="lp-links" aria-label="Navigasi utama">
            <a href="#fitur">Fitur</a>
            <a href="#alur">Alur kerja</a>
            <a href="#keamanan">Keamanan</a>
          </nav>
          <Link className="lp-login-link" href="/login">Masuk aplikasi <ArrowUpRight size={16}/></Link>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-container lp-hero-grid">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow"><span className="lp-eyebrow-dot"/> SISTEM PERJALANAN DINAS TERINTEGRASI</div>
            <h1>Urus perjalanan dinas jadi <em>lebih tertata.</em></h1>
            <p className="lp-lead">Satu ruang kerja untuk membantu pengelolaan perjalanan dinas, administrasi dokumen, data pegawai, dan anggaran di lingkungan Sekretariat Daerah Kabupaten Pekalongan.</p>
            <div className="lp-hero-actions">
              <Link href="/login" className="lp-primary">Masuk ke aplikasi <ArrowRight size={17}/></Link>
              <a href="#fitur" className="lp-secondary">Jelajahi fitur <ArrowUpRight size={16}/></a>
            </div>
            <div className="lp-trust-line"><ShieldCheck size={16}/> Akses khusus pengguna yang telah terdaftar</div>
          </div>

          <div className="lp-visual-wrap" aria-label="Ilustrasi tampilan ruang kerja SPPD">
            <div className="lp-orbit lp-orbit-one"/>
            <div className="lp-orbit lp-orbit-two"/>
            <div className="lp-glow"/>
            <div className="lp-dashboard-card">
              <div className="lp-preview-top">
                <div className="lp-preview-brand"><span>S</span><b>Ruang kerja SPPD</b></div>
                <div className="lp-preview-dots"><i/><i/><i/></div>
              </div>
              <div className="lp-preview-heading">
                <div><small>RINGKASAN PENGELOLAAN</small><h3>Perjalanan dinas</h3></div>
                <div className="lp-preview-icon"><Plane size={18}/></div>
              </div>
              <div className="lp-preview-kpis">
                <div><span>Administrasi</span><b>Terstruktur</b><small><CheckCircle2 size={12}/> Alur lebih jelas</small></div>
                <div><span>Pengelolaan</span><b>Terpusat</b><small><CheckCircle2 size={12}/> Data terkoneksi</small></div>
              </div>
              <div className="lp-preview-section">
                <div className="lp-preview-section-head"><b>Alur perjalanan</b><span>Gambaran proses</span></div>
                <div className="lp-preview-step is-complete"><span className="lp-step-icon"><ClipboardCheck size={14}/></span><div><b>Pengajuan perjalanan</b><small>Data dan peserta dilengkapi</small></div><CheckCircle2 size={15}/></div>
                <div className="lp-preview-step is-active"><span className="lp-step-icon"><FileCheck2 size={14}/></span><div><b>Administrasi dokumen</b><small>Persiapan dan pemeriksaan</small></div><span className="lp-step-tag">PROSES</span></div>
                <div className="lp-preview-step"><span className="lp-step-icon"><Activity size={14}/></span><div><b>Pemantauan</b><small>Status perjalanan dinas</small></div><span className="lp-step-muted">BERIKUTNYA</span></div>
              </div>
              <div className="lp-preview-foot"><span><LockKeyhole size={12}/> Ruang kerja terlindungi</span><span>SPPD <b>·</b> SETDA</span></div>
            </div>
            <div className="lp-float-card lp-float-top"><span className="lp-float-icon"><CalendarClock size={17}/></span><span><b>Jadwal tercatat</b><small>Informasi perjalanan rapi</small></span></div>
            <div className="lp-float-card lp-float-bottom"><span className="lp-float-icon gold"><BadgeCheck size={17}/></span><span><b>Administrasi terarah</b><small>Data dalam satu alur</small></span></div>
          </div>
        </div>
      </section>

      <section className="lp-strip">
        <div className="lp-container lp-strip-inner">
          <div><span className="lp-strip-mark"><Building2 size={18}/></span><span><b>SEKRETARIAT DAERAH</b><small>KABUPATEN PEKALONGAN</small></span></div>
          <p>Lebih tertib dalam proses. Lebih mudah dalam pemantauan.</p>
          <span className="lp-strip-tag"><Sparkles size={14}/> Satu sistem, satu alur kerja</span>
        </div>
      </section>

      <section className="lp-section lp-features" id="fitur">
        <div className="lp-container">
          <div className="lp-section-heading">
            <div className="lp-eyebrow">DIBUAT UNTUK KEBUTUHAN KERJA</div>
            <h2>Semua kebutuhan perjalanan dinas,<br/><em>dalam satu tempat.</em></h2>
            <p>Susun informasi dengan lebih konsisten dan bantu tim bekerja dengan alur administrasi yang mudah dipahami.</p>
          </div>
          <div className="lp-feature-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return <article className="lp-feature-card" key={feature.number}>
                <div className="lp-feature-card-top"><span className="lp-feature-icon"><Icon size={20}/></span><span>{feature.number}</span></div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <div className="lp-feature-line"/>
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className="lp-process" id="alur">
        <div className="lp-container lp-process-grid">
          <div className="lp-process-copy">
            <div className="lp-eyebrow">ALUR KERJA YANG LEBIH JELAS</div>
            <h2>Dari pengajuan<br/>hingga pemantauan.</h2>
            <p>Informasi perjalanan dinas disusun secara bertahap agar setiap proses lebih mudah diperiksa dan ditindaklanjuti.</p>
            <Link href="/login" className="lp-text-link">Mulai gunakan aplikasi <ArrowUpRight size={16}/></Link>
          </div>
          <div className="lp-process-list">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return <article className="lp-process-item" key={step.title}>
                <div className="lp-process-num">{String(index + 1).padStart(2, "0")}</div>
                <div className="lp-process-icon"><Icon size={19}/></div>
                <div><h3>{step.title}</h3><p>{step.text}</p></div>
                {index < steps.length - 1 && <span className="lp-process-connector"/>}
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className="lp-security" id="keamanan">
        <div className="lp-container lp-security-inner">
          <div className="lp-security-icon"><ShieldCheck size={25}/></div>
          <div><div className="lp-eyebrow">AKSES DAN KEAMANAN</div><h2>Ruang kerja untuk pengguna berwenang.</h2><p>Pengguna masuk menggunakan akun terdaftar. Hak akses membedakan fungsi administrator dan operator sesuai kewenangannya.</p></div>
          <Link href="/login" className="lp-security-button">Masuk dengan akun <ArrowRight size={16}/></Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <Link href="/" className="lp-brand"><span className="lp-brand-mark">S</span><span className="lp-brand-copy"><b>SPPD<span>.</span></b><small>SEKRETARIAT DAERAH</small></span></Link>
          <p>© 2026 Sekretariat Daerah Kabupaten Pekalongan</p>
          <a href="#top">Kembali ke atas ↑</a>
        </div>
      </footer>
    </main>
  );
}
