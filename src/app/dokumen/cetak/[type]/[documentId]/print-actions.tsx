"use client";

import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";
import styles from "./print.module.css";

export default function PrintActions(){
 const autoPrintStarted=useRef(false);

 useEffect(()=>{
  const shouldOpenPdfPreview=new URLSearchParams(window.location.search).get("print")==="1";
  if(!shouldOpenPdfPreview||autoPrintStarted.current)return;
  autoPrintStarted.current=true;
  const timer=window.setTimeout(()=>window.print(),700);
  return ()=>window.clearTimeout(timer);
 },[]);

 return (
  <button className={styles.printButton} type="button" onClick={()=>window.print()}>
   <Printer size={16}/> Buka Pratinjau PDF
  </button>
 );
}
