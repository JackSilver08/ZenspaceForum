import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Download,
  Film, Maximize2, Minimize2, RotateCw, Share2, X, ZoomIn, ZoomOut
} from 'lucide-react';
import {getToken} from '../../api';
import {usePopup} from '../../components/ui/PopupProvider';
import {ChatMediaThumb, useChatMediaAsset} from './ChatMediaAsset';
import {chatFileSize, downloadChatFile} from './ChatAttachment';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function MediaStage({attachment, zoom, rotation, pan, onPan}) {
  const {url,loading,error}=useChatMediaAsset(attachment);
  const drag=useRef(null);
  function down(event) {
    if(attachment.kind!=='image'||zoom<=1||event.button!==0)return;
    drag.current={x:event.clientX,y:event.clientY,pan};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if(!drag.current)return;
    onPan({
      x:drag.current.pan.x+event.clientX-drag.current.x,
      y:drag.current.pan.y+event.clientY-drag.current.y,
    });
  }
  function up() {drag.current=null;}
  return <div className={'zs-chat-viewer-stage'+(zoom>1?' is-zoomed':'')}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    {loading&&<p role="status">Đang tải media...</p>}
    {error&&<p role="alert">{error}</p>}
    {url&&attachment.kind==='image'&&<img className="zs-chat-viewer-image"
      draggable="false" src={url} alt={attachment.name}
      style={{transform:`translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`}}/>}
    {url&&attachment.kind==='video'&&<video key={attachment.id} className="zs-chat-viewer-video"
      controls playsInline preload="metadata" src={url} aria-label={attachment.name}/>}
  </div>;
}

