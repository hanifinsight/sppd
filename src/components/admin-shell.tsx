import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight, Building2, ChevronDown, ClipboardList, LayoutDashboard,
  Settings2, Users, Wallet, ChartNoAxesCombined, FileText, Plane
} from "lucide-react";

type Props = {
  username: string;
  active: "bagian" | "pegawai";
  children: ReactNode;
};

export default function AdminShell({ username, active, children }: Props) {
  return (
    <main className="app-shell master-app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand master-brand-link">
          <div className="brand-mark">S</div>
          <div><b>SPPD<span>.</span></b><small>SEKRETARIAT DAERAH</small></div>
        </Link>
        <div className="workspace">
          <div className="workspace-icon"><Building2 size={17}/></div>
          <div><b>Sekretariat Daerah</b><small>Kabupaten Pekalongan</small></div>
          <ChevronDown size={15}/>
        </div>
        <div className="nav-group">
          <p>MENU UTAMA</p>
          <Link className="nav-item" href="/dashboard"><LayoutDashboard size={18}/><span>Ringkasan</span></Link>
          <Link className={"nav-item " + (active === "bagian" ? "active" : "")} href="/master/bagian"><Building2 size={18}/><span>Master Bagian</span></Link>
          <Link className={"nav-item " + (active === "pegawai" ? "active" : "")} href="/pegawai"><Users size={18}/><span>Data Pegawai</span></Link>
        </div>
        <div className="nav-group">
          <p>DATA DAN ADMINISTRASI</p>
          <Link className="nav-item" href="/pengaturan"><Settings2 size={18}/><span>Pejabat & Pengelola</span></Link>
          <Link className="nav-item" href="/anggaran"><Wallet size={18}/><span>Kegiatan & Anggaran</span></Link>
          <Link className="nav-item" href="/perjalanan"><Plane size={18}/><span>Perjalanan Dinas</span></Link>
          <Link className="nav-item" href="/dokumen"><FileText size={18}/><span>Dokumen SP & SPPD</span></Link>
          <Link className="nav-item" href="/laporan"><ChartNoAxesCombined size={18}/><span>Laporan</span></Link>
        </div>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">?</div><b>Administrasi data</b>
            <p>Kelola data referensi dan pegawai Sekretariat Daerah.</p>
            <a href="mailto:administrator@setda.pekalongankab.go.id">Pusat bantuan <ArrowUpRight size={13}/></a>
          </div>
          <div className="user-mini">
            <div className="avatar">AG</div>
            <div><b>{username}</b><small>Admin Global</small></div>
            <form action="/auth/signout" method="post"><button aria-label="Keluar" title="Keluar">↗</button></form>
          </div>
        </div>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <b>Data Master</b></div>
          <div className="top-actions"><span className="master-admin-pill">Administrator Global</span><div className="top-avatar">AG</div></div>
        </header>
        <div className="content master-content">{children}</div>
      </section>
    </main>
  );
}
