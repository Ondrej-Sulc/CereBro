"use client";

/* eslint-disable @next/next/no-img-element -- Local upload blob URLs must stay in the browser and retain their original pixels. */

import {useState} from 'react';
import {ArrowLeft, RotateCcw, ZoomIn, ZoomOut} from 'lucide-react';
import {TransformComponent, TransformWrapper} from 'react-zoom-pan-pinch';
import {Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger} from '@/components/ui/dialog';
import type {RelicReviewRow} from './relic-screenshot-review';
import styles from './relic-screenshot-import.module.css';

export function RelicScreenshotPreview({row}: {row:RelicReviewRow}) {
  const [open,setOpen] = useState(false);
  const {bounds} = row;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button type="button" aria-label={`Zoom in on ${row.name} ${row.rating}`} className={styles.thumbnail} style={{
        backgroundImage:`url("${row.imageUrl}")`, backgroundSize:`${100/bounds.width}% ${100/bounds.height}%`,
        backgroundPosition:`${bounds.width < 1 ? 100*bounds.x/(1-bounds.width) : 0}% ${bounds.height < 1 ? 100*bounds.y/(1-bounds.height) : 0}%`,
      }}><ZoomIn size={14} aria-hidden="true" /></button>
    </DialogTrigger>
    {open && <PreviewContent row={row} onClose={() => setOpen(false)} />}
  </Dialog>;
}

function PreviewContent({row,onClose}: {row:RelicReviewRow;onClose:()=>void}) {
  const [full,setFull] = useState(false);
  const [imageRatio,setImageRatio] = useState(2);
  const {bounds} = row;
  const ratio = bounds.width*imageRatio/bounds.height;
  return <DialogContent className={styles.previewDialog} onPointerDownOutside={event => event.preventDefault()}>
    <div className={styles.previewHeader}>
      <div><DialogTitle>Screenshot preview · {row.name}</DialogTitle><DialogDescription>Inspect the original card and attribute icons.</DialogDescription></div>
      <button type="button" onClick={onClose}><ArrowLeft size={16} />Back to review</button>
    </div>
    <TransformWrapper key={full ? 'full' : 'card'} minScale={1} maxScale={5} centerOnInit wheel={{step:.2}}>
      {({zoomIn,zoomOut,resetTransform}) => <>
        <div className={styles.previewToolbar}>
          <div><button type="button" aria-pressed={!full} onClick={() => setFull(false)}>Card detail</button><button type="button" aria-pressed={full} onClick={() => setFull(true)}>Full screenshot</button></div>
          <div><button type="button" aria-label="Zoom out" onClick={() => zoomOut()}><ZoomOut size={18} /></button><button type="button" aria-label="Reset zoom" onClick={() => resetTransform()}><RotateCcw size={17} /></button><button type="button" aria-label="Zoom in" onClick={() => zoomIn()}><ZoomIn size={18} /></button></div>
        </div>
        <TransformComponent wrapperClass={styles.previewViewport} contentClass={styles.previewContent}>
          {full ? <img src={row.imageUrl} alt="Original relic screenshot" draggable={false} className={styles.previewFull} /> :
            <div className={styles.previewCrop} style={{aspectRatio:ratio,width:`min(calc(100vw - 64px), calc(58dvh * ${ratio}), 900px)`}}>
              <img src={row.imageUrl} alt={`Original ${row.name} card`} draggable={false}
                onLoad={event => setImageRatio(event.currentTarget.naturalWidth/event.currentTarget.naturalHeight)}
                style={{width:`${100/bounds.width}%`,height:`${100/bounds.height}%`,left:`${-100*bounds.x/bounds.width}%`,top:`${-100*bounds.y/bounds.height}%`}} />
            </div>}
        </TransformComponent>
      </>}
    </TransformWrapper>
    <p className={styles.previewHint}>Pinch or scroll to zoom · drag to move</p>
  </DialogContent>;
}