export default function ChatMediaViewer({media,selectedId,onClose,onLoadMore,hasMore=false,loadingMore=false}) {
  const [activeId,setActiveId]=useState(selectedId);
  const index=Math.max(0,media.findIndex(file=>file.id===activeId));
  const [minimized,setMinimized]=useState(false);
  const [zoom,setZoom]=useState(1);
  const [rotation,setRotation]=useState(0);
  const [pan,setPan]=useState({x:0,y:0});
  const [sharing,setSharing]=useState(false);
  const closeRef=useRef(null);
  const previousFocus=useRef(null);
  const railRef=useRef(null);
  const selectedRef=useRef(null);
  const wheelRef=useRef(0);
  const {notify}=usePopup();

  useEffect(()=>{
    setActiveId(selectedId);
  },[selectedId]);
  useEffect(()=>{
    setZoom(1);
    setRotation(0);
    setPan({x:0,y:0});
  },[activeId]);
  useEffect(()=>{
    previousFocus.current=document.activeElement;
    return ()=>{if(previousFocus.current?.isConnected) previousFocus.current.focus();};
  },[]);
  useEffect(()=>{
    if(minimized)return;
    const old=document.body.style.overflow;
    document.body.style.overflow='hidden';
    closeRef.current?.focus();
    return ()=>{document.body.style.overflow=old;};
  },[minimized]);
  useEffect(()=>{
    if(minimized)return;
    selectedRef.current?.scrollIntoView({block:'nearest',inline:'nearest'});
  },[index,minimized]);
  const move=useCallback((direction)=>{
    setActiveId(current=>{
      const pos=Math.max(0,media.findIndex(file=>file.id===current));
      return media[clamp(pos+direction,0,media.length-1)]?.id??current;
    });
  },[media]);
  useEffect(()=>{
    function shortcuts(event){
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(minimized)return;
      if(event.target?.closest?.('button,video,input,textarea,select'))return;
      if(event.key==='ArrowLeft'||event.key==='ArrowUp'){
        event.preventDefault();move(-1);
      }else if(event.key==='ArrowRight'||event.key==='ArrowDown'){
        event.preventDefault();move(1);
      }else if(event.key==='+'||event.key==='='){
        event.preventDefault();setZoom(v=>clamp(Math.round((v+.25)*100)/100,1,4));
      }else if(event.key==='-'){
        event.preventDefault();setZoom(v=>clamp(Math.round((v-.25)*100)/100,1,4));
      }else if(event.key.toLowerCase()==='r'){
        event.preventDefault();setRotation(v=>(v+90)%360);
      }else if(event.key==='0'){
        event.preventDefault();setZoom(1);setRotation(0);setPan({x:0,y:0});
      }
    }
    window.addEventListener('keydown',shortcuts);
    return ()=>window.removeEventListener('keydown',shortcuts);
  },[onClose,minimized,move]);

  // Wheel over the photo advances between items; wheel over the thumbnail
  // sidebar scrolls its history normally. Throttle touchpad bursts.
  function onStageWheel(event) {
    if(event.ctrlKey||event.metaKey)return;
    if(Math.abs(event.deltaY)<3&&Math.abs(event.deltaX)<3)return;
    const now=Date.now();
    if(now-wheelRef.current<250)return;
    wheelRef.current=now;
    const direction=(event.deltaY||event.deltaX)>0?1:-1;
    if(direction<0&&index===0&&hasMore){onLoadMore?.();return;}
    move(direction);
  }
  function onRailMove(direction) {
    move(direction);
    railRef.current?.scrollBy({top:direction*150,left:direction*98,behavior:'smooth'});
  }
  async function shareCurrent(file) {
    if(sharing)return;
    setSharing(true);
    try{
      const response=await fetch(file.url,{headers:{Authorization:'Bearer '+getToken()}});
      if(!response.ok)throw new Error('Bạn không có quyền tải tệp này.');
      const blob=await response.blob();
      const item=new File([blob],file.name||'media',{type:blob.type||file.mime||'application/octet-stream'});
      if(typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[item]}))){
        await navigator.share({files:[item],title:'Media từ ZenSpace'});
        return;
      }
      // A private JWT endpoint is not a shareable public link. On desktop,
      // copy still images to the clipboard rather than disclosing credentials.
      if(file.kind==='image'&&navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
        const bitmap=await createImageBitmap(blob);
        try{
          const canvas=document.createElement('canvas');
          canvas.width=bitmap.width;canvas.height=bitmap.height;
          canvas.getContext('2d').drawImage(bitmap,0,0);
          const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          if(png){
            await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
            notify('Đã sao chép ảnh. Bạn có thể dán vào ứng dụng khác.','success');
            return;
          }
        }finally{bitmap.close();}
      }
      await downloadChatFile(file);
      notify('Trình duyệt chưa hỗ trợ chia sẻ tệp trực tiếp. Tệp đã được tải xuống để bạn chia sẻ.','info');
    }catch(error){
      if(error.name!=='AbortError')notify(error.message||'Không thể chia sẻ media.','error');
    }finally{setSharing(false);}
  }

  if(!media.length)return null;
  const selected=media[index]||media[0];
  const image=selected.kind==='image';
  return createPortal(
    <div className={'zs-chat-viewer'+(minimized?' is-minimized':'')}
      role="dialog" aria-modal={!minimized} aria-label="Trình xem ảnh và video">
      {minimized ? <div className="zs-chat-viewer-minibar">
        <span title={selected.name}>{selected.name}</span>
        <button type="button" aria-label="Mở rộng trình xem"
          onClick={()=>setMinimized(false)}><Maximize2 size={18}/></button>
        <button type="button" aria-label="Đóng trình xem" onClick={onClose}><X size={19}/></button>
      </div> : <>
        <header className="zs-chat-viewer-top">
          <div className="zs-chat-viewer-title">
            <strong title={selected.name}>{selected.name}</strong>
            <span>{index+1} / {media.length} · {chatFileSize(selected.size)}</span>
          </div>
          <div className="zs-chat-viewer-toolbar" aria-label="Công cụ xem media">
            <button type="button" aria-label="Chia sẻ media" title="Chia sẻ" disabled={sharing}
              onClick={()=>shareCurrent(selected)}><Share2 size={19}/></button>
            <button type="button" aria-label="Tải media" title="Tải xuống"
              onClick={()=>downloadChatFile(selected).catch(err=>notify(err.message,'error'))}>
              <Download size={19}/></button>
            <span className="zs-chat-viewer-toolbar-separator" aria-hidden="true"/>
            <button type="button" aria-label="Xoay ảnh" title="Xoay ảnh 90°" disabled={!image}
              onClick={()=>setRotation(value=>(value+90)%360)}><RotateCw size={19}/></button>
            <button type="button" aria-label="Thu nhỏ ảnh" title="Thu nhỏ" disabled={!image||zoom<=1}
              onClick={()=>setZoom(v=>clamp(Math.round((v-.25)*100)/100,1,4))}><ZoomOut size={19}/></button>
            <span className="zs-chat-viewer-zoom" aria-label="Mức phóng đại">{Math.round(zoom*100)}%</span>
            <button type="button" aria-label="Phóng to ảnh" title="Phóng to" disabled={!image||zoom>=4}
              onClick={()=>setZoom(v=>clamp(Math.round((v+.25)*100)/100,1,4))}><ZoomIn size={19}/></button>
            <span className="zs-chat-viewer-toolbar-separator" aria-hidden="true"/>
            <button type="button" aria-label="Thu nhỏ trình xem" title="Thu nhỏ cửa sổ"
              onClick={()=>setMinimized(true)}><Minimize2 size={19}/></button>
            <button ref={closeRef} type="button" aria-label="Đóng trình xem" title="Đóng"
              onClick={onClose}><X size={20}/></button>
          </div>
        </header>
        <div className="zs-chat-viewer-body">
          <main className="zs-chat-viewer-main" onWheel={onStageWheel}>
            <button type="button" className="zs-chat-viewer-prev" aria-label="Media trước"
              disabled={index===0} onClick={()=>move(-1)}><ArrowLeft size={22}/></button>
            <MediaStage key={selected.id} attachment={selected} zoom={zoom}
              rotation={rotation} pan={pan} onPan={setPan}/>
            <button type="button" className="zs-chat-viewer-next" aria-label="Media tiếp theo"
              disabled={index===media.length-1} onClick={()=>move(1)}><ArrowRight size={22}/></button>
            <div className="zs-chat-viewer-hint" aria-hidden="true">
              Lăn chuột hoặc dùng phím mũi tên để chuyển ảnh
            </div>
          </main>
          <aside className="zs-chat-viewer-strip" aria-label="Danh sách media trong cuộc trò chuyện">
            <div className="zs-chat-viewer-strip-title">
              <Film size={16}/> <span>Media đã gửi</span> <small>{media.length}</small>
            </div>
            <button type="button" className="zs-chat-viewer-rail-control"
              aria-label="Media phía trên" disabled={index===0}
              onClick={()=>onRailMove(-1)}><ChevronUp size={20}/></button>
            <div className="zs-chat-viewer-strip-scroll" ref={railRef} tabIndex={0}
              onScroll={event=>{if(event.currentTarget.scrollTop<70&&hasMore&&!loadingMore)onLoadMore?.();}}
              aria-label="Cuộn lịch sử ảnh và video">
              {hasMore&&<button type="button" className="zs-chat-viewer-load-more"
                disabled={loadingMore} onClick={()=>onLoadMore?.()}>
                {loadingMore?'Đang tải...':'Tải media cũ hơn'}
              </button>}
              {media.map((file,i)=><div key={file.id} ref={i===index?selectedRef:undefined}
                className="zs-chat-viewer-history-item">
                <ChatMediaThumb attachment={file} active={i===index} onClick={()=>setActiveId(file.id)}/>
              </div>)}
            </div>
            <button type="button" className="zs-chat-viewer-rail-control"
              aria-label="Media phía dưới" disabled={index===media.length-1}
              onClick={()=>onRailMove(1)}><ChevronDown size={20}/></button>
          </aside>
        </div>
      </>}
    </div>,document.body
  );
}
