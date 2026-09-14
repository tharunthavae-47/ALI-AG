"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

type Invoice = { id:string; invoice_number:string; invoice_date:string; due_date:string|null; customer_name:string; customer_company:string|null; customer_address:string|null; customer_email:string|null; vehicle:string|null; license_plate:string|null; notes:string|null; subtotal:number; vat_rate:number; vat_amount:number; total_amount:number; status:string }
type Line = { description:string; quantity:number; unit_price:number }
const emptyLine = ():Line => ({description:"", quantity:1, unit_price:0})

export function ManualInvoiceManager(){
 const [invoices,setInvoices]=useState<Invoice[]>([])
 const [open,setOpen]=useState(false); const [saving,setSaving]=useState(false); const [selected,setSelected]=useState<Invoice|null>(null)
 const [error,setError]=useState(""); const [success,setSuccess]=useState("")
 const [form,setForm]=useState({invoice_number:"",invoice_date:new Date().toISOString().slice(0,10),due_date:"",customer_name:"",customer_company:"",customer_address:"",customer_email:"",vehicle:"",license_plate:"",notes:"",vat_rate:"8.1"})
 const [lines,setLines]=useState<Line[]>([emptyLine()])
 const load=async()=>{const {data,error}=await supabase.from("manual_invoices").select("*").order("invoice_date",{ascending:false});if(error){setError(`Rechnungen konnten nicht geladen werden: ${error.message}`);return}setInvoices((data as Invoice[])??[])}
 useEffect(()=>{void load()},[])
 const subtotal=useMemo(()=>lines.reduce((s,l)=>s+(Number(l.quantity)||0)*(Number(l.unit_price)||0),0),[lines])
 const vat=subtotal*(Number(form.vat_rate)||0)/100; const total=subtotal+vat
 const updateLine=(i:number,k:keyof Line,v:string)=>setLines(a=>a.map((l,n)=>n===i?{...l,[k]:k==="description"?v:Number(v)}:l))
 const create=async()=>{
  setError("");setSuccess("")
  if(!form.invoice_number.trim()){setError("Bitte eine Rechnungsnummer eingeben.");return}
  if(!form.customer_name.trim()){setError("Bitte einen Kundennamen eingeben.");return}
  const usable=lines.filter(l=>l.description.trim())
  if(usable.length===0){setError("Bitte mindestens eine Position mit Beschreibung eingeben.");return}
  if(usable.some(l=>Number(l.quantity)<=0||Number(l.unit_price)<0)){setError("Menge muss grösser als 0 sein und der Preis darf nicht negativ sein.");return}
  setSaving(true)
  try{
   const {data,error:invoiceError}=await supabase.from("manual_invoices").insert({invoice_number:form.invoice_number.trim(),invoice_date:form.invoice_date,due_date:form.due_date||null,customer_name:form.customer_name.trim(),customer_company:form.customer_company.trim()||null,customer_address:form.customer_address.trim()||null,customer_email:form.customer_email.trim()||null,vehicle:form.vehicle.trim()||null,license_plate:form.license_plate.trim()||null,notes:form.notes.trim()||null,vat_rate:Number(form.vat_rate)||0,subtotal,vat_amount:vat,total_amount:total}).select().single()
   if(invoiceError||!data) throw new Error(invoiceError?.message||"Rechnung konnte nicht gespeichert werden.")
   const {error:itemError}=await supabase.from("manual_invoice_items").insert(usable.map((l,i)=>({invoice_id:data.id,description:l.description.trim(),quantity:Number(l.quantity)||1,unit_price:Number(l.unit_price)||0,position:i})))
   if(itemError){await supabase.from("manual_invoices").delete().eq("id",data.id);throw new Error(`Positionen konnten nicht gespeichert werden: ${itemError.message}`)}
   await load(); setOpen(false); setSelected(data as Invoice); setLines([emptyLine()]); setForm({invoice_number:"",invoice_date:new Date().toISOString().slice(0,10),due_date:"",customer_name:"",customer_company:"",customer_address:"",customer_email:"",vehicle:"",license_plate:"",notes:"",vat_rate:"8.1"}); setSuccess(`Rechnung ${data.invoice_number} wurde erfolgreich erstellt.`)
  }catch(e){setError(e instanceof Error?e.message:"Unbekannter Fehler beim Erstellen der Rechnung.")}
  finally{setSaving(false)}
 }
 const print=()=>window.print()
 return <section className="border border-border bg-card p-5 sm:p-6">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Finanzen</p><h3 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide">Manuelle Rechnungen</h3><p className="mt-2 text-sm text-muted-foreground">Rechnungen direkt im Besitzerbereich erstellen und drucken.</p></div><button type="button" onClick={()=>{setError("");setSuccess("");setOpen(true)}} className="bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground">+ Neue Rechnung</button></div>
  {success&&<div className="mt-4 border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700">{success}</div>}
  {error&&!open&&<div className="mt-4 border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700">{error}</div>}
  <div className="mt-6 space-y-2">{invoices.length===0?<p className="border border-border p-4 text-sm text-muted-foreground">Noch keine Rechnungen vorhanden.</p>:invoices.map(i=><button type="button" key={i.id} onClick={()=>setSelected(i)} className="flex w-full items-center justify-between border border-border p-4 text-left hover:bg-secondary/40"><span><b>{i.invoice_number}</b><span className="ml-3 text-sm text-muted-foreground">{i.customer_name}</span></span><b>CHF {Number(i.total_amount).toFixed(2)}</b></button>)}</div>
  {open&&<div className="fixed inset-0 z-[80] overflow-y-auto bg-black/70 p-4"><div className="mx-auto my-8 max-w-3xl border border-border bg-background p-6 sm:p-8"><div className="flex justify-between"><h3 className="font-display text-2xl font-bold uppercase">Neue Rechnung</h3><button type="button" onClick={()=>setOpen(false)} className="border border-border px-3 py-2">×</button></div>
   {error&&<div className="mt-4 border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700">{error}</div>}
   <div className="mt-6 grid gap-4 sm:grid-cols-2">{[["invoice_number","Rechnungsnummer"],["invoice_date","Rechnungsdatum"],["due_date","Zahlbar bis"],["customer_name","Kunde"],["customer_company","Firma"],["customer_email","E-Mail"],["vehicle","Fahrzeug"],["license_plate","Kennzeichen"],["vat_rate","MwSt. %"]].map(([k,l])=><label key={k} className="text-sm"><span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">{l}</span><input value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="w-full border border-border bg-background px-3 py-3"/></label>)}</div>
   <label className="mt-4 block text-sm"><span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Adresse</span><textarea value={form.customer_address} onChange={e=>setForm({...form,customer_address:e.target.value})} className="min-h-20 w-full border border-border bg-background px-3 py-3"/></label>
   <div className="mt-6"><div className="mb-3 flex justify-between"><b>Positionen</b><button type="button" onClick={()=>setLines([...lines,emptyLine()])} className="border border-border px-3 py-2 text-xs uppercase">+ Position</button></div>{lines.map((l,i)=><div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_100px_130px]">{(["description","quantity","unit_price"] as const).map(k=><input key={k} value={l[k]} onChange={e=>updateLine(i,k,e.target.value)} placeholder={k==="description"?"Beschreibung":k==="quantity"?"Menge":"Preis CHF"} className="border border-border bg-background px-3 py-3"/>)}</div>)}</div>
   <label className="mt-4 block text-sm"><span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Bemerkungen</span><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="min-h-20 w-full border border-border bg-background px-3 py-3"/></label>
   <div className="mt-6 border-t border-border pt-5 text-right"><p>Zwischentotal: CHF {subtotal.toFixed(2)}</p><p>MwSt.: CHF {vat.toFixed(2)}</p><p className="mt-1 text-xl font-bold">Total: CHF {total.toFixed(2)}</p></div>
   <button type="button" disabled={saving} onClick={create} className="mt-6 w-full bg-primary px-5 py-4 font-bold uppercase tracking-wider text-primary-foreground">{saving?"Wird gespeichert...":"Rechnung erstellen"}</button>
  </div></div>}
  {selected&&<div className="fixed inset-0 z-[80] overflow-y-auto bg-background p-4"><div className="mx-auto max-w-3xl py-8" id="invoice-print"><div className="border border-border bg-card p-8"><div className="flex justify-between"><div><p className="font-display text-2xl font-bold uppercase">MB-Performance</p><p className="text-sm text-muted-foreground">Mohamedali Brahim · Autoreparatur & Service</p></div><div className="text-right"><p className="text-xs uppercase tracking-wider">Rechnung</p><p className="text-xl font-bold">{selected.invoice_number}</p><p>{selected.invoice_date}</p></div></div><div className="mt-10 grid gap-6 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Rechnung an</p><p className="mt-1 font-bold">{selected.customer_name}</p>{selected.customer_company&&<p>{selected.customer_company}</p>}{selected.customer_address&&<p className="whitespace-pre-line text-sm">{selected.customer_address}</p>}</div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Fahrzeug</p><p>{selected.vehicle||"–"}</p><p>{selected.license_plate||"–"}</p><p className="mt-3 text-sm">Zahlbar bis: {selected.due_date||"–"}</p></div></div><InvoiceItems invoiceId={selected.id}/><div className="mt-8 ml-auto max-w-sm space-y-1 text-right"><p>Zwischentotal: CHF {Number(selected.subtotal).toFixed(2)}</p><p>MwSt. ({Number(selected.vat_rate).toFixed(1)}%): CHF {Number(selected.vat_amount).toFixed(2)}</p><p className="text-2xl font-bold">Total: CHF {Number(selected.total_amount).toFixed(2)}</p></div>{selected.notes&&<p className="mt-8 border-t border-border pt-4 text-sm">{selected.notes}</p>}<p className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">Vielen Dank für Ihren Auftrag.</p></div><div className="mt-4 flex gap-2 print:hidden"><button type="button" onClick={print} className="bg-primary px-5 py-3 font-bold text-primary-foreground">Drucken / PDF</button><button type="button" onClick={()=>setSelected(null)} className="border border-border px-5 py-3">Schliessen</button></div></div></div>}
  <style jsx global>{`@media print{body *{visibility:hidden!important}#invoice-print,#invoice-print *{visibility:visible!important}#invoice-print{position:absolute;left:0;top:0;width:100%}.print\\:hidden{display:none!important}}`}</style>
 </section>
}
function InvoiceItems({invoiceId}:{invoiceId:string}){const [items,setItems]=useState<any[]>([]);useEffect(()=>{supabase.from("manual_invoice_items").select("description,quantity,unit_price,total_price").eq("invoice_id",invoiceId).order("position").then(({data})=>setItems(data??[]))},[invoiceId]);return <div className="mt-8">{items.map((x,i)=><div key={i} className="grid grid-cols-[1fr_80px_120px_120px] border-b border-border py-3 text-sm"><span>{x.description}</span><span className="text-right">{x.quantity}</span><span className="text-right">CHF {Number(x.unit_price).toFixed(2)}</span><span className="text-right">CHF {Number(x.total_price).toFixed(2)}</span></div>)}</div>}
