"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, Archive, ArrowDownToLine, CalendarDays, CheckCircle2,
  ChevronDown, ChevronUp, Clock3, FileText, FileUp, FolderOpen,
  MapPin, Printer, Search, ShieldCheck, UploadCloud, Users, Wallet
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./dokumen.module.css";

export type TripPerson = {
  id: string;
  name: string;
  nip: string;
  rank: string;
  job: string;
  days: number;
  allowance: number;
};

export type TripDocument = {
  id: string;
  number: string;
  issueDate: string;
  signerName: string;
  signerTitle: string;
};

export type TripRecord = {
  id: string;
  status: string;
  tripType: string;
  activityDate: string;
  activityEndDate: string;
  departureDate: string;
  returnDate: string;
  departurePlace: string;
  destination: string;
  destinationProvince: string;
  activityLocation: string;
  purpose: string;
  transport: string;
  invitationNumber: string;
  activityCode: string;
  activityName: string;
  sp: TripDocument | null;
  sppd: TripDocument | null;
  participants: TripPerson[];
  costs: {
    allowance: number;
    bbm: number;
    toll: number;
    lodging: number;
    other: number;
    total: number;
  };
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

type ArchiveTarget = { perjalananId: string; type: "sp" | "sppd" };

const money = (value: number) => "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value || 0));
const shortDate = (value: string) => value
  ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"))
  : "—";
const fullDate = (value: string) => value
  ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value + "T00:00:00"))
  : "—";
const statusName = (status: string) => status === "aktif" ? "Arsip aktif" : status === "digantikan" ? "Versi digantikan" : status === "dibatalkan" ? "Dibatalkan" : status;
const safeFilePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "dokumen";
const tripTypeName = (type: string) => type === "dalam_kota" ? "Dalam Kota" : "Luar Kota";

