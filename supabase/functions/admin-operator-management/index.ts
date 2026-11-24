import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:unknown,n=200)=>typeof v==="string"?v.trim().slice(0,n):"";
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const uuidList=(value:unknown):string[]|null=>{
 if(!Array.isArray(value)||value.length===0||value.length>200) return null;
 const values=value.map(v=>clean(v,36));
 if(values.some(v=>!uuid(v))||new Set(values).size!==values.length) return null;
 return values;
};

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return json(405,{error:"Metode tidak diizinkan."});
 const bearer=req.headers.get("Authorization")??"";
 const token=bearer.replace(/^Bearer\s+/i,"").trim();
 if(!token) return json(401,{error:"Sesi login tidak ditemukan."});
 const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY"), secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!secret){console.error("Environment admin function incomplete");return json(500,{error:"Konfigurasi server belum lengkap."});}
 try{
  const callerClient=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:auth,error:authErr}=await callerClient.auth.getUser(token);
  if(authErr||!auth.user) return json(401,{error:"Sesi login tidak valid."});
  const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:caller,error:callerErr}=await admin.from("user_akun").select("id,role,pegawai_id,aktif,must_change_password").eq("id",auth.user.id).maybeSingle();
  if(callerErr||!caller||caller.role!=="admin"||caller.pegawai_id!==null||caller.aktif!==true||caller.must_change_password!==false)
   return json(403,{error:"Hanya Admin Global aktif yang dapat mengelola akun."});
  const body=await req.json(), action=clean(body?.action,40);

  if(action==="create_operator"){
   const username=clean(body?.username,32).toLowerCase(), password=typeof body?.password==="string"?body.password:"";
   const employeeId=clean(body?.pegawai_id,36), activityIds=uuidList(body?.kegiatan_ids);
   if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return json(400,{error:"Username 3–32 karakter; gunakan huruf kecil, angka, titik, garis bawah, atau tanda hubung."});
   if(password.length<8||password.length>72) return json(400,{error:"Password awal harus 8–72 karakter."});
   if(!employeeId) return json(400,{error:"Pegawai belum terkirim. Pilih ulang pegawai."});
   if(!uuid(employeeId)) return json(400,{error:"ID pegawai tidak valid. Muat ulang halaman dan pilih ulang pegawai."});
   if(!Array.isArray(body?.kegiatan_ids)||body.kegiatan_ids.length===0) return json(400,{error:"Belum ada kegiatan yang terkirim. Centang sekurang-kurangnya satu kegiatan."});
   if(!activityIds) return json(400,{error:"ID kegiatan tidak valid atau ada pilihan kegiatan ganda. Muat ulang dan pilih ulang kegiatan."});
   const [{data:employee,error:eErr},{data:activityRows,error:aErr}]=await Promise.all([
    admin.from("pegawai").select("id,nama,bagian_id,aktif").eq("id",employeeId).maybeSingle(),
    admin.from("kegiatan").select("id,nama_subkegiatan,bagian_id,aktif").in("id",activityIds)
   ]);
   if(eErr||!employee?.aktif) return json(400,{error:"Pegawai tidak ditemukan atau tidak aktif."});
   if(aErr||!activityRows||activityRows.length!==activityIds.length||activityRows.some(row=>!row.aktif)) return json(400,{error:"Salah satu kegiatan tidak ditemukan atau tidak aktif."});
   if(activityRows.some(row=>row.bagian_id!==employee.bagian_id)) return json(400,{error:"Pegawai dan seluruh kegiatan harus berasal dari Bagian yang sama."});
   const [{data:existingUser},{data:existingEmployee},{data:existingAssignments}]=await Promise.all([
    admin.from("user_akun").select("id").eq("username",username).maybeSingle(),
    admin.from("user_akun").select("id").eq("pegawai_id",employeeId).maybeSingle(),
    admin.from("operator_kegiatan").select("kegiatan_id").in("kegiatan_id",activityIds)
   ]);
   if(existingUser) return json(409,{error:"Username sudah digunakan."});
   if(existingEmployee) return json(409,{error:"Pegawai ini sudah memiliki akun."});
   if(existingAssignments?.length) return json(409,{error:"Salah satu kegiatan sudah ditugaskan kepada Staf Admin lain. Muat ulang daftar kegiatan."});
   const {data:authCreated,error:createError}=await admin.auth.admin.createUser({email:username+"@sppd.invalid",password,email_confirm:true,user_metadata:{username}});
   if(createError||!authCreated.user){console.error("Auth create user:",createError?.message);return json(400,{error:createError?.message??"Gagal membuat akun autentikasi."});}
   const userId=authCreated.user.id;
   const {error:accountErr}=await admin.from("user_akun").insert({id:userId,pegawai_id:employeeId,role:"operator",aktif:true,username,must_change_password:false});
   if(accountErr){await admin.auth.admin.deleteUser(userId);return json(400,{error:accountErr.message});}
   const {error:assignErr}=await admin.from("operator_kegiatan").insert(activityIds.map(kegiatan_id=>({user_id:userId,kegiatan_id})));
   if(assignErr){await admin.from("operator_kegiatan").delete().eq("user_id",userId);await admin.from("user_akun").delete().eq("id",userId);await admin.auth.admin.deleteUser(userId);return json(409,{error:"Penugasan gagal. Salah satu kegiatan mungkin sudah diambil Staf Admin lain."});}
   return json(200,{ok:true,user:{id:userId,username,role:"operator",pegawai_id:employeeId,aktif:true},assignments:activityIds.map(kegiatan_id=>({kegiatan_id}))});
  }

  const userId=clean(body?.user_id,36);
  if(!uuid(userId)) return json(400,{error:"Identitas akun tidak valid."});
  const {data:target,error:targetErr}=await admin.from("user_akun").select("id,role,pegawai_id,aktif").eq("id",userId).maybeSingle();
  if(targetErr||!target||target.role!=="operator"||!target.pegawai_id) return json(404,{error:"Akun operator tidak ditemukan."});

  if(action==="set_active"){
   const active=body?.aktif;
   if(typeof active!=="boolean") return json(400,{error:"Status akun tidak valid."});
   if(active){
    const [{data:employee},{data:assignments}]=await Promise.all([
     admin.from("pegawai").select("id,aktif,bagian_id").eq("id",target.pegawai_id).maybeSingle(),
     admin.from("operator_kegiatan").select("kegiatan_id").eq("user_id",userId)
    ]);
    if(!employee?.aktif||!assignments?.length) return json(400,{error:"Akun memerlukan pegawai aktif dan sekurang-kurangnya satu penugasan kegiatan."});
    const ids=assignments.map(row=>row.kegiatan_id);
    const {data:activityRows}=await admin.from("kegiatan").select("id,aktif,bagian_id").in("id",ids);
    if(!activityRows||activityRows.length!==ids.length||activityRows.some(row=>!row.aktif||row.bagian_id!==employee.bagian_id)) return json(400,{error:"Seluruh kegiatan harus aktif dan berada pada Bagian pegawai."});
   }
   const {error}=await admin.from("user_akun").update({aktif:active}).eq("id",userId);
   if(error) return json(400,{error:error.message});
   return json(200,{ok:true,aktif:active});
  }

  if(action==="update_assignment"){
   const activityIds=uuidList(body?.kegiatan_ids);
   if(!activityIds) return json(400,{error:"Pilih sekurang-kurangnya satu kegiatan yang valid."});
   const [{data:employee},{data:activityRows},{data:currentRows}]=await Promise.all([
    admin.from("pegawai").select("id,bagian_id,aktif").eq("id",target.pegawai_id).maybeSingle(),
    admin.from("kegiatan").select("id,bagian_id,aktif").in("id",activityIds),
    admin.from("operator_kegiatan").select("kegiatan_id").eq("user_id",userId)
   ]);
   if(!employee?.aktif) return json(400,{error:"Pegawai harus aktif."});
   if(!activityRows||activityRows.length!==activityIds.length||activityRows.some(row=>!row.aktif||row.bagian_id!==employee.bagian_id)) return json(400,{error:"Seluruh kegiatan harus aktif dan berada pada Bagian pegawai."});
   const currentIds=(currentRows??[]).map(row=>row.kegiatan_id);
   const additions=activityIds.filter(id=>!currentIds.includes(id));
   const removals=currentIds.filter(id=>!activityIds.includes(id));
   if(additions.length){
    const {data:conflicts}=await admin.from("operator_kegiatan").select("kegiatan_id").in("kegiatan_id",additions);
    if(conflicts?.length) return json(409,{error:"Salah satu kegiatan sudah ditugaskan kepada Staf Admin lain."});
    const {error:insertError}=await admin.from("operator_kegiatan").insert(additions.map(kegiatan_id=>({user_id:userId,kegiatan_id})));
    if(insertError) return json(409,{error:"Penambahan kegiatan gagal. Periksa apakah kegiatan sudah ditugaskan kepada staf lain."});
   }
   if(removals.length){
    const {error:deleteError}=await admin.from("operator_kegiatan").delete().eq("user_id",userId).in("kegiatan_id",removals);
    if(deleteError) return json(400,{error:"Kegiatan baru tersimpan, tetapi sebagian penugasan lama gagal dilepas. Muat ulang dan periksa kembali."});
   }
   return json(200,{ok:true,assignments:activityIds.map(kegiatan_id=>({kegiatan_id}))});
  }

  if(action==="reset_password"){
   const password=typeof body?.password==="string"?body.password:"";
   if(password.length<8||password.length>72) return json(400,{error:"Password baru harus 8–72 karakter."});
   const {error}=await admin.auth.admin.updateUserById(userId,{password});
   if(error) return json(400,{error:error.message});
   return json(200,{ok:true});
  }
  return json(400,{error:"Aksi tidak dikenal."});
 }catch(error){console.error("Admin operator function:",error);return json(400,{error:"Permintaan tidak dapat diproses."});}
});
