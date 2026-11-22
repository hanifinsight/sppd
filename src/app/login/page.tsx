"use client";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if(!url||!key) throw new Error("Konfigurasi Supabase belum tersedia.");
      const response=await fetch(url+"/functions/v1/username-login",{
        method:"POST",headers:{"Content-Type":"application/json","apikey":key},
        body:JSON.stringify({username:username.trim().toLowerCase(),password})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Username atau password tidak sesuai.");
      const supabase=createClient();
      const {data:sessionData,error:sessionError}=await supabase.auth.setSession({
        access_token:data.access_token,refresh_token:data.refresh_token
      });
      if(sessionError) throw sessionError;
      const {data:profile,error:profileError}=await supabase.from("user_akun")
        .select("id,username,role,aktif,must_change_password,pegawai_id")
        .eq("id",sessionData.user.id).maybeSingle();
      if(profileError) throw profileError;
      if(!profile) throw new Error("Profil akun tidak ditemukan. Hubungi administrator.");
      if(!profile.aktif) throw new Error("Akun tidak aktif. Hubungi administrator.");
      if(profile.must_change_password) {
        throw new Error("Login berhasil. Fitur penggantian password awal sedang disiapkan; silakan hubungi administrator sementara.");
      }
      window.location.href="/";
    } catch(err) {
      setError(err instanceof Error?err.message:"Login gagal. Silakan coba kembali.");
      try { await createClient().auth.signOut(); } catch {}
    } finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-brand-panel"><div className="login-brand"><div className="brand-mark">S</div><div><b>SPPD<span>.</span></b><small>SEKRETARIAT DAERAH</small></div></div><div className="login-message"><div className="login-kicker">SISTEM INFORMASI TERINTEGRASI</div><h1>Perjalanan dinas,<br/><em>lebih tertata.</em></h1><p>Kelola pengajuan, dokumen, dan anggaran perjalanan dinas dalam satu sistem yang transparan dan efisien.</p><div className="login-feature"><ShieldCheck size={17}/> Akses aman dan terkontrol untuk pengguna berwenang</div></div><div className="login-footer">© 2026 Sekretariat Daerah Kabupaten Pekalongan</div></section><section className="login-form-panel"><div className="login-form-wrap"><div className="login-mobile-brand"><div className="brand-mark">S</div><b>SPPD<span>.</span></b></div><div className="login-form-heading"><div className="eyebrow">SELAMAT DATANG KEMBALI</div><h2>Masuk ke akun Anda</h2><p>Gunakan username dan password yang telah diberikan administrator.</p></div><form onSubmit={submit}><label htmlFor="username">Username</label><input id="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Masukkan username" required/><label htmlFor="password">Password</label><div className="password-field"><input id="password" type={show?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Masukkan password" required/><button type="button" onClick={()=>setShow(!show)} aria-label="Tampilkan password">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{error&&<div className="login-error" role="alert">{error}</div>}<button className="login-submit" disabled={busy}>{busy?"Memeriksa akun...":"Masuk ke aplikasi"} <ArrowRight size={17}/></button></form><div className="login-secure"><ShieldCheck size={15}/> Koneksi terlindungi · Akses sesuai hak pengguna</div></div></section></main>;
}