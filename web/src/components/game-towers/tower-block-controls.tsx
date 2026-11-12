"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, X } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import styles from "./tower-navigation.module.css";

export function towerBlockUrl(id: string, block: number, from?: string) {
  const query = new URLSearchParams({ block: String(block) });
  if (from) query.set("from", from);
  return `/quests/towers/${encodeURIComponent(id)}?${query}`;
}

export function TowerBlockControls({ id, numbers, current, from, compact = false }: { id: string; numbers: number[]; current: number; from?: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open,setOpen]=useState(false);
  const [error,setError]=useState("");
  const input=useRef<HTMLInputElement>(null);
  const index = numbers.indexOf(current), previous = index >= 0 ? numbers[index - 1] : undefined, next = index >= 0 ? numbers[index + 1] : undefined;
  const position = index < 0 ? "Unavailable" : numbers.every((number, i) => number === i + 1) ? `of ${numbers.length}` : `${numbers.length} blocks`;
  const target=(number:number)=>`${towerBlockUrl(id,number,from)}#block-reader`;
  const go=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const value=input.current?.value.trim()??"",number=Number(value);
    if(!value||!Number.isSafeInteger(number)||!numbers.includes(number)){
      setError(Number.isSafeInteger(number)&&number>=numbers[0]&&number<=numbers[numbers.length-1]?`Block ${number} is not available. Choose another block.`:`Enter a whole block number from ${numbers[0]} to ${numbers[numbers.length-1]}.`);
      return;
    }
    setOpen(false);
    startTransition(()=>router.push(target(number),{scroll:true}));
  };
  const step=(direction:"previous"|"next",number:number|undefined)=>{
    const label=direction==="previous"?"Previous":"Next",icon=direction==="previous"?<ArrowLeft size={18} aria-hidden="true"/>:<ArrowRight size={18} aria-hidden="true"/>;
    const contents=<>{direction==="previous"&&icon}{compact&&<span>{label}</span>}{direction==="next"&&icon}</>;
    return number!==undefined?<Link prefetch={false} href={target(number)} className={compact?styles.footerStep:styles.step} aria-label={`${label} block, ${number}`} title={`${label} block: ${number}`}>{contents}</Link>:<button type="button" disabled className={compact?styles.footerStep:styles.step} aria-label={`${label} block`}>{contents}</button>;
  };
  if(compact)return <nav aria-label="Continue through Tower blocks" className={styles.footerNav}>{step("previous",previous)}<a href="#block-reader" className={styles.backTop} aria-label={`Back to block ${current}`}>Block {current} ↑</a>{step("next",next)}</nav>;
  return <nav aria-label="Tower blocks" className={styles.navigation} aria-busy={pending}>
    <div className={styles.location}><Dialog open={open} onOpenChange={value=>{setOpen(value);setError("");}}>
      <h2><DialogTrigger asChild><button type="button" className={styles.trigger} disabled={pending||!numbers.length} aria-label={`Choose block, current block ${current}`} title="Choose a block">Block {current}<ChevronDown size={16} aria-hidden="true"/></button></DialogTrigger></h2>
      <DialogContent className={styles.dialog} onOpenAutoFocus={event=>{event.preventDefault();input.current?.focus();input.current?.select();}}>
        <DialogTitle className={styles.dialogTitle}>Go to block</DialogTitle>
        <DialogDescription className={styles.help}>Choose a block from {numbers[0]} to {numbers[numbers.length-1]}.</DialogDescription>
        <DialogClose asChild><button type="button" className={styles.close} aria-label="Close block chooser"><X size={18} aria-hidden="true"/></button></DialogClose>
        <form onSubmit={go} noValidate><label htmlFor="tower-block-number">Block number</label><div className={styles.jumpFields}><input ref={input} id="tower-block-number" name="block" type="number" inputMode="numeric" min={numbers[0]} max={numbers[numbers.length-1]} step={1} defaultValue={current} onInput={()=>setError("")} aria-invalid={Boolean(error)} aria-describedby={error?"tower-block-error":undefined}/><button type="submit" disabled={pending}>Go</button></div>{error&&<p id="tower-block-error" className={styles.error} role="alert">{error}</p>}</form>
        <div className={styles.quickLinks}>{numbers.length>0&&<Link prefetch={false} href={target(numbers[0])} onClick={()=>setOpen(false)}>First block <span>{numbers[0]}</span></Link>}{numbers.length>1&&<Link prefetch={false} href={target(numbers[numbers.length-1])} onClick={()=>setOpen(false)}>Last block <span>{numbers[numbers.length-1]}</span></Link>}</div>
      </DialogContent>
    </Dialog><span className={styles.position}>{position}</span></div>
    <div className={styles.steps}>{step("previous",previous)}{step("next",next)}</div>
    {pending&&<span className={styles.loading} role="status">Loading block…</span>}
  </nav>;
}
