import React, { useEffect, useState } from 'react';
import { Download, FileArchive, FileText, Film, ImageIcon, Music2 } from 'lucide-react';
import { getToken } from '../../api';

const icons={image:ImageIcon,video:Film,audio:Music2,file:FileArchive};
function size(bytes) {
  const amount=Number(bytes)||0;
  return amount>=1024*1024?(amount/1024/1024).toFixed(1)+' MB':(amount/1024).toFixed(0)+' KB';
}
export default function ChatAttachment({ attachment }) {
  const [url,setUrl]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let live=true;
    let objectUrl='';
    setUrl('');setError('');setLoading(true);
    const controller=new AbortController();
    async function load() {
      try {
        const response=await fetch(attachment.url,{headers:{Authorization:'Bearer '+getToken()},signal:controller.signal});
        if(!response.ok)throw new Error('Tệp không tồn tại hoặc bạn không có quyền truy cập.');
        const blob=await response.blob();
        if(!live)return;
        objectUrl=URL.createObjectURL(blob);
        setUrl(objectUrl);
      }catch(err){if(live&&err.name!=='AbortError')setError(err.message);}
      finally{if(live)setLoading(false);}
    }
    load();
    return ()=>{live=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[attachment.id,attachment.url]);
  const Icon=icons[attachment.kind]||FileText;
  return <div className="zs-chat-attachment">
    {loading&&<span role="status" className="zs-chat-media-loading">Đang tải tệp đính kèm...</span>}
    {error&&<span role="alert" className="zs-chat-media-error">{error}</span>}
    {url&&attachment.kind==='image'&&
      <a href={url} download={attachment.name} title={'Tải '+attachment.name}>
        <img src={url} alt={attachment.name} loading="lazy" className="zs-chat-image"/>
      </a>}
    {url&&attachment.kind==='video'&&
      <video className="zs-chat-video" controls preload="metadata" src={url} aria-label={attachment.name}/>}
    {url&&attachment.kind==='audio'&&
      <audio className="zs-chat-audio" controls preload="metadata" src={url} aria-label={attachment.name}/>}
    <div className="zs-chat-media-caption">
      <Icon size={16} aria-hidden="true"/>
      <span title={attachment.name}>{attachment.name}</span>
      <small>{size(attachment.size)}</small>
      {url&&<a href={url} download={attachment.name} aria-label={'Tải tệp '+attachment.name}
        title="Tải xuống"><Download size={17}/></a>}
    </div>
  </div>;
}