export default function DokumenClient({
  documents, archives, pageError
}: {
  documents: TripRecord[];
  archives: ArchiveRecord[];
  pageError: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedArchive, setSelectedArchive] = useState<ArchiveTarget | null>(null);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(documents[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [downloadBusyId, setDownloadBusyId] = useState("");

  const filtered = useMemo(() => documents.filter((trip) => {
    const haystack = [
      trip.activityCode, trip.activityName, trip.destination, trip.destinationProvince,
      trip.purpose, trip.activityLocation, trip.sp?.number, trip.sppd?.number,
      trip.sp?.signerName, trip.sppd?.signerName,
      ...trip.participants.map((person) => person.name)
    ].join(" ").toLowerCase();
    return (typeFilter === "all" || trip.tripType === typeFilter) && haystack.includes(search.toLowerCase());
  }), [documents, search, typeFilter]);

  const activeArchives = archives.filter((file) => file.status === "aktif");
  const isArchived = (tripId: string, type: string) => activeArchives.some((file) => file.perjalananId === tripId && file.type === type);
  const archiveableCount = documents.reduce((count, trip) => count + (trip.sp ? 1 : 0) + (trip.sppd ? 1 : 0), 0);
  const awaitingArchive = documents.reduce((count, trip) =>
    count + (trip.sp && !isArchived(trip.id, "sp") ? 1 : 0) + (trip.sppd && !isArchived(trip.id, "sppd") ? 1 : 0), 0);

  function archivesFor(tripId: string, type?: string) {
    return archives
      .filter((file) => file.perjalananId === tripId && (!type || file.type === type))
      .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt));
  }

  function openFilePicker(trip: TripRecord, type: "sp" | "sppd") {
    setSelectedArchive({ perjalananId: trip.id, type });
    setError("");
    setNotice("");
    fileRef.current?.click();
  }

  async function uploadArchive(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const target = selectedArchive;
    setSelectedArchive(null);
    if (!target) {
      setError("Pilih dokumen yang akan diarsipkan terlebih dahulu.");
      return;
    }
    const trip = documents.find((item) => item.id === target.perjalananId);
    const doc = trip?.[target.type];
    if (!trip || !doc) {
      setError("Dokumen perjalanan tidak ditemukan. Muat ulang halaman.");
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
    if (trip.status !== "published") {
      setError("Arsip SP/SPPD hanya dapat diunggah setelah dokumen diterbitkan.");
      return;
    }

    const busy = trip.id + ":" + target.type;
    setBusyKey(busy);
    setError("");
    setNotice("");
    let uploadedPath = "";
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sesi pengguna tidak valid. Silakan masuk kembali.");

      const version = archives
        .filter((item) => item.perjalananId === trip.id && item.type === target.type && item.format === extension)
        .reduce((highest, item) => Math.max(highest, item.version), 0) + 1;
      const fileName = target.type + "-" + safeFilePart(doc.number) + "-v" + version + "-" + Date.now() + "." + extension;
      uploadedPath = trip.id + "/" + target.type + "/" + fileName;
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
        perjalanan_id: trip.id,
        jenis_dokumen: target.type,
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

      setNotice("Arsip " + target.type.toUpperCase() + " berhasil disimpan sebagai versi " + version + ".");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Berkas gagal diarsipkan.");
    } finally {
      setBusyKey("");
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
          <p>Satu daftar untuk setiap perjalanan dinas. Buka perjalanan untuk melihat rincian dan mencetak seluruh dokumennya.</p>
        </div>
        <div className={styles.securityNote}><ShieldCheck size={17} /><span>Arsip privat dan terbatas per Bagian</span></div>
      </div>

      <div className={styles.stats}>
        <article><span>Perjalanan dinas</span><strong>{documents.length}</strong><small>Dikelompokkan berdasarkan tanggal kegiatan</small></article>
        <article><span>Dokumen belum diarsipkan</span><strong>{awaitingArchive}</strong><small>Dari {archiveableCount} dokumen SP dan SPPD</small></article>
        <article><span>Berkas arsip aktif</span><strong>{activeArchives.length}</strong><small>Versi arsip yang masih berlaku</small></article>
      </div>

      {pageError && <div className={styles.alertError}><AlertCircle size={17} />{pageError}</div>}
      {error && <div className={styles.alertError}><AlertCircle size={17} />{error}</div>}
      {notice && <div className={styles.alertSuccess}><CheckCircle2 size={17} />{notice}</div>}

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div>
            <h2>Daftar perjalanan dinas</h2>
            <p>Setiap perjalanan ditampilkan satu kali, meskipun memiliki dokumen SP dan SPPD.</p>
          </div>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kegiatan, tujuan, nomor, peserta..." />
          </div>
        </div>

        <div className={styles.filters}>
          <button className={typeFilter === "all" ? styles.selected : ""} onClick={() => setTypeFilter("all")}>Semua <span>{documents.length}</span></button>
          <button className={typeFilter === "luar_kota" ? styles.selected : ""} onClick={() => setTypeFilter("luar_kota")}>Luar kota <span>{documents.filter((trip) => trip.tripType === "luar_kota").length}</span></button>
          <button className={typeFilter === "dalam_kota" ? styles.selected : ""} onClick={() => setTypeFilter("dalam_kota")}>Dalam kota <span>{documents.filter((trip) => trip.tripType === "dalam_kota").length}</span></button>
        </div>

        <div className={styles.tripList}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <FolderOpen size={30} />
              <b>Belum ada perjalanan yang sesuai</b>
              <span>Perjalanan yang sudah diterbitkan akan muncul di sini.</span>
            </div>
          ) : filtered.map((trip) => {
            const expanded = expandedTripId === trip.id;
            const tripArchives = archivesFor(trip.id);
            const spFiles = archivesFor(trip.id, "sp");
            const sppdFiles = archivesFor(trip.id, "sppd");
            return (
              <article className={styles.tripCard} key={trip.id}>
                <button
                  className={styles.tripSummary}
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedTripId(expanded ? null : trip.id)}
                >
                  <div className={styles.dateTile}>
                    <span>{trip.activityDate ? new Date(trip.activityDate + "T00:00:00").toLocaleDateString("id-ID", { month: "short" }).toUpperCase() : "—"}</span>
                    <b>{trip.activityDate ? new Date(trip.activityDate + "T00:00:00").getDate() : "—"}</b>
                    <small>{trip.activityDate ? new Date(trip.activityDate + "T00:00:00").getFullYear() : ""}</small>
                  </div>
                  <div className={styles.tripInfo}>
                    <div className={styles.tripTitleLine}>
                      <b>{trip.purpose || "Perjalanan dinas"}</b>
                      <span className={styles.tripType}>{tripTypeName(trip.tripType)}</span>
                    </div>
                    <p><MapPin size={13} /> {trip.destination}{trip.destinationProvince ? ", " + trip.destinationProvince : ""}</p>
                    <div className={styles.meta}>
                      <span>{trip.activityCode ? trip.activityCode + " · " : ""}{trip.activityName}</span>
                      <span><CalendarDays size={12} /> {shortDate(trip.departureDate)}{trip.returnDate && trip.returnDate !== trip.departureDate ? " – " + shortDate(trip.returnDate) : ""}</span>
                      <span><Users size={12} /> {trip.participants.length} peserta</span>
                    </div>
                    <div className={styles.docPills}>
                      {trip.sp && <span className={styles.spPill}><FileText size={12} /> SP {trip.sp.number && trip.sp.number !== "-" ? trip.sp.number : "belum bernomor"}</span>}
                      {trip.sppd && <span className={styles.sppdPill}><FileText size={12} /> SPPD {trip.sppd.number && trip.sppd.number !== "-" ? trip.sppd.number : "belum bernomor"}</span>}
                    </div>
                  </div>
                  <div className={styles.tripSummaryEnd}>
                    <span>{expanded ? "Tutup rincian" : "Lihat rincian"}</span>
                    {expanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                  </div>
                </button>

                {expanded && (
                  <div className={styles.tripDetail}>
                    <div className={styles.detailHeading}>
                      <div><b>Rincian perjalanan dinas</b><span>Kegiatan tanggal {fullDate(trip.activityDate)}{trip.activityEndDate && trip.activityEndDate !== trip.activityDate ? " s.d. " + fullDate(trip.activityEndDate) : ""}</span></div>
                      <span className={styles.participantCount}><Users size={14} /> {trip.participants.length} peserta</span>
                    </div>

                    <div className={styles.detailGrid}>
                      <div><small>MAKSUD PERJALANAN</small><b>{trip.purpose || "—"}</b></div>
                      <div><small>LOKASI KEGIATAN</small><b>{trip.activityLocation || trip.destination || "—"}</b></div>
                      <div><small>TEMPAT BERANGKAT</small><b>{trip.departurePlace || "—"}</b></div>
                      <div><small>TEMPAT TUJUAN</small><b>{trip.destination}{trip.destinationProvince ? ", " + trip.destinationProvince : ""}</b></div>
                      <div><small>TANGGAL PERJALANAN</small><b>{shortDate(trip.departureDate)} – {shortDate(trip.returnDate)}</b></div>
                      <div><small>ALAT ANGKUT</small><b>{trip.transport || "—"}</b></div>
                    </div>

                    <div className={styles.participantSection}>
                      <div className={styles.sectionTitle}><Users size={15} /><b>Daftar peserta</b>{trip.participants.length > 4 && <span>Lampiran peserta tersedia</span>}</div>
                      <div className={styles.peopleTable}>
                        <div className={styles.peopleHeader}><span>No.</span><span>Nama / NIP</span><span>Pangkat / Golongan</span><span>Jabatan</span></div>
                        {trip.participants.map((person, index) => (
                          <div className={styles.peopleRow} key={person.id}>
                            <span>{index + 1}</span>
                            <span><b>{person.name}</b><small>{person.nip ? "NIP. " + person.nip : "NIP belum tersedia"}</small></span>
                            <span>{person.rank || "—"}</span>
                            <span>{person.job || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.costSection}>
                      <div className={styles.sectionTitle}><Wallet size={15} /><b>Ringkasan biaya</b></div>
                      <div className={styles.costGrid}>
                        <div><small>UANG HARIAN</small><b>{money(trip.costs.allowance)}</b></div>
                        <div><small>BBM / TIKET</small><b>{money(trip.costs.bbm)}</b></div>
                        <div><small>TOL</small><b>{money(trip.costs.toll)}</b></div>
                        <div><small>PENGINAPAN</small><b>{money(trip.costs.lodging)}</b></div>
                        {trip.costs.other > 0 && <div><small>BIAYA LAIN</small><b>{money(trip.costs.other)}</b></div>}
                        <div className={styles.costTotal}><small>TOTAL</small><b>{money(trip.costs.total)}</b></div>
                      </div>
                    </div>

                    <div className={styles.printSection}>
                      <div className={styles.sectionTitle}><Printer size={15} /><b>Cetak dokumen perjalanan</b></div>
                      <div className={styles.printActions}>
                        {trip.sp && <a href={`/dokumen/cetak/sp/${trip.sp.id}`} target="_blank" rel="noreferrer"><Printer size={15} /> Cetak SP</a>}
                        {trip.sppd && <a href={`/dokumen/cetak/sppd/${trip.sppd.id}`} target="_blank" rel="noreferrer"><Printer size={15} /> Cetak SPPD</a>}
                        {trip.sppd && <a href={`/dokumen/cetak/penerimaan/${trip.sppd.id}`} target="_blank" rel="noreferrer"><FileText size={15} /> Cetak Penerimaan</a>}
                        {trip.participants.length > 4 && trip.sppd && <a className={styles.annexAction} href={`/dokumen/cetak/lampiran/${trip.sppd.id}`} target="_blank" rel="noreferrer"><Users size={15} /> Lampiran Peserta</a>}
                      </div>
                    </div>

                    <div className={styles.archiveSection}>
                      <div className={styles.sectionTitle}><Archive size={15} /><b>Arsip digital</b><span>{tripArchives.length} berkas</span></div>
                      <div className={styles.archiveDocGrid}>
                        {(["sp", "sppd"] as const).map((docType) => {
                          const doc = trip[docType];
                          if (!doc) return null;
                          const files = docType === "sp" ? spFiles : sppdFiles;
                          const busy = busyKey === trip.id + ":" + docType;
                          return (
                            <div className={styles.archiveDocCard} key={docType}>
                              <div className={styles.archiveDocTitle}><b>{docType.toUpperCase()}</b>{isArchived(trip.id, docType) ? <span className={styles.archivedBadge}><CheckCircle2 size={13} /> Diarsipkan</span> : <span className={styles.pendingBadge}><Archive size={13} /> Belum diarsipkan</span>}</div>
                              <button className={styles.uploadButton} disabled={busy || trip.status !== "published"} onClick={() => openFilePicker(trip, docType)}>
                                {busy ? <span className={styles.spinner} /> : <UploadCloud size={15} />}{busy ? "Mengunggah..." : "Unggah arsip " + docType.toUpperCase()}
                              </button>
                              {files.map((file) => (
                                <div className={styles.archiveRow} key={file.id}>
                                  <div className={styles.fileInfo}><b>{file.format.toUpperCase()} · Versi {file.version}</b><span>{fileDateLabel(file.createdAt)} · {statusName(file.status)}</span></div>
                                  <button className={styles.downloadButton} disabled={downloadBusyId === file.id} onClick={() => downloadArchive(file)}><ArrowDownToLine size={14} />{downloadBusyId === file.id ? "..." : "Unduh"}</button>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <div className={styles.footerNote}>
          <Clock3 size={15} />
          <span>Daftar dikelompokkan menurut tanggal kegiatan. Arsip PDF/DOCX maksimal 20 MB dan disimpan pada penyimpanan privat.</span>
        </div>
      </section>
    </div>
  );
}

function fileDateLabel(value: string) {
  return value
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "—";
}
