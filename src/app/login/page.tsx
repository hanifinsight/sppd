"use client";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Eye, EyeOff, ShieldCheck, LockKeyhole } from "lucide-react";

type Profile = { id:string; username:string|null; role:"admin"|"operator"; aktif:boolean; must_change_password:boolean; pegawai_id:string|null };

export default function LoginPage() {
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [show,setShow]=useState(false);
  const [showNew,setShowNew]=useState(false);
  const [mustChange,setMustChange]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [supabase]=useState(()=>createClient());

  useEffect(()=>{
    let active=true;
    async function restore() {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.user) return;
      const {data:profile}=await supabase.from("user_akun")
        .select("id,username,role,aktif,must_change_password,pegawai_id")
        .eq("id",session.user.id).maybeSingle();
      if(!active) return;
      if(!profile || !profile.aktif) { await supabase.auth.signOut(); return; }
      if(profile.must_change_password) setMustChange(true);
      else window.location.replace("/");
    }
    restore().catch(()=>{});
    return ()=>{active=false};
  },[supabase]);

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setNotice(""); setBusy(true);
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
      if(profile.must_change_password) { setMustChange(true); setNotice("Untuk keamanan, buat password baru sebelum melanjutkan."); return; }
      window.location.replace("/");
    } catch(err) {
      setError(err instanceof Error?err.message:"Login gagal. Silakan coba kembali.");
      await supabase.auth.signOut();
    } finally { setBusy(false); }
  }

  async function changePassword(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setNotice(""); 
    if(newPassword.length<8) { setError("Password baru minimal 8 karakter."); return; }
    if(newPassword!==confirmPassword) { setError("Konfirmasi password belum sama."); return; }
    setBusy(true);
    try {
      const {error:updateError}=await supabase.auth.updateUser({password:newPassword});
      if(updateError) throw updateError;
      const {data:{user}}=await supabase.auth.getUser();
      if(!user) throw new Error("Sesi tidak ditemukan. Silakan masuk kembali.");
      const {data:profile,error:profileError}=await supabase.from("user_akun")
        .select("must_change_password").eq("id",user.id).single();
      if(profileError) throw profileError;
      if(profile.must_change_password) throw new Error("Password berhasil diperbarui, tetapi status perubahan awal belum diperbarui oleh sistem. Hubungi administrator agar akun dapat diaktifkan.");
      setNotice("Password berhasil diperbarui. Mengalihkan ke dashboard...");
      window.location.replace("/");
    } catch(err) {
      setError(err instanceof Error?err.message:"Gagal memperbarui password.");
    } finally { setBusy(false); }
  }

  return <main className="login-shell">
    <section className="login-brand-panel">
      <div className="login-brand"><div className="brand-mark">S</div><div><b>SPPD<span>.</span></b><small>SEKRETARIAT DAERAH</small></div></div>
      <div className="login-message"><div className="login-kicker">SISTEM INFORMASI TERINTEGRASI</div><h1>Perjalanan dinas,<br/><em>lebih tertata.</em></h1><p>Kelola pengajuan, dokumen, dan anggaran perjalanan dinas dalam satu sistem yang transparan dan efisien.</p><div className="login-feature"><ShieldCheck size={17}/> Akses aman dan terkontrol untuk pengguna berwenang</div></div>
      <div className="login-footer">© 2026 Sekretariat Daerah Kabupaten Pekalongan</div>
    </section>
    <section className="login-form-panel"><div className="login-form-wrap">
      <div className="login-mobile-brand"><div className="brand-mark">S</div><b>SPPD<span>.</span></b></div>
      <div className="login-form-heading"><div className="eyebrow">{mustChange?"PENGAMANAN AKUN":"SELAMAT DATANG KEMBALI"}</div><h2>{mustChange?"Buat password baru":"Masuk ke akun Anda"}</h2><p>{mustChange?"Password awal harus diganti sebelum Anda dapat menggunakan aplikasi.":"Gunakan username dan password yang telah diberikan administrator."}</p></div>
      {mustChange ? <form onSubmit={changePassword}>
        <label htmlFor="newPassword">Password baru</label><div className="password-field"><input id="newPassword" type={showNew?"text":"password"} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Minimal 8 karakter" required/><button type="button" onClick={()=>setShowNew(!showNew)} aria-label="Tampilkan password">{showNew?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
        <label htmlFor="confirmPassword">Konfirmasi password baru</label><input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Ulangi password baru" required/>
        {error&&<div className="login-error" role="alert">{error}</div>}{notice&&<div className="login-notice" role="status">{notice}</div>}
        <button className="login-submit" disabled={busy}>{busy?"Menyimpan...":"Simpan password baru"} <LockKeyhole size={16}/></button>
      </form> : <form onSubmit={submit}>
        <label htmlFor="username">Username</label><input id="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Masukkan username" required/>
        <label htmlFor="password">Password</label><div className="password-field"><input id="password" type={show?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Masukkan password" required/><button type="button" onClick={()=>setShow(!show)} aria-label="Tampilkan password">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
        {error&&<div className="login-error" role="alert">{error}</div>}{notice&&<div className="login-notice" role="status">{notice}</div>}
        <button className="login-submit" disabled={busy}>{busy?"Memeriksa akun...":"Masuk ke aplikasi"} <ArrowRight size={17}/></button>
      </form>}
      <div className="login-secure"><ShieldCheck size={15}/> Koneksi terlindungi · Akses sesuai hak pengguna</div>
    </div></section>
  </main>;
}