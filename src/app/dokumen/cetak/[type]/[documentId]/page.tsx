import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintActions from "./print-actions";
import styles from "./print.module.css";

export const dynamic = "force-dynamic";
type R = Record<string, any>;
type Person = { id:string; name:string; nip:string; rank:string; job:string; days:number; rate:number; amount:number };
const v=(x:unknown)=>x==null?"":String(x);
const date=(x:string)=>x?new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(new Date(x+"T00:00:00")):"—";
const range=(a:string,b:string)=>!a?"—":a===b?date(a):date(a)+" s.d. "+date(b);
const days=(a:string,b:string)=>!a||!b?0:Math.max(1,Math.round((Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000)+1);
const rupiah=(n:number)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(n||0);
const words=(n:number):string=>{const x=Math.floor(Math.abs(n)),u=["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];if(x<12)return u[x];if(x<20)return words(x-10)+" belas";if(x<100)return words(Math.floor(x/10))+" puluh"+(x%10?" "+words(x%10):"");if(x<200)return "seratus"+(x%100?" "+words(x%100):"");if(x<1000)return words(Math.floor(x/100))+" ratus"+(x%100?" "+words(x%100):"");if(x<2000)return "seribu"+(x%1000?" "+words(x%1000):"");if(x<1000000)return words(Math.floor(x/1000))+" ribu"+(x%1000?" "+words(x%1000):"");if(x<1000000000)return words(Math.floor(x/1000000))+" juta"+(x%1000000?" "+words(x%1000000):"");return words(Math.floor(x/1000000000))+" miliar"+(x%1000000000?" "+words(x%1000000000):"");};
const terbilang=(n:number)=>(n<0?"minus ":"")+(words(n)||"nol")+" rupiah";

function Header(){return <header className={styles.header}><img src="/images/lambang-kabupaten-pekalongan.jpeg" alt="Lambang Kabupaten Pekalongan"/><div><div>PEMERINTAH KABUPATEN PEKALONGAN</div><strong>SEKRETARIAT DAERAH</strong><small>Jalan Alun-alun Utara Nomor 1 Kajen Pekalongan, Kode Pos 51161, Telepon (0285) 381000,</small><small>Faksimile (0285) 381006, Laman setda.pekalongankab.go.id, Pos-el setda@pekalongankab.go.id</small></div></header>}
function Line({label,children}:{label:string;children:any}){return <div className={styles.line}><span>{label}</span><b>:</b><div>{children}</div></div>}
function Annex({people,number,issued,title}:{people:Person[];number:string;issued:string;title:string}){return <section className={styles.paper}><Header/><h1 className={styles.annexTitle}>{title}</h1><h2 className={styles.annexSub}>DAFTAR PEGAWAI YANG MELAKSANAKAN PERJALANAN DINAS</h2><p className={styles.annexMeta}>Nomor : {number}<br/>Tanggal : {date(issued)}</p><table className={styles.annexTable}><thead><tr><th>No.</th><th>Nama / NIP</th><th>Pangkat / Golongan</th><th>Jabatan</th></tr></thead><tbody>{people.map((p,i)=><tr key={p.id}><td>{i+1}</td><td><b>{p.name}</b><small>NIP. {p.nip||"—"}</small></td><td>{p.rank||"—"}</td><td>{p.job||"—"}</td></tr>)}</tbody></table></section>}

export default async function PrintPage({params}:{params:Promise<{type:string;documentId:string}>}){
 const {type,documentId}=await params;
 if(type!=="sp"&&type!=="sppd"&&type!=="penerimaan"&&type!=="lampiran")notFound();
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/login");
 const {data:profile}=await db.from("user_akun").select("role,pegawai_id,aktif,must_change_password").eq("id",user.id).maybeSingle();
 if(!profile||!profile.aktif||profile.must_change_password||(profile.role!=="admin"&&profile.role!=="operator"))redirect("/login");
 if(profile.role==="admin"&&profile.pegawai_id!==null)redirect("/dashboard");
 if(profile.role==="operator"&&!profile.pegawai_id)redirect("/dashboard");

 const docQuery=type==="sp"
  ? await db.from("dokumen_sp").select("id,perjalanan_id,nomor_sp,tanggal_terbit,penandatangan_id,nama_penandatangan_snapshot,jabatan_snapshot").eq("id",documentId).maybeSingle()
  : await db.from("dokumen_sppd").select("id,perjalanan_id,nomor_sppd,tanggal_terbit,ppk_id,nama_ppk_snapshot,jabatan_ppk_snapshot").eq("id",documentId).maybeSingle();
 const doc=docQuery.data as R|null;
 if(!doc)notFound();
 const {data:tripData}=await db.from("perjalanan_dinas").select("id,kegiatan_id,anggaran_id,jenis_perjalanan,nomor_undangan,maksud_perjalanan,lokasi_acara,tanggal_acara_mulai,tanggal_acara_selesai,tempat_berangkat,tempat_tujuan,provinsi_tujuan,tanggal_berangkat,tanggal_kembali,alat_angkut,status,kpa_sppd_id").eq("id",doc.perjalanan_id).maybeSingle();
 const trip=tripData as R|null;
 if(!trip||trip.status!=="published")notFound();

 const [pRes,cRes,costRes,aRes,bRes,mRes]=await Promise.all([
  db.from("perjalanan_peserta").select("id,nama_snapshot,nip_snapshot,pangkat_snapshot,jabatan_snapshot").eq("perjalanan_id",trip.id).order("created_at"),
  db.from("perjalanan_pengikut").select("nama,tanggal_lahir,keterangan").eq("perjalanan_id",trip.id).order("created_at"),
  db.from("perjalanan_biaya_lain").select("jenis_biaya,nominal,keterangan").eq("perjalanan_id",trip.id),
  db.from("kegiatan").select("id,bagian_id,kode_subkegiatan,nama_subkegiatan,tahun_anggaran").eq("id",trip.kegiatan_id).maybeSingle(),
  db.from("anggaran").select("rekening_id").eq("id",trip.anggaran_id).maybeSingle(),
  db.from("pejabat_pengelola").select("id,pegawai_id,jenis_peran,bagian_id,kegiatan_id").eq("aktif",true)
 ]);
 let spOfficialRow:R|null=null;
 if(type==="sp"){const {data}=await db.from("pejabat_dokumen").select("id,pegawai_id").eq("id",doc.penandatangan_id).maybeSingle();spOfficialRow=data as R|null;}
 const rawPeople=(pRes.data??[]) as R[];
 const participantIds=rawPeople.map(p=>v(p.id));
 const [rateRes,accountRes]=await Promise.all([
  participantIds.length?db.from("perjalanan_biaya_peserta").select("perjalanan_peserta_id,jumlah_hari,tarif_snapshot,total_uang_harian").in("perjalanan_peserta_id",participantIds):Promise.resolve({data:[]}),
  bRes.data?.rekening_id?db.from("rekening_belanja").select("kode_rekening,nama_rekening").eq("id",bRes.data.rekening_id).maybeSingle():Promise.resolve({data:null})
 ]);
 const rateMap=new Map(((rateRes.data??[]) as R[]).map(r=>[r.perjalanan_peserta_id,r]));
 const duration=days(v(trip.tanggal_berangkat),v(trip.tanggal_kembali));
 const people:Person[]=rawPeople.map(p=>{const r=rateMap.get(p.id);return{id:v(p.id),name:v(p.nama_snapshot)||"—",nip:v(p.nip_snapshot),rank:v(p.pangkat_snapshot),job:v(p.jabatan_snapshot),days:Number(r?.jumlah_hari??duration),rate:Number(r?.tarif_snapshot??0),amount:Number(r?.total_uang_harian??0)};});
 const activity=aRes.data as R|null;
 const sectionId=v(activity?.bagian_id);
 const [sectionRes]=await Promise.all([
  sectionId?db.from("bagian").select("nama_bagian").eq("id",sectionId).maybeSingle():Promise.resolve({data:null}),
 ]);
 const managers=(mRes.data??[]) as R[];
 const officialIds=Array.from(new Set([...managers.map(r=>v(r.pegawai_id)),v(spOfficialRow?.pegawai_id)].filter(Boolean)));
 const {data:employeeRows}=officialIds.length?await db.from("pegawai").select("id,nama,nip,jabatan,nomenklatur_jabatan").in("id",officialIds):{data:[]};
 const employeeMap=new Map(((employeeRows??[]) as R[]).map(r=>[r.id,r]));
 const official=(row:R|undefined,name="",job="")=>{const e=row?employeeMap.get(row.pegawai_id):undefined;return{name:name||v(e?.nama)||"—",nip:v(e?.nip),job:job||v(e?.nomenklatur_jabatan)||v(e?.jabatan)};};
 const kpaRow=managers.find(r=>r.id===(type!=="sp"?doc.ppk_id:trip.kpa_sppd_id))??managers.find(r=>r.jenis_peran==="KPA"&&r.bagian_id===sectionId);
 const pptkRow=managers.find(r=>r.jenis_peran==="PPTK"&&r.kegiatan_id===trip.kegiatan_id);
 const bppRow=managers.find(r=>r.jenis_peran==="Bendahara Pengeluaran Pembantu"&&r.bagian_id===sectionId);
 const kpa=official(kpaRow,type!=="sp"?v(doc.nama_ppk_snapshot):"",type!=="sp"?v(doc.jabatan_ppk_snapshot):"");
 const pptk=official(pptkRow),bpp=official(bppRow);
 const spSigner=official(spOfficialRow??undefined,type==="sp"?v(doc.nama_penandatangan_snapshot):"",type==="sp"?v(doc.jabatan_snapshot):"");
 const number=v(type==="sp"?doc.nomor_sp:doc.nomor_sppd),issued=v(doc.tanggal_terbit);
 const costRows=(costRes.data??[]) as R[];
 const sum=(match:(kind:string)=>boolean)=>costRows.filter(c=>match(v(c.jenis_biaya).toLowerCase())).reduce((s,c)=>s+Number(c.nominal||0),0);
 const bbm=sum(s=>s.includes("bbm")||s.includes("tiket")),tol=sum(s=>s.includes("tol")),hotel=sum(s=>s.includes("hotel")||s.includes("penginapan"));
 const uh=people.reduce((s,p)=>s+p.amount,0),total=uh+bbm+tol+hotel;
 const otherRows=costRows.filter(c=>!["bbm","tiket","tol","hotel","penginapan"].some(k=>v(c.jenis_biaya).toLowerCase().includes(k)));
 const companions=(cRes.data??[]) as R[],isCity=v(trip.jenis_perjalanan)==="dalam_kota",sectionName=v(sectionRes.data?.nama_bagian);
 const account=accountRes.data as R|null;

 return <main className={styles.screen}>
  <div className={styles.toolbar}><a href="/dokumen">← Kembali ke dokumen</a><PrintActions/></div>
  {type==="sp"&&<section className={styles.paper}>
   <Header/><h1 className={styles.title}>SURAT TUGAS</h1><p className={styles.docNumber}>Nomor : {number||"—"}</p>
   <div className={styles.signerIntro}><Line label="Nama">{spSigner.name}</Line><Line label="Jabatan">{spSigner.job||"—"}</Line></div>
   <h2 className={styles.command}>MEMERINTAHKAN</h2>
   <div className={styles.spGrid}><div>Kepada</div><div><ol className={styles.peopleList}>{people.slice(0,4).map(p=><li key={p.id}><div><span>Nama</span><b>:</b>{p.name}</div><div><span>NIP</span><b>:</b>{p.nip||"—"}</div><div><span>Jabatan</span><b>:</b>{p.job||"—"}</div></li>)}</ol>{people.length>4&&<p className={styles.italic}>Pegawai lainnya tercantum dalam lampiran Surat Tugas ini.</p>}</div></div>
   <div className={styles.spGrid}><div>Untuk</div><div>{v(trip.maksud_perjalanan)||"—"}</div></div><div className={styles.spGrid}><div>Hari / Tanggal</div><div>{range(v(trip.tanggal_acara_mulai),v(trip.tanggal_acara_selesai))}</div></div><div className={styles.spGrid}><div>Tempat</div><div>{v(trip.lokasi_acara)||v(trip.tempat_tujuan)}</div></div>
   <p className={styles.closing}>Demikian Surat Perintah ini dibuat untuk dapat dilaksanakan dengan sebaik-baiknya dan penuh tanggungjawab.</p>
   <div className={styles.spSign}><div>Kajen, {date(issued)}</div><b>a.n. SEKRETARIS DAERAH</b><div className={styles.signGap}/><b className={styles.underlined}>{spSigner.name}</b><div>{spSigner.nip?"NIP. "+spSigner.nip:""}</div></div>
  </section>}
  {type!=="sp"&&<>
   {type==="sppd"&&<section className={styles.paper}>
    <Header/><div className={styles.spdMeta}><div><span>Lembar ke</span><b>:</b> 1</div><div><span>Kode Nomor</span><b>:</b> 000.1.2.3</div><div><span>Nomor</span><b>:</b> {number||"—"}</div></div>
    <h1 className={styles.title}>SURAT PERJALANAN DINAS (SPD)</h1>
    <table className={styles.spd}><colgroup><col className={styles.no}/><col className={styles.label}/><col/></colgroup><tbody>
     <tr><td>1.</td><td>Pejabat Pembuat Komitmen</td><td>{kpa.name}</td></tr>
     <tr><td>2.</td><td>Nama/NIP Pegawai yang melaksanakan perjalanan dinas</td><td>{people.slice(0,4).map((p,i)=><div className={styles.personRow} key={p.id}>{i+1}) {p.name}<br/>NIP. {p.nip||"—"}</div>)}{people.length>4&&<i>Selengkapnya tercantum dalam lampiran.</i>}</td></tr>
     <tr><td rowSpan={3}>3.</td><td>a. Pangkat dan Golongan</td><td>{people.slice(0,4).map(p=><div key={p.id}>{p.rank||"—"}</div>)}</td></tr>
     <tr><td>b. Jabatan/Instansi</td><td>{people.slice(0,4).map(p=><div key={p.id}>{p.job||"—"}</div>)}</td></tr>
     <tr><td>c. Tingkat Biaya Perjalanan Dinas</td><td>{isCity?"Dinas Dalam Kota":"Dinas Biasa"}</td></tr>
     <tr><td>4.</td><td>Maksud perjalanan dinas</td><td>{v(trip.maksud_perjalanan)||"—"}</td></tr>
     <tr><td>5.</td><td>Alat angkut yang dipergunakan</td><td>{v(trip.alat_angkut)||"—"}</td></tr>
     <tr><td rowSpan={2}>6.</td><td>a. Tempat Berangkat</td><td>{v(trip.tempat_berangkat)||"—"}</td></tr><tr><td>b. Tempat Tujuan</td><td>{v(trip.tempat_tujuan)}{trip.provinsi_tujuan?", "+v(trip.provinsi_tujuan):""}</td></tr>
     <tr><td rowSpan={3}>7.</td><td>a. Lamanya Perjalanan Dinas</td><td>{duration} hari</td></tr><tr><td>b. Tanggal berangkat</td><td>{date(v(trip.tanggal_berangkat))}</td></tr><tr><td>c. Tanggal harus kembali</td><td>{date(v(trip.tanggal_kembali))}</td></tr>
     <tr><td>8.</td><td>Pengikut : Nama</td><td><table className={styles.followers}><thead><tr><th>Nama</th><th>Tanggal Lahir</th><th>Keterangan</th></tr></thead><tbody>{companions.length?companions.map((p,i)=><tr key={i}><td>{i+1}) {v(p.nama)}</td><td>{p.tanggal_lahir?date(v(p.tanggal_lahir)):""}</td><td>{v(p.keterangan)}</td></tr>):[1,2].map(n=><tr key={n}><td>{n})</td><td>{n})</td><td></td></tr>)}</tbody></table></td></tr>
     <tr><td rowSpan={2}>9.</td><td>a. Instansi</td><td>Sekretariat Daerah Kabupaten Pekalongan</td></tr><tr><td>b. Akun</td><td>{[v(account?.kode_rekening),v(account?.nama_rekening)].filter(Boolean).join(" – ")||"APBD Kabupaten Pekalongan"} · APBD Kabupaten Pekalongan Tahun Anggaran {v(activity?.tahun_anggaran)||new Date(issued).getFullYear()}</td></tr>
     <tr><td>10.</td><td>Keterangan Lain-Lain</td><td>{v(trip.nomor_undangan)?"Undangan: "+v(trip.nomor_undangan):"—"}</td></tr>
    </tbody></table>
    <div className={styles.spdSign}><div><Line label="Dikeluarkan di">Kajen</Line><Line label="Tanggal">{date(issued)}</Line></div><b>Pejabat Pembuat Komitmen</b><b>{sectionName}</b><div className={styles.signGap}/><b className={styles.underlined}>{kpa.name}</b><div>{kpa.nip?"NIP. "+kpa.nip:""}</div></div>
   </section>}
   {(type==="sppd"||type==="penerimaan")&&<section className={styles.paper}><Header/><h1 className={styles.receiptTitle}>{isCity?"PENERIMAAN PERJALANAN DINAS DALAM KOTA":"PENERIMAAN PERJALANAN DINAS BIASA"}</h1><div className={styles.receiptSub}><b>KE {v(trip.tempat_tujuan).toLocaleUpperCase("id-ID")}</b><b>TANGGAL {range(v(trip.tanggal_berangkat),v(trip.tanggal_kembali)).toLocaleUpperCase("id-ID")}</b></div>
    <table className={styles.receipt}><thead><tr><th>No</th><th>Nama</th><th>Gol</th><th>Jml Hari</th><th>Nominal</th><th>Penerimaan</th><th>Tanda Tangan</th></tr></thead><tbody>
     {people.map((p,i)=><tr key={p.id}><td>{i+1}</td><td className={styles.nameCell}>{p.name}<small>NIP. {p.nip||"—"}</small></td><td>{p.rank.match(/\(([^)]+)\)/)?.[1]||p.rank||"—"}</td><td>{p.days}</td><td>{p.rate?"Rp "+rupiah(p.rate):"—"}</td><td>{p.amount?"Rp "+rupiah(p.amount):"—"}</td><td>{i+1}</td></tr>)}
     {[["BBM/Tiket",bbm],["TOL",tol],["Penginapan/Hotel",hotel],...otherRows.map(r=>[v(r.jenis_biaya),Number(r.nominal||0)])].map((r,i)=><tr key={i}><td></td><td colSpan={4} className={styles.costLabel}>{r[0]}</td><td>{Number(r[1])?"Rp "+rupiah(Number(r[1])):"—"}</td><td></td></tr>)}
     <tr className={styles.total}><td colSpan={5}>Jumlah</td><td>Rp {rupiah(total)}</td><td></td></tr>
    </tbody></table>
    <p className={styles.words}>{terbilang(total)}</p><div className={styles.receiptDate}>Kajen, {date(issued)}</div>
    <div className={styles.receiptSigns}>
     <div><b>Mengetahui:</b><b>Kuasa Pengguna Anggaran</b><span>{sectionName}</span><div className={styles.receiptSignGap}/><b className={styles.underlined}>{kpa.name}</b><span>NIP. {kpa.nip||"—"}</span></div>
     <div><b>&nbsp;</b><b>PPTK</b><span>&nbsp;</span><div className={styles.receiptSignGap}/><b className={styles.underlined}>{pptk.name}</b><span>NIP. {pptk.nip||"—"}</span></div>
     <div><b>&nbsp;</b><b>Bendahara Pengeluaran Pembantu</b><span>{sectionName}</span><div className={styles.receiptSignGap}/><b className={styles.underlined}>{bpp.name}</b><span>NIP. {bpp.nip||"—"}</span></div>
    </div>
   </section>}
  </>}
  {type==="lampiran"&&<Annex people={people} number={number} issued={issued} title="LAMPIRAN DAFTAR PESERTA PERJALANAN DINAS"/>}
 </main>;
}
