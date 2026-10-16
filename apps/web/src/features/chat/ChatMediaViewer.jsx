import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft, ArrowRight, Download, Film, X} from 'lucide-react';
import {ChatMediaThumb, useChatMediaAsset} from './ChatMediaAsset';
import {chatFileSize,downloadChatFile} from './ChatAttachment';

function MediaStage({attachment}) {
  const {url,loading,error}=useChatMediaAsset(attachment);
  return <div className="zs-chat-viewer-stage">
    {loading&&<p role="status">Đang tải media...</p>}
    {error&&<p role="alert">{error}</p>}
    {url&&attachment.kind==='image'&&<img className="zs-chat-viewer-image"
      src={url} alt={attachment.name}/>}
    {url&&attachment.kind==='video'&&<video key={attachment.id} className="zs-chat-viewer-video"
      controls autoPlay playsInline preload="metadata" src={url} aria-label={attachment.name}/>}
  </div>;
}

export default function ChatMediaViewer({media,selectedId,onClose}) {
  const [index,setIndex]=useState(Math.max(0,media.findIndex(x=>x.id===selectedId)));
  const closeButton=useRef(null);
  const previousFocus=useRef(null);
  useEffect(()=>{setIndex(Math.max(0,media.findIndex(x=>x.id===selectedId)));},[selectedId,media]);
  useEffect(()=>{
    previousFocus.current=document.activeElement;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    closeButton.current?.focus();
    return ()=>{
      document.body.style.overflow=previousOverflow;
      if(previousFocus.current?.isConnected)previousFocus.current.focus();
    };
  },[]);
  useEffect(()=>{
    function shortcut(e) {
      if(e.key==='Escape'){e.preventDefault();onClose();}
      if(e.key==='ArrowLeft'){e.preventDefault();setIndex(v=>Math.max(0,v-1));}
      if(e.key==='ArrowRight'){e.preventDefault();setIndex(v=>Math.min(media.length-1,v+1));}
    }
    window.addEventListener('keydown',shortcut);
    return ()=>window.removeEventListener('keydown',shortcut);
  },[onClose,media.length]);
  if(!media.length)return null;
  const selected=media[index]||media[0];
  return createPortal(<div className="zs-chat-viewer" role="dialog" aria-modal="true"
    aria-label="Trình xem ảnh và video">
    <header className="zs-chat-viewer-top">
      <button ref={closeButton} type="button" aria-label="Đóng trình xem"
        onClick={onClose}><X size={22}/></button>
      <div className="zs-chat-viewer-title">
        <strong title={selected.name}>{selected.name}</strong>
        <span>{index+1} / {media.length} · {chatFileSize(selected.size)}</span>
      </div>
      <button type="button" className="zs-chat-viewer-download"
        aria-label="Tải media" onClick={()=>downloadChatFile(selected).catch(()=>{})}>
        <Download size={20}/> <span>Tải xuống</span>
      </button>
    </header>
    <div className="zs-chat-viewer-body">
      <main className="zs-chat-viewer-main">
        <button type="button" className="zs-chat-viewer-prev" aria-label="Media trước"
          disabled={index===0} onClick={()=>setIndex(v=>Math.max(0,v-1))}>
          <ArrowLeft size={25}/>
        </button>
        <MediaStage key={selected.id} attachment={selected}/>
        <button type="button" className="zs-chat-viewer-next" aria-label="Media tiếp theo"
          disabled={index===media.length-1}
          onClick={()=>setIndex(v=>Math.min(media.length-1,v+1))}>
          <ArrowRight size={25}/>
        </button>
      </main>
      <aside className="zs-chat-viewer-strip" aria-label="Danh sách media trong cuộc trò chuyện">
        <div className="zs-chat-viewer-strip-title">
          <Film size={16}/> <span>Ảnh và video</span> <small>{media.length}</small>
        </div>
        <div className="zs-chat-viewer-strip-scroll">
          {media.map((file,i)=><ChatMediaThumb key={file.id}
            attachment={file} active={i===index} onClick={()=>setIndex(i)}/>)}
        </div>
      </aside>
    </div>
  </div>,document.body);
}
