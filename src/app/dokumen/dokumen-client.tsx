"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, Archive, ArrowDownToLine, CheckCircle2, FileText, FileUp,
  FolderOpen, Printer, Search, ShieldCheck, UploadCloud
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./dokumen.module.css";

export type DocumentRecord = {
  id: string;
  perjalananId: string;
  type: "sp" | "sppd";
  number: string;
  issueDate: string;
  signerName: string;
  signerTitle: string;
  tripStatus: string;
  tripType: string;
  departureDate: string;
  returnDate: string;
  destination: string;
  purpose: string;
  activityCode: string;
  activityName: string;
  createdAt: string;
};

export type ArchiveRecord = {
  id: string;
  perjalananId: string;
  type: string;
  format: string;
  filePath: string;
  number: string;
  issueDate: string;
  version: number;
  status: string;
  createdAt: string;
};

const moneyDate = (value: string) => value
  ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"))
  : "—";
const fileDate = (value: string) => value
  ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
  : "—";
const typeName = (type: string) => type === "sp" ? "Surat Perintah" : "Surat Perjalanan Dinas";
const statusName = (status: string) => status === "aktif" ? "Arsip aktif" : status === "digantikan" ? "Versi digantikan" : status === "dibatalkan" ? "Dibatalkan" : status;
const safeFilePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "dokumen";

