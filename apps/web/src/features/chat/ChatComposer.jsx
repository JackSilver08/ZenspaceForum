import React, { useEffect, useRef, useState } from 'react';
import { FileText, Paperclip, Send, Smile, X } from 'lucide-react';

const emojis = ['😀','😄','😂','🥹','😍','😘','😎','🤔','😢','😭','😡','🥳','👍','👎','👏','🙌','🙏','🤝','❤️','💙','💜','🔥','✨','⭐','🎉','💯','👀','😅','😉','😊','😴','🤗','😆','🤩','😇','💪','👌','👋','💐','🚀'];

const readableSize = bytes => bytes < 1024 * 1024
  ? (bytes / 1024).toFixed(1) + ' KB'
  : (bytes / (1024 * 1024)).toFixed(1) + ' MB';

// Compress decodable still images before uploading. Animated GIF is deliberately
// handled on the server to retain animation; no codec silently removes frames.
async function optimizeBeforeUpload(file) {
  if (!file || !/\.(png|jpe?g|bmp|webp|avif)$/i.test(file.name) || !file.type.startsWith('image/')) return file;
  if (file.size > 25 * 1024 * 1024) throw new Error('Ảnh không được vượt quá 25 MB.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const max = 1920;
    const ratio = Math.min(1,max / Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.78));
    if (!blob || blob.type!=='image/webp') return file;
    // WebP inputs are valid already; preserve them when recompression grows.
    if (blob.size >= file.size && file.name.toLowerCase().endsWith('.webp')) return file;
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'});
  } catch {
    return file; // Server handles formats unsupported by this browser.
  } finally {
    bitmap?.close?.();
  }
}

export default function ChatComposer({ peerName, sending, onSend }) {
  const [draft,setDraft] = useState('');
  const [attachment,setAttachment] = useState(null);
  const [emojiOpen,setEmojiOpen] = useState(false);
  const [preparing,setPreparing] = useState(false);
  const [error,setError] = useState('');
  const fileInput=useRef(null);
  const input=useRef(null);
  const picker=useRef(null);
  const busy=sending||preparing;

  useEffect(()=>{
    if (!emojiOpen) return;
    function onOutside(e) {if(picker.current&&!picker.current.contains(e.target))setEmojiOpen(false);}
    function onEscape(e) {if(e.key==='Escape')setEmojiOpen(false);}
    document.addEventListener('pointerdown',onOutside);
    document.addEventListener('keydown',onEscape);
    return ()=>{document.removeEventListener('pointerdown',onOutside);document.removeEventListener('keydown',onEscape);};
  },[emojiOpen]);

  async function send(e) {
    e.preventDefault();
    if (busy||(!draft.trim()&&!attachment))return;
    setPreparing(true);setError('');
    try{
      const file=attachment ? await optimizeBeforeUpload(attachment) : null;
      const succeeded=await onSend(draft.trim(),file,attachment);
      if(succeeded){setDraft('');setAttachment(null);setEmojiOpen(false);}
    }catch(err){setError(err.message||'Không thể chuẩn bị tệp.');}
    finally{setPreparing(false);}
  }
  function addEmoji(emoji) {
    const el=input.current;
    const start=el?.selectionStart??draft.length;
    const end=el?.selectionEnd??draft.length;
    setDraft(value=>value.slice(0,start)+emoji+value.slice(end));
    setEmojiOpen(false);
    requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+emoji.length,start+emoji.length);});
  }
  function onKeys(e){
    if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){
      e.preventDefault();
      if(!busy&&(draft.trim()||attachment))e.currentTarget.form?.requestSubmit();
    }
  }
  function choose(e) {
    const file=e.target.files?.[0];
    e.target.value='';
    if(!file)return;
    if(file.size>80*1024*1024){setError('Tệp không được vượt quá 80 MB.');return;}
    setError('');
    setAttachment(file);
  }
  return <form className="zs-chat-composer" onSubmit={send} aria-label="Soạn tin nhắn">
    {attachment&&<div className="zs-chat-attachment-draft">
      <span className="zs-chat-file-icon"><FileText size={19}/></span>
      <div><strong title={attachment.name}>{attachment.name}</strong><small>{readableSize(attachment.size)}</small></div>
      <button type="button" disabled={busy} onClick={()=>setAttachment(null)} aria-label="Bỏ tệp đính kèm"><X size={17}/></button>
    </div>}
    <input ref={fileInput} type="file" className="zs-chat-file-input"
      aria-label="Chọn tệp đính kèm"
      accept="image/*,video/mp4,video/webm,video/quicktime,audio/*,.pdf,.txt,.md,.csv,.json,.log,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.7z,.rar,.rtf,.heic,.heif"
      onChange={choose}/>
    <div className="zs-chat-input-line">
      <label htmlFor="zs-message-text" className="visually-hidden">Nội dung tin nhắn</label>
      <textarea id="zs-message-text" ref={input} value={draft}
        rows={1} maxLength={5000} disabled={busy}
        placeholder={'Nhắn tin cho '+peerName+'...'}
        onChange={e=>setDraft(e.target.value)} onKeyDown={onKeys}/>
      <button type="button" className="zs-chat-tool" disabled={busy} onClick={()=>fileInput.current?.click()}
        aria-label="Đính kèm tệp" title="Đính kèm ảnh, video hoặc tệp">
        <Paperclip size={20}/>
      </button>
      <div ref={picker} className="zs-chat-emoji-wrap">
        <button type="button" className="zs-chat-tool" disabled={busy} title="Emoji"
          aria-label="Chọn emoji" aria-expanded={emojiOpen}
          onClick={()=>setEmojiOpen(v=>!v)}><Smile size={21}/></button>
        {emojiOpen&&<div className="zs-chat-emoji-picker" aria-label="Bảng emoji">
          <strong>Emoji</strong>
          <div className="zs-chat-emoji-grid">{emojis.map((emoji,index)=>
            <button key={index} type="button" aria-label={'Thêm emoji '+emoji}
              onClick={()=>addEmoji(emoji)}>{emoji}</button>)}</div>
        </div>}
      </div>
      <button className="zs-chat-send" type="submit" aria-label="Gửi" title="Gửi"
        disabled={busy||(!draft.trim()&&!attachment)}><Send size={18}/></button>
    </div>
    {error&&<p className="zs-chat-composer-error" role="alert">{error}</p>}
    {busy&&<small className="zs-chat-upload-status" role="status">
      {preparing?'Đang tối ưu hóa tệp...':'Đang gửi và xử lý tệp...'}
    </small>}
  </form>;
}
