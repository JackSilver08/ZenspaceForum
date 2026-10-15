import React,{useEffect,useRef,useState} from 'react';
import { ImagePlus, Smile, MoreHorizontal, Globe, Users, Lock, X, ChevronDown, MessageCircle } from 'lucide-react';
import { api } from '../../api';
import { Avatar } from '../../components/layout/AppShell';

const visibilityOptions=[
 {value:'public',label:'Công khai',icon:Globe},
 {value:'followers',label:'Người theo dõi',icon:Users},
 {value:'private',label:'Chỉ mình tôi',icon:Lock}
];
const emojiOptions=['💜','✨','😊','🌙','🌌','🚀','⭐','🌸'];
export default function Composer({me,onPosted}){
 const [open,setOpen]=useState(false),[body,setBody]=useState(''),[file,setFile]=useState(null);
 const [visibility,setVisibility]=useState('public'),[commentsEnabled,setCommentsEnabled]=useState(true);
 const [preview,setPreview]=useState(''),[emojiOpen,setEmojiOpen]=useState(false),[moreOpen,setMoreOpen]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[submitting,setSubmitting]=useState(false);
 const input=useRef(null),picker=useRef(null);const dirty=Boolean(body.trim()||file);
 useEffect(()=>{
  if(!file||!file.type.startsWith('image/')){setPreview('');return}
  const url=URL.createObjectURL(file);setPreview(url);
  return()=>URL.revokeObjectURL(url);
 },[file]);
 useEffect(()=>{
  const openComposer=()=>setOpen(true);
  window.addEventListener('zenspace:compose',openComposer);
  if(window.location.hash==='#compose')openComposer();
  return()=>window.removeEventListener('zenspace:compose',openComposer);
 },[]);
 useEffect(()=>{if(open){input.current?.focus();}},[open]);
 useEffect(()=>{
  if(!open)return;
  const onKey=e=>{if(e.key==='Escape'&&!submitting){e.preventDefault();close()}};
  const onUnload=e=>{if(dirty){e.preventDefault();e.returnValue=''}};
  const guardNavigation=e=>{
   if(!dirty||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   const anchor=e.target instanceof Element?e.target.closest('a[href]'):null;
   if(!anchor||anchor.target==='_blank')return;
   const destination=new URL(anchor.href,window.location.href);
   if(destination.origin===window.location.origin&&destination.pathname!==window.location.pathname
     &&!window.confirm('Bạn có bài viết chưa đăng. Rời trang và bỏ nội dung này?')){
    e.preventDefault();e.stopPropagation();
   }
  };
  window.addEventListener('keydown',onKey);
  window.addEventListener('beforeunload',onUnload);
  document.addEventListener('click',guardNavigation,true);
  return()=>{window.removeEventListener('keydown',onKey);window.removeEventListener('beforeunload',onUnload);
   document.removeEventListener('click',guardNavigation,true)}
 // close intentionally reads the latest dirty state through fresh effect registration.
 },[open,dirty,submitting]);
 function close(){
  if(submitting)return;
  if(dirty&&!window.confirm('Bỏ nội dung bài viết chưa đăng?'))return;
  setOpen(false);setError('');setEmojiOpen(false);setMoreOpen(false);
 }
 function onFile(e){
  const picked=e.target.files?.[0];if(!picked)return;
  if(!['image/jpeg','image/png','image/webp','image/gif','video/mp4'].includes(picked.type)){
   setError('Chỉ hỗ trợ JPG, PNG, WEBP, GIF hoặc MP4.');e.target.value='';return;
  }
  if(picked.size>20*1024*1024){setError('Tệp tối đa 20MB.');e.target.value='';return}
  setError('');setFile(picked);
 }
 async function publish(e){
  e.preventDefault();
  if(!body.trim()||submitting)return;
  setSubmitting(true);setError('');
  try{
   const payload=new FormData();payload.append('noiDung',body.trim());
   payload.append('visibility',visibility);payload.append('commentsEnabled',String(commentsEnabled));
   if(file)payload.append('file',file);
   await api('/baiviet',{method:'POST',auth:true,body:payload});
   setBody('');setFile(null);setVisibility('public');setCommentsEnabled(true);
   if(picker.current)picker.current.value='';
   setOpen(false);setNotice('Đã đăng bài thành công.');onPosted?.();
  }catch(e){setError(e.message||'Không đăng được bài.')}
  finally{setSubmitting(false)}
 }
 if(!me)return <section id="compose" className="zs-login-nudge">
  <p>Muốn chia sẻ câu chuyện của bạn?</p><a className="zs-cta" href="/login">Đăng nhập để viết bài</a>
 </section>;
 const current=visibilityOptions.find(v=>v.value===visibility)||visibilityOptions[0];
 const VisibilityIcon=current.icon;
 return <section id="compose" className="zs-composer zs-minimal-composer" aria-label="Tạo bài viết">
  <div className="zs-composer-top">
   <Avatar name={me.tenDangNhap} avatar={me.avatar}/>
   <button type="button" className="zs-composer-trigger" aria-expanded={open} onClick={()=>setOpen(true)}>
    Bạn đang nghĩ gì?
   </button>
  </div>
  {notice&&<p role="status" className="zs-success">{notice}</p>}
  {open&&<div className="zs-new-post-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <section className="zs-new-post-dialog" role="dialog" aria-modal="true" aria-label="Bài viết mới">
    <header className="zs-new-post-header">
     <button type="button" className="zs-new-post-cancel" onClick={close} disabled={submitting}>Hủy</button>
     <h2>Bài viết mới</h2>
     <button type="button" className="zs-new-post-close" aria-label="Đóng" onClick={close} disabled={submitting}><X size={20}/></button>
    </header>
    <form onSubmit={publish} className="zs-new-post-form">
     <div className="zs-new-post-writer">
      <Avatar name={me.tenDangNhap} avatar={me.avatar} size="large"/>
      <div>
       <strong>{me.tenDangNhap}</strong>
       <label className="zs-new-post-visibility">
        <VisibilityIcon size={14}/><span className="visually-hidden">Đối tượng xem</span>
        <select aria-label="Đối tượng xem" value={visibility} onChange={e=>setVisibility(e.target.value)}>
         {visibilityOptions.map(v=><option key={v.value} value={v.value}>{v.label}</option>)}
        </select><ChevronDown size={13}/>
       </label>
      </div>
     </div>
     <label htmlFor="zs-post-body" className="visually-hidden">Nội dung bài viết</label>
     <textarea id="zs-post-body" ref={input} value={body} onChange={e=>setBody(e.target.value)}
      rows={9} maxLength={10000} placeholder="Bạn đang nghĩ gì?" required className="zs-new-post-body"/>
     {file&&<div className="zs-new-post-attachment">
      {preview&&<img src={preview} alt="Xem trước ảnh"/>}
      <span>{file.name}</span>
      <button type="button" aria-label="Bỏ tệp đính kèm" onClick={()=>{setFile(null);if(picker.current)picker.current.value=''}}><X size={17}/></button>
     </div>}
     {body.length>9000&&<p className="zs-new-post-count">{[...body].length} / 10.000</p>}
     {error&&<p className="zs-error" role="alert">{error}</p>}
     <div className="zs-new-post-footer">
      <div className="zs-new-post-tools">
       <button type="button" title="Ảnh hoặc video" aria-label="Thêm ảnh hoặc video" onClick={()=>picker.current?.click()} disabled={submitting}><ImagePlus size={21}/></button>
       <button type="button" title="Emoji" aria-label="Chèn emoji" aria-expanded={emojiOpen} onClick={()=>{setEmojiOpen(v=>!v);setMoreOpen(false)}}><Smile size={21}/></button>
       <button type="button" title="Tùy chọn" aria-label="Tùy chọn bài đăng" aria-expanded={moreOpen} onClick={()=>{setMoreOpen(v=>!v);setEmojiOpen(false)}}><MoreHorizontal size={21}/></button>
       {emojiOpen&&<div className="zs-new-post-popover" role="group" aria-label="Chọn emoji">
        {emojiOptions.map(emoji=><button type="button" key={emoji} onClick={()=>{setBody(v=>v+emoji);input.current?.focus();setEmojiOpen(false)}}>{emoji}</button>)}
       </div>}
       {moreOpen&&<div className="zs-new-post-popover zs-new-post-settings">
        <label><MessageCircle size={18}/><input type="checkbox" checked={commentsEnabled} onChange={e=>setCommentsEnabled(e.target.checked)}/> Cho phép bình luận</label>
       </div>}
      </div>
      <button type="submit" className="zs-new-post-submit" disabled={!body.trim()||submitting}>
       {submitting?'Đang đăng...':'Đăng bài'}
      </button>
     </div>
     <input ref={picker} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
      aria-label="Chọn ảnh hoặc video" onChange={onFile}/>
    </form>
   </section>
  </div>}
 </section>;
}
