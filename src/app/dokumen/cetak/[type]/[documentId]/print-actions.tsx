"use client";
import { Printer } from "lucide-react";
import styles from "./print.module.css";
export default function PrintActions(){
 return <button className={styles.printButton} type="button" onClick={()=>window.print()}><Printer size={16}/> Cetak / Simpan PDF</button>;
}
