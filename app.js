

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const URL="https://yxcroppwpjnxdgugjtqk.supabase.co";
const KEY="sb_publishable_ZQX9XkOOCO2qK9NkdpKItw_pZ7qatLp";
const sb=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let profile=null;
const mainView=document.querySelector(".main");
const dashboardMarkup=mainView.innerHTML;
const pageInfo={
  bagian:["Data Bagian","Kelola unit/bagian di lingkungan Sekretariat Daerah."],
  pegawai:["Data Pegawai","Kelola identitas, NIP, status kepegawaian, pangkat, dan jabatan pegawai."],
  master:["Data Master","Kelola referensi pangkat/golongan dan jenis jabatan."],
  pejabat:["Pejabat Penandatangan","Atur penandatangan SP dan SPPD atas nama Sekretaris Daerah."],
  pengelola_pa:["Pengaturan PA / KPA","Tetapkan PA dan KPA, termasuk penugasan Plt./Plh."],
  pengelola_pptk:["Pengaturan PPTK","Tetapkan PPTK per kegiatan/subkegiatan, termasuk penugasan Plt./Plh."],
  pengelola_bendahara:["Pengaturan Bendahara Pengeluaran","Tetapkan Bendahara Pengeluaran dan Bendahara Pengeluaran Pembantu, termasuk penugasan Plt./Plh."],
  anggaran:["Kegiatan & Anggaran","Kelola subkegiatan, rekening belanja, pagu, dan perubahan anggaran."],
  perjalanan:["Perjalanan Dinas","Kelola pengajuan, peserta, tujuan, jadwal, dan status perjalanan dinas."],
  dokumen:["Dokumen & Arsip","Kelola dokumen Surat Perintah, SPPD, lampiran, dan arsip perjalanan."],
  laporan:["Laporan","Lihat rekapitulasi perjalanan dinas dan penggunaan anggaran."],
  akun:["Manajemen Akun","Kelola akun pengguna, peran, dan status akses aplikasi."]
};
function esc(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function field(label,name,value="",type="text",required=true){return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${required?"required":""}></label>`;}
function selectField(label,name,items,value=""){return `<label class="field"><span>${label}</span><select name="${name}" required><option value="">Pilih ${label}</option>${items.map(x=>`<option value="${esc(x.id)}" ${x.id===value?"selected":""}>${esc(x.label)}</option>`).join("")}</select></label>`;}
let editState={};
async function fetchRows(table){const {data,error}=await sb.from(table).select("*").order("created_at",{ascending:false});if(error)throw error;return data||[];}
async function pageError(error){const el=document.getElementById("pageMessage");if(el){el.textContent=error.message||String(error);el.style.display="block";}}
function fmtDate(v){if(!v)return "—";return new Date(v+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});}
async function openTripDocumentPreview(tripId,kind){
 const html=await buildTripDocumentHtml(tripId,kind);
 let modal=document.getElementById("documentPreviewModal");
 if(!modal){modal=document.createElement("div");modal.id="documentPreviewModal";modal.className="document-preview-modal";document.body.appendChild(modal);}
 const title=kind==="sp"?"Preview Surat Perintah":"Preview SPPD";
 modal.innerHTML='<section class="document-preview-window"><header class="document-preview-header"><div><b>'+title+'</b><small>Periksa dokumen sebelum mencetak atau menyimpan PDF</small></div><div class="document-preview-actions"><button type="button" class="btn" data-print-preview>Cetak / Simpan PDF</button><button type="button" class="btn preview-close" data-close-doc-preview>Tutup</button></div></header><iframe title="'+title+'" class="document-preview-frame"></iframe></section>';
 const frame=modal.querySelector("iframe");frame.srcdoc=html;modal.style.display="flex";
 modal.querySelector("[data-close-doc-preview]").addEventListener("click",()=>modal.remove());
 modal.addEventListener("click",ev=>{if(ev.target===modal)modal.remove();});
 modal.querySelector("[data-print-preview]").addEventListener("click",()=>{frame.contentWindow.focus();frame.contentWindow.print();});
}
async function buildTripDocumentHtml(tripId,kind){
 const trip=(window._sppdRows?.perjalanan_dinas||[]).find(x=>x.id===tripId);if(!trip)throw new Error("Data perjalanan tidak ditemukan.");
 const [{data:parts,error:pe},{data:activity,error:ae},{data:budget,error:be},{data:signs,error:se}]=await Promise.all([
  sb.from("perjalanan_peserta").select("*").eq("perjalanan_id",tripId).order("created_at"),
  sb.from("kegiatan").select("*").eq("id",trip.kegiatan_id).maybeSingle(),
  sb.from("anggaran").select("*").eq("id",trip.anggaran_id).maybeSingle(),
  sb.from("pejabat_dokumen").select("*").eq("aktif",true).eq("jenis_peran",kind==="sp"?"penandatangan_sp":"ppk_sppd")
 ]);
 if(pe)throw pe;if(ae)throw ae;if(be)throw be;if(se)throw se;if(!parts?.length)throw new Error("Tambahkan peserta sebelum mencetak dokumen.");
 const storedId=kind==="sp"?trip.penandatangan_sp_id:trip.ppk_sppd_id;
 let sign=storedId?await (async()=>{const z=await sb.from("pejabat_dokumen").select("*").eq("id",storedId).maybeSingle();if(z.error)throw z.error;return z.data;})():signs?.[0];
 if(!sign)throw new Error("Pejabat penandatangan dokumen ini belum diatur. Atur terlebih dahulu pada menu Pejabat Penandatangan, lalu buat ulang draf perjalanan.");
 const q=await sb.from("pegawai").select("*").eq("id",sign.pegawai_id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("Data pejabat penandatangan tidak ditemukan.");
 const signer=q.data,signerName=(kind==="sp"?trip.penandatangan_sp_nama_snapshot:trip.ppk_sppd_nama_snapshot)||signer.nama,signerJob=(kind==="sp"?trip.penandatangan_sp_jabatan_snapshot:trip.ppk_sppd_jabatan_snapshot)||sign.jabatan_dokumen,escp=v=>String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const people=parts.map((p,i)=>({no:i+1,name:p.nama_snapshot||"—",nip:p.nip_snapshot||"—",rank:p.pangkat_snapshot||"—",job:p.jabatan_snapshot||"—"}));
 const range=fmtDate(trip.tanggal_berangkat)+" s.d. "+fmtDate(trip.tanggal_kembali),dest=escp(trip.tempat_tujuan)+(trip.provinsi_tujuan?", "+escp(trip.provinsi_tujuan):"");
 const peopleRows=people.map(p=>'<tr><td>'+p.no+'.</td><td>'+escp(p.name)+'</td><td>'+escp(p.nip)+'</td><td>'+escp(p.rank)+'</td><td>'+escp(p.job)+'</td></tr>').join("");
 const isSekda=String(signer.jabatan||"").trim().toLowerCase()==="sekretaris daerah";
 const signClause=isSekda?"":"a.n. SEKRETARIS DAERAH<br>";
 const signJob=isSekda?"SEKRETARIS DAERAH":(signerJob||signer.nomenklatur_jabatan||signer.jabatan||"Pejabat yang ditunjuk");
 const signBlock='<div class="sign"><div>Kajen, '+fmtDate(new Date().toISOString().slice(0,10))+'</div><div>'+signClause+escp(signJob)+'<div class="space"></div><b><u>'+escp(signerName)+'</u></b><br>NIP. '+escp(signer.nip||"—")+'</div></div>';
 const tugas='<section class="sheet"><header><b>PEMERINTAH KABUPATEN PEKALONGAN</b><br><b>SEKRETARIAT DAERAH</b><p>Jalan Alun-alun Utara Nomor 1 Kajen Pekalongan, Kode Pos 51161, Telepon (0285) 381000,<br>Faksimile (0285) 381006, Laman setda.pekalongankab.go.id, Pos-el setda@pekalongankab.go.id</p></header><h2>SURAT TUGAS</h2><p>Nomor : __________________________</p><p>Yang bertanda tangan di bawah ini:</p><table class="plain"><tr><td width="22%">Nama</td><td>:</td><td>'+escp(signerName)+'</td></tr><tr><td>Jabatan</td><td>:</td><td>'+escp(signerJob)+'</td></tr></table><h3>MEMERINTAHKAN</h3><p>Kepada:</p><table class="people"><thead><tr><th>No.</th><th>Nama</th><th>NIP</th><th>Pangkat/Gol.</th><th>Jabatan</th></tr></thead><tbody>'+peopleRows+'</tbody></table><p style="margin-top:20px">Untuk : '+escp(trip.maksud_perjalanan)+'</p><table class="plain"><tr><td width="22%">Hari/Tanggal</td><td>:</td><td>'+escp(range)+'</td></tr><tr><td>Tempat</td><td>:</td><td>'+dest+'</td></tr></table><p style="margin-top:22px">Demikian Surat Tugas ini dibuat untuk dapat dilaksanakan dengan sebaik-baiknya dan penuh tanggung jawab.</p>'+signBlock+'</section>';
 const days=trip.tanggal_berangkat&&trip.tanggal_kembali?Math.max(1,Math.round((new Date(trip.tanggal_kembali)-new Date(trip.tanggal_berangkat))/86400000)+1)+" hari":"—";
 const spd='<section class="sheet"><header><b>PEMERINTAH KABUPATEN PEKALONGAN</b><br><b>SEKRETARIAT DAERAH</b><p>Jalan Alun-alun Utara Nomor 1 Kajen Pekalongan, Kode Pos 51161, Telepon (0285) 381000,<br>Faksimile (0285) 381006, Laman setda.pekalongankab.go.id, Pos-el setda@pekalongankab.go.id</p></header><h2>SURAT PERJALANAN DINAS (SPD)</h2><table class="spd"><tr><td>1.</td><td>Pejabat Pembuat Komitmen</td><td>:</td><td>'+escp(signerName)+'<br>'+escp(signerJob)+'</td></tr><tr><td>2.</td><td>Nama/NIP Pegawai yang melaksanakan perjalanan dinas</td><td>:</td><td>'+people.map(p=>escp(p.name)+" / "+escp(p.nip)).join("<br>")+'</td></tr><tr><td>3.</td><td>a. Pangkat dan Golongan<br>b. Jabatan/Instansi<br>c. Tingkat Biaya Perjalanan Dinas</td><td>:</td><td>'+people.map(p=>escp(p.rank)+"<br>"+escp(p.job)).join("<br>")+'<br>—</td></tr><tr><td>4.</td><td>Maksud perjalanan dinas</td><td>:</td><td>'+escp(trip.maksud_perjalanan)+'</td></tr><tr><td>5.</td><td>Alat angkut yang dipergunakan</td><td>:</td><td>'+escp(trip.alat_angkut||"Kendaraan Dinas")+'</td></tr><tr><td>6.</td><td>a. Tempat Berangkat<br>b. Tempat Tujuan</td><td>:</td><td>'+escp(trip.tempat_berangkat||"Kajen")+'<br>'+dest+'</td></tr><tr><td>7.</td><td>a. Lamanya Perjalanan Dinas<br>b. Tanggal berangkat<br>c. Tanggal harus kembali</td><td>:</td><td>'+days+'<br>'+fmtDate(trip.tanggal_berangkat)+'<br>'+fmtDate(trip.tanggal_kembali)+'</td></tr><tr><td>8.</td><td>Pengikut</td><td>:</td><td>'+people.map(p=>p.no+". "+escp(p.name)).join("<br>")+'</td></tr><tr><td>9.</td><td>Pembebanan Anggaran<br>a. Instansi<br>b. Akun</td><td>:</td><td>Setda Kabupaten Pekalongan<br>'+escp(activity?.nama_subkegiatan||"—")+'<br>'+escp(budget?.nama_rekening||budget?.uraian||"—")+'</td></tr><tr><td>10.</td><td>Keterangan Lain-Lain</td><td>:</td><td>—</td></tr></table>'+signBlock+'</section>';
 const html='<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Cetak '+(kind==="sp"?"Surat Tugas":"SPPD")+'</title><style>@page{size:A4 portrait;margin:18mm}*{box-sizing:border-box}body{font:11pt "Times New Roman",serif;color:#000;margin:0}.sheet{page-break-after:always;min-height:260mm}.sheet:last-child{page-break-after:auto}header{text-align:center;border-bottom:3px double #000;padding-bottom:7px;line-height:1.25}header p{font-size:9pt;margin:5px 0 0}h2{text-align:center;text-decoration:underline;font-size:13pt;margin:22px 0 12px}h3{text-align:center;margin:22px 0 12px;font-size:11pt}.plain,.people,.spd{width:100%;border-collapse:collapse}.plain td{padding:3px 5px;vertical-align:top}.people th,.people td,.spd td{border:1px solid #000;padding:6px;vertical-align:top}.people th{text-align:center}.spd td:first-child{width:7%;text-align:center}.spd td:nth-child(2){width:36%}.spd td:nth-child(3){width:4%;text-align:center}.sign{display:grid;grid-template-columns:1fr 1fr;text-align:center;margin:25px 0 0 48%;line-height:1.45}.space{height:60px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>'+(kind==="sp"?tugas:spd)+'</body></html>';
 return html;
}
async function openTripDetailPage(tripId){
 const trip=(window._sppdRows?.perjalanan_dinas||[]).find(x=>x.id===tripId)||await (async()=>{const q=await sb.from("perjalanan_dinas").select("*").eq("id",tripId).single();if(q.error)throw q.error;return q.data;})();
 const [{data:parts,error:pe},{data:pegawai,error:pg},{data:kegiatan,error:ke},{data:anggaran,error:ae}]=await Promise.all([
  sb.from("perjalanan_peserta").select("*").eq("perjalanan_id",tripId).order("created_at"),
  sb.from("pegawai").select("*").eq("aktif",true).order("nama"),
  sb.from("kegiatan").select("*").eq("id",trip.kegiatan_id).maybeSingle(),
  sb.from("anggaran").select("*").eq("id",trip.anggaran_id).maybeSingle()
 ]);
 if(pe)throw pe;if(pg)throw pg;if(ke)throw ke;if(ae)throw ae;
 window._tripDetailId=tripId;window._tripDetailRows=parts||[];window._tripDetailPegawai=pegawai||[];
 const assigned=new Set((parts||[]).map(p=>p.pegawai_id));
 const available=(pegawai||[]).filter(p=>!assigned.has(p.id));
 const info=[["Tujuan",trip.tempat_tujuan],["Maksud",trip.maksud_perjalanan],["Jadwal",trip.tanggal_berangkat+" s.d. "+trip.tanggal_kembali],["Kegiatan",kegiatan?.nama_subkegiatan],["Pos Anggaran",anggaran?.nama_rekening||anggaran?.uraian],["Status",trip.status]];
 mainView.innerHTML='<div class="crumb">Beranda / Perjalanan Dinas / Detail</div><div class="heading"><div><h1>Detail Perjalanan Dinas</h1><p>Kelola informasi perjalanan dan pilih seluruh peserta dalam satu proses.</p></div><button class="btn" type="button" data-back-trip>← Kembali ke Perjalanan</button></div><section class="panel"><h3>Aksi Perjalanan</h3><div class="trip-management-grid"><button type="button" class="trip-management-card" data-detail-page-action="sp"><b>Surat Perintah</b><span>Preview dan cetak / simpan PDF</span></button><button type="button" class="trip-management-card" data-detail-page-action="sppd"><b>SPPD</b><span>Preview dan cetak / simpan PDF</span></button><button type="button" class="trip-management-card" data-detail-page-action="edit"><b>Ubah Data Perjalanan</b><span>Perbarui data perjalanan</span></button><button type="button" class="trip-management-card trip-management-danger" data-detail-page-action="delete"><b>Hapus Perjalanan</b><span>Hapus data perjalanan ini</span></button></div></section><section class="panel"><h3>Informasi Perjalanan</h3><div class="tablewrap"><table><tbody>'+info.map(([k,v])=>'<tr><th style="text-align:left;width:25%">'+esc(k)+'</th><td>'+esc(v||"—")+'</td></tr>').join("")+'</tbody></table></div></section><section class="panel"><h3>Peserta Perjalanan ('+(parts||[]).length+')</h3><p class="muted">Pilih satu atau beberapa pegawai sekaligus. Tidak dibatasi dua orang.</p><form id="tripParticipantsForm"><label class="field"><span>Pilih Pegawai (bisa lebih dari satu)</span><select name="pegawai_ids" multiple size="9" style="min-height:220px">'+available.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nama)+' · '+esc(p.nip||"Tanpa NIP")+'</option>').join("")+'</select></label><p class="muted">Gunakan Ctrl (Windows) atau Cmd (Mac) untuk memilih beberapa nama. Pada perangkat sentuh, ketuk nama yang diperlukan.</p><button class="btn" type="submit" '+(!available.length?'disabled':'')+'>Tambahkan Peserta Terpilih</button><div id="tripParticipantMessage" class="notice" style="display:none"></div></form><div class="tablewrap" style="margin-top:18px"><table><thead><tr><th>Nama</th><th>NIP</th><th>Pangkat</th><th>Jabatan</th><th>Aksi</th></tr></thead><tbody>'+(parts||[]).map(p=>'<tr><td>'+esc(p.nama_snapshot||"—")+'</td><td>'+esc(p.nip_snapshot||"—")+'</td><td>'+esc(p.pangkat_snapshot||"—")+'</td><td>'+esc(p.jabatan_snapshot||"—")+'</td><td><button class="btn" type="button" data-remove-trip-participant="'+esc(p.id)+'">Hapus</button></td></tr>').join("")||'<tr><td colspan="5">Belum ada peserta.</td></tr>'+'</tbody></table></div></section>';
 mainView.querySelectorAll("[data-detail-page-action]").forEach(btn=>btn.addEventListener("click",async()=>{
  const type=btn.dataset.detailPageAction;
  if(type==="sp"||type==="sppd"){btn.disabled=true;try{await openTripDocumentPreview(tripId,type);}catch(e){alert("Preview gagal dibuka: "+(e.message||e));}finally{btn.disabled=false;}return;}
  if(type==="edit"){const proxy=document.createElement("button");proxy.type="button";proxy.dataset.editTravel=tripId;mainView.appendChild(proxy);proxy.click();proxy.remove();return;}
  if(type==="delete"){const proxy=document.createElement("button");proxy.type="button";proxy.dataset.deleteTravel=tripId;mainView.appendChild(proxy);proxy.click();proxy.remove();}
 }));
 const form=document.getElementById("tripParticipantsForm");
 form.addEventListener("submit",async ev=>{
  ev.preventDefault();const ids=Array.from(form.elements.pegawai_ids.selectedOptions).map(o=>o.value);
  const msg=document.getElementById("tripParticipantMessage");
  if(!ids.length){msg.textContent="Pilih minimal satu pegawai.";msg.style.display="block";return;}
  const btn=form.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
   const current=window._tripDetailRows||[];const already=new Set(current.map(p=>p.pegawai_id));
   const chosen=ids.filter(id=>!already.has(id));if(!chosen.length)throw new Error("Pegawai yang dipilih sudah menjadi peserta.");
   const people=window._tripDetailPegawai||[];
   const payload=chosen.map(id=>{const p=people.find(x=>x.id===id);return {perjalanan_id:tripId,pegawai_id:p.id,nama_snapshot:p.nama,nip_snapshot:p.nip||null,pangkat_snapshot:p.pangkat_golongan||null,jabatan_snapshot:p.jabatan==="Sekretaris Daerah"?"Sekretaris Daerah":[p.jabatan,p.nomenklatur_jabatan].filter(Boolean).join(" ")||null};});
   const q=await sb.from("perjalanan_peserta").insert(payload);if(q.error)throw q.error;
   await openTripDetailPage(tripId);
  }catch(e){msg.textContent="Gagal menambahkan peserta: "+(e.message||e);msg.style.display="block";btn.disabled=false;btn.textContent="Tambahkan Peserta Terpilih";}
 });
 mainView.querySelectorAll("[data-remove-trip-participant]").forEach(btn=>btn.addEventListener("click",async()=>{
  if(!confirm("Hapus peserta ini dari perjalanan?"))return;
  btn.disabled=true;const q=await sb.from("perjalanan_peserta").delete().eq("id",btn.dataset.removeTripParticipant);
  if(q.error){alert("Gagal menghapus peserta: "+q.error.message);btn.disabled=false;return;}
  await openTripDetailPage(tripId);
 }));
 mainView.querySelector("[data-back-trip]").addEventListener("click",()=>loadPage("perjalanan"));
}
async function loadPage(page){
 const info=pageInfo[page]; if(!info)return;
 mainView.innerHTML=`<div class="crumb">Beranda / ${info[0]}</div><div class="heading"><div><h1>${info[0]}</h1><p>${info[1]}</p></div><div class="date">Tahun Anggaran 2026</div></div><div id="pageMessage" class="notice" style="display:none"></div><div id="pageContent" class="panel">Memuat data...</div>`;
 const host=document.getElementById("pageContent");
 try{
  if(page==="bagian"){
   const rows=await fetchRows("bagian");window._sppdRows={...(window._sppdRows||{}),bagian:rows};
   host.innerHTML=`<h3>Tambah / Ubah Bagian</h3><form id="dataForm" data-table="bagian"><input type="hidden" name="id"><div class="grid" style="grid-template-columns:1fr 1fr">${field("Nama Bagian","nama_bagian")}${field("Nama Instansi","nama_instansi","Sekretariat Daerah")}</div><label class="field"><span>Status</span><select name="aktif"><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label><button class="btn" type="submit">Simpan Bagian</button> <button class="btn" type="button" data-reset>Form Baru</button></form><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>Daftar Bagian (${rows.length})</h3><div class="tablewrap"><table><thead><tr><th>Nama Bagian</th><th>Instansi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.nama_bagian)}</td><td>${esc(r.nama_instansi||"-")}</td><td>${r.aktif?"Aktif":"Nonaktif"}</td><td><button class="btn" type="button" data-edit="${r.id}">Ubah</button> <button class="btn" type="button" data-delete="${r.id}">Hapus</button></td></tr>`).join("")||'<tr><td colspan="4">Belum ada data bagian.</td></tr>'}</tbody></table></div>`;
  }else if(page==="master"){
   const [pangkat,jabatan]=await Promise.all([fetchRows("master_pangkat_golongan"),fetchRows("master_jabatan")]);
   window._sppdRows={...(window._sppdRows||{}),master_pangkat_golongan:pangkat,master_jabatan:jabatan};
   host.innerHTML=`<h3>Master Pangkat / Golongan</h3><form data-table="master_pangkat_golongan"><div class="grid"><label class="field"><span>Nama Pangkat / Golongan</span><input name="nama" required placeholder="Contoh: Penata (III/c)"></label><label class="field"><span>Urutan</span><input name="urutan" type="number" value="0"></label></div><button class="btn" type="submit">Tambah Pangkat / Golongan</button></form><div class="tablewrap"><table><thead><tr><th>Nama</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${pangkat.map(x=>`<tr><td>${esc(x.nama)}</td><td>${x.aktif?"Aktif":"Nonaktif"}</td><td><button class="btn" type="button" data-delete-master="master_pangkat_golongan" data-id="${x.id}">Hapus</button></td></tr>`).join("")||'<tr><td colspan="3">Master belum diisi.</td></tr>'}</tbody></table></div>
   <hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>Master Jabatan</h3><form data-table="master_jabatan"><div class="grid"><label class="field"><span>Nama Jabatan</span><input name="nama" required placeholder="Contoh: Analis Kebijakan Ahli Muda"></label><label class="field"><span>Urutan</span><input name="urutan" type="number" value="0"></label></div><button class="btn" type="submit">Tambah Jabatan</button></form><div class="tablewrap"><table><thead><tr><th>Nama</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${jabatan.map(x=>`<tr><td>${esc(x.nama)}</td><td>${x.aktif?"Aktif":"Nonaktif"}</td><td><button class="btn" type="button" data-delete-master="master_jabatan" data-id="${x.id}">Hapus</button></td></tr>`).join("")||'<tr><td colspan="3">Master belum diisi.</td></tr>'}</tbody></table></div>`;

  }else if(["pengelola_pa","pengelola_pptk","pengelola_bendahara"].includes(page)){
   const [rows,pegawai,bagian,kegiatan,masterJabatan,penugasanKegiatan]=await Promise.all([fetchRows("pejabat_pengelola"),fetchRows("pegawai"),fetchRows("bagian"),fetchRows("kegiatan"),fetchRows("master_jabatan"),fetchRows("pejabat_pengelola_kegiatan")]);
   window._sppdRows={...(window._sppdRows||{}),pejabat_pengelola:rows,pegawai,bagian,kegiatan,master_jabatan:masterJabatan,pejabat_pengelola_kegiatan:penugasanKegiatan};
   const allRoleLabels={"PA":"Pengguna Anggaran (PA)","KPA":"Kuasa Pengguna Anggaran (KPA)","PPTK":"Pejabat Pelaksana Teknis Kegiatan (PPTK)","Bendahara Pengeluaran":"Bendahara Pengeluaran","Bendahara Pengeluaran Pembantu":"Bendahara Pengeluaran Pembantu"};
   const pageRoles=page==="pengelola_pa"?["PA","KPA"]:page==="pengelola_pptk"?["PPTK"]:["Bendahara Pengeluaran","Bendahara Pengeluaran Pembantu"];
   const roleLabels=Object.fromEntries(pageRoles.map(k=>[k,allRoleLabels[k]]));
   const isEselonIIorIII=p=>{const m=masterJabatan.find(x=>x.nama===p?.jabatan);const e=String(m?.eselon||"").toUpperCase();return e.startsWith("II.")||e.startsWith("III.");};
   const people=pegawai.filter(p=>p.aktif&&(page!=="pengelola_pa"||isEselonIIorIII(p))).map(p=>({id:p.id,label:p.nama+" · "+[p.nip,p.jabatan,p.nomenklatur_jabatan].filter(Boolean).join(" · ")}));
   const bOpts=bagian.filter(x=>x.aktif).map(x=>({id:x.id,label:x.nama_bagian}));
   const kOpts=kegiatan.filter(x=>x.aktif).map(x=>({id:x.id,label:[x.kode_subkegiatan,x.nama_subkegiatan,x.tahun_anggaran].filter(Boolean).join(" · ")}));
   const scope=x=>x.jenis_peran==="PPTK"?penugasanKegiatan.filter(a=>a.pejabat_pengelola_id===x.id).map(a=>{const k=kegiatan.find(k=>k.id===a.kegiatan_id);return k?[k.kode_subkegiatan,k.nama_subkegiatan].filter(Boolean).join(" · "):"Sub kegiatan tidak ditemukan";}).join("; ")||"Belum ada kegiatan":(x.bagian_id?(bagian.find(b=>b.id===x.bagian_id)?.nama_bagian||"Bagian tidak ditemukan"):"Sekretariat Daerah");
   host.innerHTML='<div class="panel" style="padding:20px;margin-bottom:20px"><h3>Tambah / Ubah Penetapan Pejabat</h3><form data-table="pejabat_pengelola"><input type="hidden" name="id"><div class="grid" style="grid-template-columns:1fr 1fr">'+selectField("Jenis Penugasan","jenis_peran",pageRoles.map(id=>({id,label:roleLabels[id]})))+selectField("Nama Pegawai","pegawai_id",people)+'</div><div class="grid" style="grid-template-columns:1fr 1fr"><label class="field" id="pengelolaBagianField"><span>Bagian / Unit Kerja</span><select name="bagian_id"><option value="">Pilih Bagian</option>'+bOpts.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+'</option>').join("")+'</select></label><label class="field" id="pengelolaKegiatanField"><span>Kegiatan / Sub Kegiatan (dapat memilih lebih dari satu)</span><select name="kegiatan_ids" multiple size="6" style="min-height:145px;padding:9px">'+kOpts.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+'</option>').join("")+'</select><small class="muted">Gunakan Ctrl (komputer) atau pilih beberapa item pada perangkat yang mendukung multi-select.</small></label>'+selectField("Status Penugasan","status_penugasan",[{id:"definitif",label:"Definitif"},{id:"plt",label:"Plt. (Pelaksana Tugas)"},{id:"plh",label:"Plh. (Pelaksana Harian)"}])+'</div><div class="grid" style="grid-template-columns:1fr 1fr">'+'</div>'+'<input type="hidden" name="aktif" value="true"><button class="btn" type="submit">Simpan Penetapan</button> <button class="btn" type="button" data-reset>Form Baru</button></form><p class="muted">PA dan Bendahara Pengeluaran berlaku pada tingkat Sekretariat Daerah. KPA dan Bendahara Pengeluaran Pembantu per Bagian. PPTK ditetapkan untuk setiap sub kegiatan. Penetapan Plt./Plh. dicatat berdasarkan status penugasan.</p></div><h3>Riwayat Penetapan ('+rows.length+')</h3><div class="tablewrap"><table><thead><tr><th>Peran</th><th>Nama / NIP</th><th>Lingkup</th><th>Status</th><th>Kondisi</th><th>Aksi</th></tr></thead><tbody>'+rows.map(x=>{const p=pegawai.find(y=>y.id===x.pegawai_id);return '<tr><td>'+esc(roleLabels[x.jenis_peran]||x.jenis_peran)+'</td><td>'+esc(p?.nama||"-")+'<br><small>'+esc(p?.nip||"")+'</small></td><td>'+esc(scope(x))+'</td><td>'+({definitif:"Definitif",plt:"Plt.",plh:"Plh."}[x.status_penugasan]||x.status_penugasan)+'</td><td>'+(x.aktif?"Aktif":"Nonaktif")+'</td><td><button class="btn" type="button" data-edit="'+x.id+'">Ubah</button> '+(x.aktif?'<button class="btn" type="button" data-inactive-pejabat="'+x.id+'">Akhiri</button>':'')+'</td></tr>';}).join("")+'</tbody></table></div>';
   const f=host.querySelector('form[data-table="pejabat_pengelola"]'),role=f.elements.namedItem("jenis_peran"),bf=host.querySelector("#pengelolaBagianField"),kf=host.querySelector("#pengelolaKegiatanField"),bs=f.elements.namedItem("bagian_id"),ks=f.elements.namedItem("kegiatan_ids");
   const sync=()=>{const v=role.value,nb=["KPA","Bendahara Pengeluaran Pembantu"].includes(v),nk=v==="PPTK";bf.style.display=nb?"block":"none";kf.style.display=nk?"block":"none";bs.required=nb;ks.required=nk;if(!nb)bs.value="";if(!nk)Array.from(ks.options).forEach(o=>o.selected=false);};role.addEventListener("change",sync);sync();
  }else if(page==="pejabat"){
   const [pegawai,pejabat,masterJabatan]=await Promise.all([fetchRows("pegawai"),fetchRows("pejabat_dokumen"),fetchRows("master_jabatan")]);
   window._sppdRows={...(window._sppdRows||{}),pegawai,pejabat_dokumen:pejabat,master_jabatan:masterJabatan};
   const eligible=pegawai.filter(p=>{
    if(!p.aktif)return false;
    const master=masterJabatan.find(m=>m.nama===p.jabatan);
    const eselon=String(master?.eselon||"").toUpperCase();
    const title=[p.jabatan,p.nomenklatur_jabatan].filter(Boolean).join(" ");
    return eselon.startsWith("II.")||eselon.startsWith("III.")||/\bKPA\b/i.test(title);
   });
   const options=eligible.map(p=>({id:p.id,label:p.nama+" · "+[p.jabatan,p.nomenklatur_jabatan].filter(Boolean).join(" ")}));
   const roles={penandatangan_sp:"Penandatangan SP",ppk_sppd:"Penandatangan SPPD"};
   host.innerHTML=`<div class="panel" style="padding:20px;margin-bottom:20px"><h3>Pengaturan Pejabat Penandatangan</h3><p class="muted">Pejabat SP dan SPPD dapat berbeda. Keduanya bertindak <b>a.n. Sekretaris Daerah</b>. Pilihan nama pegawai mencakup pejabat dengan eselon II dan III, serta pegawai yang nomenklatur jabatannya memuat KPA.</p><form data-table="pejabat_dokumen"><div class="grid" style="grid-template-columns:1fr 1fr"><label class="field"><span>Dokumen</span><select name="jenis_peran" required><option value="">Pilih jenis dokumen</option><option value="penandatangan_sp">Surat Perintah (SP)</option><option value="ppk_sppd">Surat Perjalanan Dinas (SPPD)</option></select></label>${selectField("Pejabat (Eselon II / III atau KPA)","pegawai_id",options)}<label class="field"><span>Jabatan dalam Dokumen</span><input name="jabatan_dokumen" required placeholder="Contoh: Kepala Bagian Umum"></label></div><input type="hidden" name="aktif" value="true"><button class="btn" type="submit">Simpan Penandatangan</button></form><p class="muted" style="margin-top:12px">Kualifikasi eselon II dan III ditentukan dari pemetaan Data Master Jabatan. Penetapan KPA harus tercermin pada nomenklatur jabatan pegawai.</p></div><h3>Penandatangan Aktif</h3><div class="tablewrap"><table><thead><tr><th>Dokumen</th><th>Nama</th><th>Jabatan</th><th>Klausul</th><th>Aksi</th></tr></thead><tbody>${pejabat.filter(x=>x.aktif).map(x=>{const p=pegawai.find(y=>y.id===x.pegawai_id);return `<tr><td>${roles[x.jenis_peran]||esc(x.jenis_peran)}</td><td>${esc(p?.nama||"-")}</td><td>${esc(x.jabatan_dokumen)}</td><td>${p?.jabatan==="Sekretaris Daerah"?"Sekretaris Daerah":"a.n. Sekretaris Daerah"}</td><td><button class="btn" type="button" data-delete-master="pejabat_dokumen" data-id="${x.id}">Hapus</button></td></tr>`;}).join("")||'<tr><td colspan="5">Belum ada pejabat yang ditetapkan.</td></tr>'}</tbody></table></div>`;
  }else if(page==="pegawai"){
   const [rows,bagian,pangkat,jabatan]=await Promise.all([fetchRows("pegawai"),fetchRows("bagian"),fetchRows("master_pangkat_golongan"),fetchRows("master_jabatan")]);
   window._sppdRows={...(window._sppdRows||{}),pegawai:rows,master_pangkat_golongan:pangkat,master_jabatan:jabatan};
   host.innerHTML=`<h3>Tambah / Ubah Pegawai</h3><form id="dataForm" data-table="pegawai"><input type="hidden" name="id"><div class="grid" style="grid-template-columns:1fr 1fr">${field("Nama Pegawai","nama")}${field("NIP","nip","", "text",false)}${selectField("Bagian","bagian_id",bagian.map(x=>({id:x.id,label:x.nama_bagian})))}${selectField("Status Kepegawaian","status_kepegawaian",["PNS","PPPK","NON_ASN","LAINNYA"].map(x=>({id:x,label:x})))}${selectField("Pangkat / Golongan","pangkat_golongan",[...pangkat.filter(x=>x.aktif).map(x=>({id:x.nama,label:x.nama})),...([...new Set(rows.map(x=>x.pangkat_golongan).filter(Boolean))].filter(v=>!pangkat.some(x=>x.nama===v)).map(v=>({id:v,label:v+" (data lama)"})))])}${selectField("Jenis Jabatan","jabatan",jabatan.filter(x=>x.aktif).map(x=>({id:x.nama,label:x.nama})))}${field("Nomenklatur Jabatan","nomenklatur_jabatan","","text",false)}${field("Instansi","instansi","Sekretariat Daerah","text",false)}</div><label class="field"><span>Status</span><select name="aktif"><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label><button class="btn" type="submit">Simpan Pegawai</button> <button class="btn" type="button" data-reset>Form Baru</button></form><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>Daftar Pegawai (${rows.length})</h3><div class="tablewrap"><table><thead><tr><th>Nama</th><th>NIP</th><th>Bagian</th><th>Pangkat / Golongan</th><th>Jabatan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.nama)}</td><td>${esc(r.nip||"-")}</td><td>${esc(bagian.find(x=>x.id===r.bagian_id)?.nama_bagian||"-")}</td><td>${esc(r.pangkat_golongan||"-")}</td><td>${esc(r.jabatan==="Sekretaris Daerah"?"Sekretaris Daerah":[r.jabatan,r.nomenklatur_jabatan].filter(Boolean).join(" "))}</td><td>${esc(r.status_kepegawaian)} · ${r.aktif?"Aktif":"Nonaktif"}</td><td><button class="btn" type="button" data-edit="${r.id}">Ubah</button> <button class="btn" type="button" data-delete="${r.id}">Hapus</button></td></tr>`).join("")||'<tr><td colspan="7">Belum ada data pegawai.</td></tr>'}</tbody></table></div>`;

   const jabatanSelect=host.querySelector('[name="jabatan"]');
   const nomenklaturField=host.querySelector('[name="nomenklatur_jabatan"]')?.closest(".field");
   const nomenklaturInput=host.querySelector('[name="nomenklatur_jabatan"]');
   const syncNomenklatur=()=>{const isSekda=jabatanSelect?.value==="Sekretaris Daerah";if(nomenklaturField)nomenklaturField.style.display=isSekda?"none":"block";if(nomenklaturInput){nomenklaturInput.required=!isSekda;if(isSekda)nomenklaturInput.value="";}};
   jabatanSelect?.addEventListener("change",syncNomenklatur);syncNomenklatur();


  }else if(page==="perjalanan"){
   const [rows,kegiatan,anggaran,pegawai]=await Promise.all([fetchRows("perjalanan_dinas"),fetchRows("kegiatan"),fetchRows("anggaran"),fetchRows("pegawai")]);
   window._sppdRows={...(window._sppdRows||{}),perjalanan_dinas:rows,kegiatan,anggaran,pegawai};
   const selected=window._selectedTripId||rows[0]?.id||"";window._selectedTripId=selected;
   const pr=selected?await sb.from("perjalanan_peserta").select("*").eq("perjalanan_id",selected):{data:[],error:null};if(pr.error)throw pr.error;
   const tripRows=rows.map(r=>'<tr><td><b>'+esc(r.tempat_tujuan)+'</b><br><small>'+esc(r.maksud_perjalanan)+'</small></td><td>'+esc(r.tanggal_berangkat)+' – '+esc(r.tanggal_kembali)+'</td><td>'+esc(r.status)+'</td><td class="trip-action-cell"><button class="btn" type="button" data-detail-trip="'+r.id+'">Detail &amp; Kelola</button></td></tr>').join("");
   const pesertaRows=(pr.data||[]).map(p=>'<tr><td>'+esc(p.nama_snapshot||pegawai.find(x=>x.id===p.pegawai_id)?.nama||"-")+'</td><td>'+esc(p.nip_snapshot||"-")+'</td><td>'+esc(p.pangkat_snapshot||"-")+'</td><td>'+esc(p.jabatan_snapshot||"-")+'</td><td><button class="btn" type="button" data-delete-participant="'+p.id+'">Hapus</button></td></tr>').join("");
   host.innerHTML='<h3>Tambah / Ubah Perjalanan Dinas</h3><form id="dataForm" data-table="perjalanan_dinas"><input type="hidden" name="id"><div class="grid" style="grid-template-columns:1fr 1fr">'+selectField("Kegiatan","kegiatan_id",kegiatan.map(x=>({id:x.id,label:x.nama_subkegiatan+" · "+x.tahun_anggaran})))+selectField("Pos Anggaran","anggaran_id",anggaran.map(x=>({id:x.id,label:"Rp "+Number(x.pagu_awal).toLocaleString("id-ID")})))+field("Nomor Undangan","nomor_undangan","", "text",false)+field("Tanggal Undangan","tanggal_undangan","", "date",false)+field("Lokasi Acara","lokasi_acara")+field("Maksud Perjalanan","maksud_perjalanan")+field("Tempat Berangkat","tempat_berangkat","Kajen")+field("Tempat Tujuan","tempat_tujuan")+`<label class="field"><span>Provinsi Tujuan</span><input type="text" name="provinsi_tujuan" list="daftarProvinsi" placeholder="Ketik untuk mencari provinsi..." autocomplete="off" required><datalist id="daftarProvinsi"><option value="Aceh"><option value="Sumatera Utara"><option value="Sumatera Barat"><option value="Riau"><option value="Kepulauan Riau"><option value="Jambi"><option value="Sumatera Selatan"><option value="Kepulauan Bangka Belitung"><option value="Bengkulu"><option value="Lampung"><option value="DKI Jakarta"><option value="Jawa Barat"><option value="Jawa Tengah"><option value="DI Yogyakarta"><option value="Jawa Timur"><option value="Banten"><option value="Nusa Tenggara Barat"><option value="Nusa Tenggara Timur"><option value="Bali"><option value="Kalimantan Barat"><option value="Kalimantan Tengah"><option value="Kalimantan Selatan"><option value="Kalimantan Timur"><option value="Kalimantan Utara"><option value="Sulawesi Utara"><option value="Gorontalo"><option value="Sulawesi Tengah"><option value="Sulawesi Barat"><option value="Sulawesi Selatan"><option value="Sulawesi Tenggara"><option value="Maluku"><option value="Maluku Utara"><option value="Papua"><option value="Papua Barat"><option value="Papua Selatan"><option value="Papua Tengah"><option value="Papua Pegunungan"><option value="Papua Barat Daya"></datalist></label>`+field("Tanggal Acara Mulai","tanggal_acara_mulai","", "date")+field("Tanggal Acara Selesai","tanggal_acara_selesai","", "date")+field("Tanggal Berangkat","tanggal_berangkat","", "date")+field("Tanggal Kembali","tanggal_kembali","", "date")+field("Alat Angkut","alat_angkut","", "text",false)+'</div><label class="field"><span>Jenis Perjalanan</span><select name="jenis_perjalanan"><option value="luar_kota">Luar Kota / Dinas Biasa</option><option value="dalam_kota">Dalam Kota</option></select></label><label class="field"><span>Status</span><select name="status"><option value="draft">Draft</option><option value="published">Diterbitkan</option><option value="cancelled">Dibatalkan</option></select></label><button class="btn" type="submit">Simpan Perjalanan</button> <button class="btn" type="button" data-reset>Form Baru</button></form><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>Daftar Perjalanan ('+rows.length+')</h3><div class="tablewrap"><table><thead><tr><th>Tujuan / Maksud</th><th>Jadwal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+ (tripRows||'<tr><td colspan="4">Belum ada perjalanan dinas.</td></tr>')+'</tbody></table></div>';
   host.innerHTML+=`<div id="pesertaModal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(5,25,21,.58);padding:24px;overflow:auto;align-items:center;justify-content:center"><section class="panel" style="width:min(900px,100%);max-height:90vh;overflow:auto;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h3 style="margin:0">Peserta Perjalanan</h3><p class="muted" style="margin:6px 0 0">Tujuan: ${esc(rows.find(x=>x.id===selected)?.tempat_tujuan||"")}</p></div><button class="btn" type="button" data-close-participants>Tutup</button></div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><form id="pesertaForm" data-table="perjalanan_peserta"><input type="hidden" name="perjalanan_id" value="${selected}">${selectField("Pegawai","pegawai_id",pegawai.filter(x=>x.aktif).map(x=>({id:x.id,label:x.nama+(x.nip?" · "+x.nip:"")}))) }<button class="btn" type="submit">Tambahkan Peserta</button></form><div class="tablewrap" style="margin-top:16px"><table><thead><tr><th>Nama</th><th>NIP</th><th>Pangkat</th><th>Jabatan</th><th>Aksi</th></tr></thead><tbody>${pesertaRows||'<tr><td colspan="5">Belum ada peserta.</td></tr>'}</tbody></table></div></section></div>`;
   if(window._openParticipantModal){const modal=document.getElementById("pesertaModal");if(modal)modal.style.display="flex";window._openParticipantModal=false;}

  }else if(page==="dokumen"){
   const [perjalanan,arsip]=await Promise.all([fetchRows("perjalanan_dinas"),fetchRows("arsip_dokumen")]);
   window._sppdRows={...(window._sppdRows||{}),perjalanan_dinas:perjalanan,arsip_dokumen:arsip};
   const tripOptions=perjalanan.map(x=>({id:x.id,label:x.tempat_tujuan+" · "+x.tanggal_berangkat+" · "+x.status}));
   const labels={undangan:"Undangan",sp:"Surat Perintah (SP)",sppd:"Surat Perjalanan Dinas (SPPD)",lampiran_sp:"Lampiran SP",lampiran_sppd:"Lampiran SPPD"};
   host.innerHTML=`<div class="panel" style="padding:20px;margin-bottom:20px"><h3>Unggah Dokumen Perjalanan</h3><p class="muted">Simpan file PDF atau DOCX dan hubungkan dengan perjalanan dinas terkait. Dokumen disimpan secara privat.</p><form id="arsipUploadForm"><div class="grid" style="grid-template-columns:1fr 1fr">${selectField("Perjalanan Dinas","perjalanan_id",tripOptions)}<label class="field"><span>Jenis Dokumen</span><select name="jenis_dokumen" required><option value="">Pilih jenis dokumen</option><option value="undangan">Undangan</option><option value="sp">Surat Perintah (SP)</option><option value="sppd">Surat Perjalanan Dinas (SPPD)</option><option value="lampiran_sp">Lampiran SP</option><option value="lampiran_sppd">Lampiran SPPD</option></select></label>${field("Nomor Dokumen","nomor_dokumen","","text",false)}${field("Tanggal Terbit","tanggal_terbit","","date",false)}</div><label class="field"><span>File (PDF atau DOCX, maksimal 20 MB)</span><input type="file" name="file_dokumen" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required></label><button class="btn" type="submit">Unggah & Simpan Arsip</button><div id="arsipUploadMessage" class="notice" style="display:none;margin-top:12px"></div></form></div><h3>Daftar Dokumen & Arsip (${arsip.length})</h3><div class="tablewrap"><table><thead><tr><th>Perjalanan</th><th>Jenis Dokumen</th><th>Nomor / Tanggal</th><th>Versi</th><th>Format</th><th>Aksi</th></tr></thead><tbody>${arsip.map(a=>{const p=perjalanan.find(x=>x.id===a.perjalanan_id);return `<tr><td>${esc(p?.tempat_tujuan||"Perjalanan tidak ditemukan")}<br><small>${esc(p?.tanggal_berangkat||"")}</small></td><td>${labels[a.jenis_dokumen]||esc(a.jenis_dokumen)}</td><td>${esc(a.nomor_dokumen||"-")}<br><small>${esc(a.tanggal_terbit||"-")}</small></td><td>${a.versi}</td><td>${esc(a.format_file.toUpperCase())}</td><td><button class="btn" type="button" data-open-archive="${esc(a.file_path)}">Buka</button></td></tr>`;}).join("")||'<tr><td colspan="6">Belum ada dokumen yang diarsipkan.</td></tr>'}</tbody></table></div>`;
  }else if(page==="anggaran"){
   const [kegiatan,bagian,rekening,anggaran]=await Promise.all([fetchRows("kegiatan"),fetchRows("bagian"),fetchRows("rekening_belanja"),fetchRows("anggaran")]);
   host.innerHTML=`<h3>Master Rekening Belanja</h3><form id="rekeningForm" data-table="rekening_belanja"><input type="hidden" name="id"><div class="grid" style="grid-template-columns:1fr 2fr">${field("Kode Rekening","kode_rekening")}${field("Nama Rekening","nama_rekening")}</div><button class="btn" type="submit">Simpan Rekening</button></form><div class="tablewrap" style="margin:14px 0 24px"><table><thead><tr><th>Kode</th><th>Nama Rekening</th><th>Aksi</th></tr></thead><tbody>${rekening.map(r=>`<tr><td>${esc(r.kode_rekening)}</td><td>${esc(r.nama_rekening)}</td><td><button class="btn" type="button" data-edit-rekening="${r.id}">Ubah</button></td></tr>`).join("")||'<tr><td colspan="3">Belum ada rekening belanja.</td></tr>'}</tbody></table></div><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>Tambah Kegiatan</h3><form id="kegiatanForm" data-table="kegiatan"><input type="hidden" name="id"><div class="grid" style="grid-template-columns:1fr 1fr">${selectField("Bagian","bagian_id",bagian.map(x=>({id:x.id,label:x.nama_bagian}))) }${field("Kode Subkegiatan","kode_subkegiatan","", "text",false)}${field("Nama Subkegiatan","nama_subkegiatan")}${field("Tahun Anggaran","tahun_anggaran","2026","number")}</div><button class="btn" type="submit">Simpan Kegiatan</button></form><div class="tablewrap" style="margin:14px 0 24px"><table><thead><tr><th>Kode</th><th>Nama Subkegiatan</th><th>Tahun</th><th>Aksi</th></tr></thead><tbody>${kegiatan.map(r=>`<tr><td>${esc(r.kode_subkegiatan||"-")}</td><td>${esc(r.nama_subkegiatan)}</td><td>${r.tahun_anggaran}</td><td><button class="btn" type="button" data-edit-kegiatan="${r.id}">Ubah</button></td></tr>`).join("")||'<tr><td colspan="4">Belum ada kegiatan.</td></tr>'}</tbody></table></div><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>Alokasi Anggaran</h3><form id="anggaranForm" data-table="anggaran"><input type="hidden" name="id">${selectField("Kegiatan","kegiatan_id",kegiatan.map(x=>({id:x.id,label:x.nama_subkegiatan+" ("+x.tahun_anggaran+")"}))) }${selectField("Rekening Belanja","rekening_id",rekening.map(x=>({id:x.id,label:x.kode_rekening+" - "+x.nama_rekening}))) }${field("Pagu Awal (Rp)","pagu_awal","0","number")}<button class="btn" type="submit">Simpan Anggaran</button></form><div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>Kegiatan</th><th>Rekening</th><th>Pagu Awal</th><th>Aksi</th></tr></thead><tbody>${anggaran.map(r=>`<tr><td>${esc(kegiatan.find(x=>x.id===r.kegiatan_id)?.nama_subkegiatan||"-")}</td><td>${esc(rekening.find(x=>x.id===r.rekening_id)?.nama_rekening||"-")}</td><td>Rp ${Number(r.pagu_awal).toLocaleString("id-ID")}</td><td><button class="btn" type="button" data-edit-anggaran="${r.id}">Ubah</button></td></tr>`).join("")||'<tr><td colspan="4">Belum ada alokasi anggaran.</td></tr>'}</tbody></table></div>`;
   window._sppdRows={...(window._sppdRows||{}),kegiatan,bagian,rekening_belanja:rekening,anggaran};
  }else{
   host.innerHTML=`<div style="padding:24px;text-align:center"><h3>${info[0]}</h3><p class="muted">Modul ini akan dilanjutkan setelah modul data dasar selesai.</p><span class="status">Tahap berikutnya</span></div>`;
  }
 }catch(e){host.innerHTML=`<div class="notice">Data tidak dapat dimuat: ${esc(e.message)}</div>`;}
}
function showPage(page){
 document.querySelectorAll("aside .nav[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 if(page==="dashboard"){mainView.innerHTML=dashboardMarkup;return;}
 loadPage(page);
}
document.querySelectorAll("aside .nav[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
mainView.addEventListener("click",async ev=>{
 const btn=ev.target.closest("button");if(!btn)return;
 if(btn.hasAttribute("data-close-doc-preview")){document.getElementById("documentPreviewModal")?.remove();return;}
 if(btn.hasAttribute("data-reset")){btn.closest("form")?.reset();const id=btn.closest("form")?.querySelector('[name="id"]');if(id)id.value="";const multi=btn.closest("form")?.elements.namedItem("kegiatan_ids");if(multi)Array.from(multi.options).forEach(o=>o.selected=false);return;}
 const page=document.querySelector("aside .nav.active")?.dataset.page||"";
 let table=null, id=null;
 if(btn.dataset.edit){table=page.startsWith("pengelola_")?"pejabat_pengelola":page;id=btn.dataset.edit;}
 if(btn.dataset.editTravel){table="perjalanan_dinas";id=btn.dataset.editTravel;}
 if(btn.dataset.editRekening){table="rekening_belanja";id=btn.dataset.editRekening;}
 if(btn.dataset.editKegiatan){table="kegiatan";id=btn.dataset.editKegiatan;}
 if(btn.dataset.editAnggaran){table="anggaran";id=btn.dataset.editAnggaran;}
 if(id&&table){
  const form=mainView.querySelector(`form[data-table="${table}"]`);
  const row=(window._sppdRows?.[table]||[]).find(x=>x.id===id);
  if(row&&form){Object.entries(row).forEach(([k,v])=>{const el=form.elements.namedItem(k);if(el&&k!=="kegiatan_id")el.value=v??"";});form.elements.namedItem("id").value=id;form.elements.namedItem("jenis_peran")?.dispatchEvent(new Event("change"));if(row.jenis_peran==="PPTK"){const assigned=(window._sppdRows?.pejabat_pengelola_kegiatan||[]).filter(a=>a.pejabat_pengelola_id===id).map(a=>a.kegiatan_id);const multi=form.elements.namedItem("kegiatan_ids");Array.from(multi.options).forEach(o=>o.selected=assigned.includes(o.value));}form.scrollIntoView({behavior:"smooth",block:"center"});}
  return;
 }
 if(btn.dataset.inactivePejabat){if(!confirm("Akhiri penetapan pejabat ini? Riwayat tetap disimpan."))return;try{const {error}=await sb.from("pejabat_pengelola").update({aktif:false}).eq("id",btn.dataset.inactivePejabat);if(error)throw error;await loadPage(document.querySelector("aside .nav.active")?.dataset.page||"pengelola_pa");}catch(e){await pageError(e);}return;}
 if(btn.dataset.deleteMaster){
  if(!confirm("Hapus pilihan master ini? Data pegawai yang sudah menggunakan pilihan ini mungkin tidak dapat dihapus karena relasi data."))return;
  try{const {error}=await sb.from(btn.dataset.deleteMaster).delete().eq("id",btn.dataset.id);if(error)throw error;await loadPage("master");}catch(e){await pageError(e);}return;
 }

 if(btn.dataset.previewSp||btn.dataset.previewSppd){const tripId=btn.dataset.previewSp||btn.dataset.previewSppd,kind=btn.dataset.previewSp?"sp":"sppd";try{await openTripDocumentPreview(tripId,kind);}catch(e){await pageError(e);alert("Preview dokumen gagal dibuka: "+(e.message||e));}return;}
 if(btn.dataset.openArchive){
  try{const {data,error}=await sb.storage.from("sppd-arsip").createSignedUrl(btn.dataset.openArchive,300);if(error)throw error;window.open(data.signedUrl,"_blank","noopener");}catch(e){await pageError(e);}return;
 }
 if(btn.dataset.detailTrip){
  try{await openTripDetailPage(btn.dataset.detailTrip);}catch(e){await pageError(e);}return;
 }
 if(false){
  try{
   const trip=(window._sppdRows?.perjalanan_dinas||[]).find(x=>x.id===btn.dataset.detailTrip);
   if(!trip)throw new Error("Data perjalanan tidak ditemukan.");
   const [{data:parts,error:partErr},{data:activity,error:activityErr},{data:budget,error:budgetErr}]=await Promise.all([
    sb.from("perjalanan_peserta").select("*").eq("perjalanan_id",trip.id),
    sb.from("kegiatan").select("*").eq("id",trip.kegiatan_id).maybeSingle(),
    sb.from("anggaran").select("*").eq("id",trip.anggaran_id).maybeSingle()
   ]);
   if(partErr)throw partErr;if(activityErr)throw activityErr;if(budgetErr)throw budgetErr;
   const peserta=(parts||[]).map((p,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(p.nama_snapshot||"—")+'</td><td>'+esc(p.nip_snapshot||"—")+'</td><td>'+esc(p.pangkat_snapshot||"—")+'</td><td>'+esc(p.jabatan_snapshot||"—")+'</td></tr>').join("")||'<tr><td colspan="5">Belum ada peserta.</td></tr>';
   const rows=[["Jenis Perjalanan",trip.jenis_perjalanan==="dalam_kota"?"Dalam Kota":"Luar Kota / Dinas Biasa"],["Kegiatan",activity?.nama_subkegiatan||"—"],["Pos Anggaran",budget?.nama_rekening||budget?.uraian||"—"],["Nomor Undangan",trip.nomor_undangan],["Tanggal Undangan",trip.tanggal_undangan],["Lokasi Acara",trip.lokasi_acara],["Maksud Perjalanan",trip.maksud_perjalanan],["Tempat Berangkat",trip.tempat_berangkat],["Tempat Tujuan",trip.tempat_tujuan],["Provinsi Tujuan",trip.provinsi_tujuan],["Tanggal Acara",(trip.tanggal_acara_mulai||"—")+" s.d. "+(trip.tanggal_acara_selesai||"—")],["Tanggal Perjalanan",(trip.tanggal_berangkat||"—")+" s.d. "+(trip.tanggal_kembali||"—")],["Alat Angkut",trip.alat_angkut],["Status",trip.status]];
   const detail=rows.map(([k,v])=>'<tr><th style="text-align:left;padding:8px;width:34%">'+esc(k)+'</th><td style="padding:8px">'+esc(v||"—")+'</td></tr>').join("");
   let modal=document.getElementById("detailTripModal");
   if(!modal){modal=document.createElement("div");modal.id="detailTripModal";modal.style.cssText="position:fixed;inset:0;z-index:1100;background:rgba(5,25,21,.62);padding:18px;overflow:auto;display:flex;align-items:center;justify-content:center";document.body.appendChild(modal);}
   modal.innerHTML='<section class="panel trip-detail-window" style="width:min(960px,100%);max-height:92vh;overflow:auto;margin:auto;padding:22px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h3 style="margin:0">Detail &amp; Kelola Perjalanan</h3><p class="muted" style="margin:5px 0">Pusat pengelolaan dokumen, peserta, dan data perjalanan</p></div><button class="btn" type="button" data-close-detail>Tutup</button></div><div class="trip-management-grid"><button type="button" data-detail-action="participants" class="trip-management-card"><b>Kelola Peserta</b><span>Tambah atau hapus peserta perjalanan</span></button><button type="button" data-detail-action="sp" class="trip-management-card"><b>Surat Perintah</b><span>Lihat pratinjau dan cetak / simpan PDF</span></button><button type="button" data-detail-action="sppd" class="trip-management-card"><b>SPPD</b><span>Lihat pratinjau dan cetak / simpan PDF</span></button><button type="button" data-detail-action="edit" class="trip-management-card"><b>Ubah Data Perjalanan</b><span>Perbarui tujuan, jadwal, dan informasi lainnya</span></button><button type="button" data-detail-action="delete" class="trip-management-card trip-management-danger"><b>Hapus Perjalanan</b><span>Hapus data perjalanan ini</span></button></div><h4>Informasi Perjalanan</h4><div class="tablewrap"><table><tbody>'+detail+'</tbody></table></div><h4 style="margin-top:20px">Peserta ('+(parts||[]).length+')</h4><div class="tablewrap"><table><thead><tr><th>No.</th><th>Nama</th><th>NIP</th><th>Pangkat / Golongan</th><th>Jabatan</th></tr></thead><tbody>'+peserta+'</tbody></table></div></section>';
   modal.style.display="flex";
   modal.querySelector("[data-close-detail]")?.addEventListener("click",()=>modal.remove());
   modal.querySelectorAll("[data-detail-action]").forEach(action=>action.addEventListener("click",async()=>{
    const type=action.dataset.detailAction;
    if(type==="sp"||type==="sppd"){
     action.disabled=true;const original=action.innerHTML;action.innerHTML="<b>Menyiapkan preview...</b><span>Mohon tunggu sebentar</span>";
     try{await openTripDocumentPreview(trip.id,type);modal.remove();}
     catch(e){action.disabled=false;action.innerHTML=original;let err=modal.querySelector(".trip-action-error");if(!err){err=document.createElement("div");err.className="notice trip-action-error";modal.querySelector(".trip-management-grid").after(err);}err.textContent="Preview gagal dibuka: "+(e.message||e);}
     return;
    }
    modal.remove();
    const proxy=document.createElement("button");proxy.type="button";
    if(type==="participants")proxy.dataset.selectTrip=trip.id;
    if(type==="edit")proxy.dataset.editTravel=trip.id;
    if(type==="delete")proxy.dataset.deleteTravel=trip.id;
    mainView.appendChild(proxy);proxy.click();proxy.remove();
   }));
   modal.addEventListener("click",ev=>{if(ev.target===modal)modal.remove();});
  }catch(e){await pageError(e);}return;
 }
 if(btn.hasAttribute("data-close-detail")){const modal=document.getElementById("detailTripModal");if(modal)modal.remove();return;}
 if(btn.dataset.selectTrip){window._selectedTripId=btn.dataset.selectTrip;window._openParticipantModal=true;await loadPage("perjalanan");return;}
 if(btn.hasAttribute("data-close-participants")){const modal=document.getElementById("pesertaModal");if(modal)modal.style.display="none";return;}
 if(btn.dataset.deleteTravel){if(!confirm("Hapus perjalanan ini?"))return;try{const {error}=await sb.from("perjalanan_dinas").delete().eq("id",btn.dataset.deleteTravel);if(error)throw error;window._selectedTripId=null;await loadPage("perjalanan");}catch(e){await pageError(e);}return;}
 if(btn.dataset.deleteParticipant){if(!confirm("Hapus peserta ini?"))return;try{const {error}=await sb.from("perjalanan_peserta").delete().eq("id",btn.dataset.deleteParticipant);if(error)throw error;await loadPage("perjalanan");}catch(e){await pageError(e);}return;}
 if(btn.dataset.delete){
  if(!confirm("Hapus data ini? Tindakan tidak dapat dibatalkan."))return;
  try{const {error}=await sb.from(page).delete().eq("id",btn.dataset.delete);if(error)throw error;await loadPage(page);}catch(e){await pageError(e);}
 }
});
mainView.addEventListener("input",ev=>{
 const search=ev.target.closest("[data-province-search]");if(!search)return;
 const select=search.parentElement.querySelector('select[name="provinsi_tujuan"]');
 const term=search.value.trim().toLocaleLowerCase("id");
 const current=select.value;
 Array.from(select.options).forEach((opt,index)=>{if(index===0){opt.hidden=false;return;}opt.hidden=!!term&&!opt.text.toLocaleLowerCase("id").includes(term);});
 if(current&&!Array.from(select.options).some(o=>o.value===current&&!o.hidden))select.value="";
});

mainView.addEventListener("submit",async ev=>{
 const form=ev.target.closest("#arsipUploadForm");if(!form)return;
 ev.preventDefault();
 const msg=document.getElementById("arsipUploadMessage");
 const show=(t,ok=false)=>{msg.textContent=t;msg.style.display="block";msg.style.background=ok?"#edf7ef":"#fff4e5";msg.style.color=ok?"#28633e":"#805313";};
 const fd=new FormData(form),tripId=fd.get("perjalanan_id"),kind=fd.get("jenis_dokumen"),file=fd.get("file_dokumen");
 if(!tripId||!kind||!file||!file.size){show("Lengkapi perjalanan, jenis dokumen, dan file.");return;}
 const ext=file.name.split(".").pop().toLowerCase();
 if(!["pdf","docx"].includes(ext)){show("Format file harus PDF atau DOCX.");return;}
 if(file.size>20*1024*1024){show("Ukuran file melebihi batas 20 MB.");return;}
 const trip=(window._sppdRows?.perjalanan_dinas||[]).find(x=>x.id===tripId);
 if(!trip){show("Perjalanan dinas tidak ditemukan. Muat ulang halaman.");return;}
 const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Mengunggah...";
 const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
 const path=tripId+"/"+kind+"/"+Date.now()+"_"+safeName;
 try{
  const up=await sb.storage.from("sppd-arsip").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
  if(up.error)throw up.error;
  const versions=(window._sppdRows?.arsip_dokumen||[]).filter(x=>x.perjalanan_id===tripId&&x.jenis_dokumen===kind&&x.format_file===ext).map(x=>Number(x.versi)||1);
  const row={perjalanan_id:tripId,jenis_dokumen:kind,format_file:ext,file_path:path,nomor_dokumen:(fd.get("nomor_dokumen")||"").trim()||null,tanggal_terbit:fd.get("tanggal_terbit")||null,versi:Math.max(0,...versions)+1,status:"aktif",created_by:profile?.id||null};
  const ins=await sb.from("arsip_dokumen").insert(row);
  if(ins.error){await sb.storage.from("sppd-arsip").remove([path]);throw ins.error;}
  await loadPage("dokumen");
  const result=document.getElementById("pageMessage");if(result){result.textContent="Dokumen berhasil diunggah dan diarsipkan.";result.style.display="block";result.style.background="#edf7ef";result.style.color="#28633e";}
 }catch(e){show("Gagal menyimpan dokumen: "+(e.message||String(e)));}
 finally{btn.disabled=false;btn.textContent="Unggah & Simpan Arsip";}
});
mainView.addEventListener("submit",async ev=>{
 const form=ev.target.closest("form[data-table]");if(!form)return;ev.preventDefault();
 const table=form.dataset.table;const fd=new FormData(form);const id=fd.get("id");const data=Object.fromEntries(fd.entries());delete data.id;
 if(data.aktif!==undefined)data.aktif=data.aktif==="true";
 if(table==="perjalanan_dinas" && !id)data.dibuat_oleh=profile?.id||null;
 if(table==="perjalanan_peserta"){const pg=(window._sppdRows?.pegawai||[]).find(x=>x.id===data.pegawai_id);if(!pg){await pageError(new Error("Pegawai tidak ditemukan. Muat ulang halaman dan pilih pegawai yang tersedia."));return;}data.nama_snapshot=pg.nama;data.nip_snapshot=pg.nip||null;data.pangkat_snapshot=pg.pangkat_golongan||null;data.jabatan_snapshot=pg.jabatan==="Sekretaris Daerah"?"Sekretaris Daerah":[pg.jabatan,pg.nomenklatur_jabatan].filter(Boolean).join(" ")||null;}
 if(data.nomenklatur_jabatan==="")data.nomenklatur_jabatan=null;
 if(data.jabatan==="Sekretaris Daerah")data.nomenklatur_jabatan=null;
 if(data.jabatan && data.jabatan!=="Sekretaris Daerah" && !data.nomenklatur_jabatan){await pageError(new Error("Nomenklatur jabatan wajib diisi."));return;}

 let selectedKegiatanIds=[];const pengelolaRole=data.jenis_peran;
 if(table==="pejabat_pengelola"){
  const role=data.jenis_peran;
  if(!["PA","KPA","PPTK","Bendahara Pengeluaran","Bendahara Pengeluaran Pembantu"].includes(role)){await pageError(new Error("Pilih jenis pejabat yang valid."));return;}
  selectedKegiatanIds=Array.from(form.elements.namedItem("kegiatan_ids")?.selectedOptions||[]).map(o=>o.value).filter(Boolean);delete data.kegiatan_ids;
  data.bagian_id=data.bagian_id||null;data.kegiatan_id=role==="PPTK"?(selectedKegiatanIds[0]||null):null;
  if(["KPA","Bendahara Pengeluaran Pembantu"].includes(role)&&!data.bagian_id){await pageError(new Error("Pilih Bagian."));return;}
  if(role==="PPTK"&&!selectedKegiatanIds.length){await pageError(new Error("Pilih minimal satu kegiatan/subkegiatan untuk PPTK."));return;}
  if(["PA","Bendahara Pengeluaran"].includes(role)){data.bagian_id=null;data.kegiatan_id=null;}
  if(role!=="PPTK")data.kegiatan_id=null;
  const person=(window._sppdRows?.pegawai||[]).find(p=>p.id===data.pegawai_id);if(!person||!person.aktif){await pageError(new Error("Pilih pegawai aktif."));return;}
  const conflict=(window._sppdRows?.pejabat_pengelola||[]).find(x=>x.aktif&&x.id!==id&&x.jenis_peran===role&&(role==="PPTK"?x.pegawai_id===data.pegawai_id:(x.bagian_id||null)===(data.bagian_id||null)&&(x.kegiatan_id||null)===(data.kegiatan_id||null)));if(conflict){await pageError(new Error(role==="PPTK"?"Pegawai ini sudah memiliki penetapan PPTK aktif. Gunakan Ubah untuk menambahkan kegiatan.":"Sudah ada penetapan aktif untuk peran dan lingkup ini. Akhiri penetapan sebelumnya terlebih dahulu."));return;}
 }
 if(table==="pejabat_dokumen"){
  if(!["penandatangan_sp","ppk_sppd"].includes(data.jenis_peran)){await pageError(new Error("Pilih dokumen SP atau SPPD."));return;}
  const person=(window._sppdRows?.pegawai||[]).find(p=>p.id===data.pegawai_id);
  const master=(window._sppdRows?.master_jabatan||[]).find(m=>m.nama===person?.jabatan);
  const title=[person?.jabatan,person?.nomenklatur_jabatan].filter(Boolean).join(" ");
  const eselon=String(master?.eselon||"").toUpperCase();
  const qualified=eselon.startsWith("II.")||eselon.startsWith("III.")||/\bKPA\b/i.test(title);
  if(!person||!person.aktif||!qualified){await pageError(new Error("Pejabat harus pegawai aktif dengan kualifikasi minimal Eselon III atau KPA."));return;}
  data.jabatan_dokumen=data.jabatan_dokumen.trim();
 }
 if(data.nip==="")data.nip=null;if(data.bagian_id==="")data.bagian_id=null;if(data.kode_subkegiatan==="")data.kode_subkegiatan=null;
 if(data.pagu_awal!==undefined)data.pagu_awal=Number(data.pagu_awal);
 if(data.tahun_anggaran!==undefined)data.tahun_anggaran=Number(data.tahun_anggaran);
 if(data.urutan!==undefined)data.urutan=Number(data.urutan);
 if(table==="perjalanan_dinas"&&!id){
  const [spCfg,sppdCfg]=await Promise.all([
   sb.from("pejabat_dokumen").select("id,pegawai_id,jabatan_dokumen,pegawai:pegawai_id(nama)").eq("jenis_peran","penandatangan_sp").eq("aktif",true).order("created_at",{ascending:false}).limit(1).maybeSingle(),
   sb.from("pejabat_dokumen").select("id,pegawai_id,jabatan_dokumen,pegawai:pegawai_id(nama)").eq("jenis_peran","ppk_sppd").eq("aktif",true).order("created_at",{ascending:false}).limit(1).maybeSingle()
  ]);
  if(spCfg.error)throw spCfg.error;if(sppdCfg.error)throw sppdCfg.error;
  if(spCfg.data){data.penandatangan_sp_id=spCfg.data.id;data.penandatangan_sp_nama_snapshot=spCfg.data.pegawai?.nama||null;data.penandatangan_sp_jabatan_snapshot=spCfg.data.jabatan_dokumen;}
  if(sppdCfg.data){data.ppk_sppd_id=sppdCfg.data.id;data.ppk_sppd_nama_snapshot=sppdCfg.data.pegawai?.nama||null;data.ppk_sppd_jabatan_snapshot=sppdCfg.data.jabatan_dokumen;}
 }
 try{
  let savedId=id;
  if(table==="pejabat_pengelola"){const q=id?await sb.from(table).update(data).eq("id",id).select("id").single():await sb.from(table).insert(data).select("id").single();if(q.error)throw q.error;savedId=q.data.id;const picked=pengelolaRole==="PPTK"?selectedKegiatanIds:[];const del=await sb.from("pejabat_pengelola_kegiatan").delete().eq("pejabat_pengelola_id",savedId);if(del.error)throw del.error;if(picked.length){const ins=await sb.from("pejabat_pengelola_kegiatan").insert(picked.map(kegiatan_id=>({pejabat_pengelola_id:savedId,kegiatan_id})));if(ins.error)throw ins.error;}}
  else{
   if(table==="pejabat_dokumen"){let deactivate=sb.from(table).update({aktif:false}).eq("jenis_peran",data.jenis_peran).eq("aktif",true);if(id)deactivate=deactivate.neq("id",id);const d=await deactivate;if(d.error)throw d.error;}
   const q=id?await sb.from(table).update(data).eq("id",id):await sb.from(table).insert(data);if(q.error)throw q.error;
  }
  const current=document.querySelector("aside .nav.active")?.dataset.page||"dashboard";
  await loadPage(current);
  const msg=document.getElementById("pageMessage");
  if(msg){msg.textContent="Data berhasil disimpan.";msg.style.display="block";msg.style.background="#edf7ef";msg.style.borderColor="#d7eadb";msg.style.color="#28633e";}
 }catch(e){await pageError(e);}
});
document.querySelectorAll("aside .nav[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
async function rowCount(t){const r=await sb.from(t).select("*",{count:"exact",head:true});if(r.error)throw r.error;return r.count||0;}
async function dashboard(){document.getElementById("app").style.display="block";document.getElementById("userLabel").textContent=profile.username||"Pengguna";document.getElementById("userRole").textContent=profile.role==="admin"?"Admin Global":"Operator";document.getElementById("userAvatar").textContent=(profile.username||"U").charAt(0).toUpperCase();const n=document.getElementById("dashboardNotice");try{const v=await Promise.all([rowCount("bagian"),rowCount("pegawai"),rowCount("perjalanan_dinas"),rowCount("anggaran")]);["statBagian","statPegawai","statPerjalanan","statAnggaran"].forEach((id,i)=>document.getElementById(id).textContent=v[i]);n.innerHTML="<b>Terhubung ke Supabase</b><br>Ringkasan berhasil dibaca dari database.";}catch(e){n.textContent="Sesi aktif, tetapi data ringkasan gagal dimuat: "+e.message;}}
window.logout=async function(){await sb.auth.signOut();profile=null;window.location.replace("./index.html");};
async function restoreDashboardSession(){
 try{
  const {data,error}=await sb.auth.getSession();if(error)throw error;
  const session=data?.session;if(!session?.user){window.location.replace("./index.html");return;}
  const q=await sb.from("user_akun").select("id,username,role,aktif,must_change_password,pegawai_id").eq("id",session.user.id).maybeSingle();
  if(q.error)throw q.error;
  if(!q.data||!q.data.aktif||q.data.must_change_password){await sb.auth.signOut();window.location.replace("./index.html");return;}
  profile=q.data;await dashboard();
 }catch(e){console.error("Pemulihan sesi gagal:",e);await sb.auth.signOut();window.location.replace("./index.html");}
}
restoreDashboardSession();