export default function DokumenClient({
  documents, archives, pageError
}: {
  documents: DocumentRecord[];
  archives: ArchiveRecord[];
  pageError: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [downloadBusyId, setDownloadBusyId] = useState("");

  const filtered = useMemo(() => documents.filter((doc) => {
    const haystack = [
      doc.number, typeName(doc.type), doc.destination, doc.purpose,
      doc.activityCode, doc.activityName, doc.signerName
    ].join(" ").toLowerCase();
    return (typeFilter === "all" || doc.type === typeFilter) && haystack.includes(search.toLowerCase());
  }), [documents, search, typeFilter]);

  const activeArchives = archives.filter((file) => file.status === "aktif");
  const archivedDocKeys = new Set(activeArchives.map((file) => file.perjalananId + ":" + file.type));
  const awaitingArchive = documents.filter((doc) => !archivedDocKeys.has(doc.perjalananId + ":" + doc.type)).length;

  function openFilePicker(doc: DocumentRecord) {
    setSelectedDocId(doc.id);
    setError("");
    setNotice("");
    fileRef.current?.click();
  }

  async function uploadArchive(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const doc = documents.find((item) => item.id === selectedDocId);
    if (!doc) {
      setError("Dokumen yang akan diarsipkan tidak ditemukan. Muat ulang halaman.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (extension !== "pdf" && extension !== "docx") {
      setError("Format berkas harus PDF atau DOCX.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Ukuran berkas melebihi batas 20 MB.");
      return;
    }
    if (doc.tripStatus !== "published") {
      setError("Arsip SP/SPPD hanya dapat diunggah setelah dokumen diterbitkan.");
      return;
    }

    setBusyId(doc.id);
    setError("");
    setNotice("");
    let uploadedPath = "";
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sesi pengguna tidak valid. Silakan masuk kembali.");

      const version = archives
        .filter((item) => item.perjalananId === doc.perjalananId && item.type === doc.type && item.format === extension)
        .reduce((highest, item) => Math.max(highest, item.version), 0) + 1;

      const fileName = doc.type + "-" + safeFilePart(doc.number) + "-v" + version + "-" + Date.now() + "." + extension;
      uploadedPath = doc.perjalananId + "/" + doc.type + "/" + fileName;
      const contentType = extension === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const { error: uploadError } = await supabase.storage.from("sppd-arsip").upload(uploadedPath, file, {
        contentType,
        cacheControl: "3600",
        upsert: false
      });
      if (uploadError) throw new Error(uploadError.message);

      const { error: insertError } = await supabase.from("arsip_dokumen").insert({
        perjalanan_id: doc.perjalananId,
        jenis_dokumen: doc.type,
        format_file: extension,
        file_path: uploadedPath,
        nomor_dokumen: doc.number,
        tanggal_terbit: doc.issueDate || null,
        versi: version,
        created_by: userData.user.id
      });
      if (insertError) {
        await supabase.storage.from("sppd-arsip").remove([uploadedPath]);
        uploadedPath = "";
        throw new Error(insertError.message);
      }

      setNotice("Arsip " + typeName(doc.type) + " berhasil disimpan sebagai versi " + version + ".");
      setSelectedDocId("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Berkas gagal diarsipkan.");
    } finally {
      setBusyId("");
    }
  }

  async function downloadArchive(file: ArchiveRecord) {
    setDownloadBusyId(file.id);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: signedError } = await supabase.storage
        .from("sppd-arsip")
        .createSignedUrl(file.filePath, 60, { download: true });
      if (signedError) throw new Error(signedError.message);
      if (!data?.signedUrl) throw new Error("Tautan unduhan tidak berhasil dibuat.");
      window.location.assign(data.signedUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Berkas tidak dapat diunduh.");
    } finally {
      setDownloadBusyId("");
    }
  }

  const archivedFilesFor = (doc: DocumentRecord) => archives
    .filter((file) => file.perjalananId === doc.perjalananId && file.type === doc.type)
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className={styles.page}>
      <input
        ref={fileRef}
        className={styles.hiddenInput}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={uploadArchive}
      />

      <div className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>PENGELOLAAN DOKUMEN PERJALANAN DINAS</div>
          <h1>Dokumen SP &amp; SPPD</h1>
          <p>Register dokumen yang telah diterbitkan dan arsip digital per perjalanan dinas.</p>
        </div>
        <div className={styles.securityNote}><ShieldCheck size={17} /><span>Arsip privat dan terbatas per Bagian</span></div>
      </div>

      <div className={styles.stats}>
        <article><span>Total dokumen</span><strong>{documents.length}</strong><small>SP dan SPPD terdaftar</small></article>
        <article><span>Belum diarsipkan</span><strong>{awaitingArchive}</strong><small>Belum memiliki berkas aktif</small></article>
        <article><span>Berkas arsip</span><strong>{activeArchives.length}</strong><small>Versi dengan status aktif</small></article>
      </div>

      {pageError && <div className={styles.alertError}><AlertCircle size={17} />{pageError}</div>}
      {error && <div className={styles.alertError}><AlertCircle size={17} />{error}</div>}
      {notice && <div className={styles.alertSuccess}><CheckCircle2 size={17} />{notice}</div>}

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div>
            <h2>Daftar dokumen</h2>
            <p>Data mengikuti akses perjalanan dinas akun yang sedang masuk.</p>
          </div>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor, kegiatan, tujuan..." />
          </div>
        </div>

        <div className={styles.filters}>
          <button className={typeFilter === "all" ? styles.selected : ""} onClick={() => setTypeFilter("all")}>Semua <span>{documents.length}</span></button>
          <button className={typeFilter === "sp" ? styles.selected : ""} onClick={() => setTypeFilter("sp")}>SP <span>{documents.filter((doc) => doc.type === "sp").length}</span></button>
          <button className={typeFilter === "sppd" ? styles.selected : ""} onClick={() => setTypeFilter("sppd")}>SPPD <span>{documents.filter((doc) => doc.type === "sppd").length}</span></button>
        </div>

        <div className={styles.documentList}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <FolderOpen size={30} />
              <b>Belum ada dokumen yang sesuai</b>
              <span>Dokumen akan muncul setelah SP atau SPPD diterbitkan.</span>
            </div>
          ) : filtered.map((doc) => {
            const files = archivedFilesFor(doc);
            return (
              <article className={styles.documentCard} key={doc.id}>
                <div className={styles.documentMain}>
                  <div className={doc.type === "sp" ? styles.docIconSp : styles.docIconSppd}>
                    <FileText size={21} />
                  </div>
                  <div className={styles.docInfo}>
                    <div className={styles.docTitleLine}>
                      <b>{typeName(doc.type)}</b>
                      <span className={styles.docNumber}>{doc.number && doc.number !== "-" ? doc.number : "Nomor belum tercatat"}</span>
                    </div>
                    <p>{doc.purpose || "Maksud perjalanan belum tersedia"} · {doc.destination}</p>
                    <div className={styles.meta}>
                      <span>{doc.activityCode ? doc.activityCode + " · " : ""}{doc.activityName}</span>
                      <span>{moneyDate(doc.departureDate)}{doc.returnDate && doc.returnDate !== doc.departureDate ? " – " + moneyDate(doc.returnDate) : ""}</span>
                    </div>
                  </div>
                  <div className={styles.signer}>
                    <small>PEJABAT PENANDATANGAN</small>
                    <b>{doc.signerName}</b>
                    <span>{doc.signerTitle}</span>
                  </div>
                  <div className={styles.docActions}>
                    <a className={styles.printButton} href={`/dokumen/cetak/${doc.type}/${doc.id}`} target="_blank" rel="noreferrer">
                      <Printer size={15} /> Cetak / PDF
                    </a>
                    {files.some((file) => file.status === "aktif") ? (
                      <span className={styles.archivedBadge}><CheckCircle2 size={14} />Diarsipkan</span>
                    ) : (
                      <span className={styles.pendingBadge}><Archive size={14} />Belum ada arsip</span>
                    )}
                    <button className={styles.uploadButton} disabled={busyId === doc.id || doc.tripStatus !== "published"} onClick={() => openFilePicker(doc)}>
                      {busyId === doc.id ? <span className={styles.spinner} /> : <UploadCloud size={15} />}
                      {busyId === doc.id ? "Mengunggah..." : "Unggah arsip"}
                    </button>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className={styles.archiveList}>
                    <div className={styles.archiveHeading}><Archive size={14} /><b>Riwayat arsip</b><span>{files.length} berkas</span></div>
                    {files.map((file) => (
                      <div className={styles.archiveRow} key={file.id}>
                        <div className={styles.fileTypeIcon}><FileText size={16} /></div>
                        <div className={styles.fileInfo}>
                          <b>{doc.type.toUpperCase()} · {file.format.toUpperCase()} · Versi {file.version}</b>
                          <span>{fileDate(file.createdAt)} · {statusName(file.status)}</span>
                        </div>
                        <button className={styles.downloadButton} disabled={downloadBusyId === file.id} onClick={() => downloadArchive(file)}>
                          <ArrowDownToLine size={15} />{downloadBusyId === file.id ? "Menyiapkan..." : "Unduh"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <div className={styles.footerNote}>
          <FileUp size={15} />
          <span>Format arsip: PDF atau DOCX, maksimal 20 MB per berkas. Arsip tersimpan pada penyimpanan privat.</span>
        </div>
      </section>
    </div>
  );
}
