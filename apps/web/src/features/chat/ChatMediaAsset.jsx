import React, { useEffect, useState } from 'react';
import { getToken } from '../../api';

// HTTP attachment routes require JWT. Never publish object URLs or token-bearing
// URLs to other users; revoke the browser-local blob when no longer needed.
export function useChatMediaAsset(attachment, preview = false) {
  const [result, setResult] = useState({url:'',loading:true,error:''});
  const path = attachment?.url;
  const previewPath = attachment?.previewUrl;
  useEffect(() => {
    if(!path){setResult({url:'',loading:false,error:''});return;}
    const controller=new AbortController();
    let objectURL='';
    let active=true;
    setResult({url:'',loading:true,error:''});
    const endpoint=preview && attachment.kind==='video' ? previewPath : path;
    (async () => {
      try {
        const response=await fetch(endpoint,{
          headers:{Authorization:'Bearer '+getToken()},
          signal:controller.signal,
        });
        if(!response.ok)throw new Error('Không thể tải media hoặc bạn không có quyền xem.');
        const blob=await response.blob();
        if(!active)return;
        objectURL=URL.createObjectURL(blob);
        setResult({url:objectURL,loading:false,error:''});
      } catch(err){
        if(active && err.name!=='AbortError')setResult({url:'',loading:false,error:err.message});
      }
    })();
    return ()=>{active=false;controller.abort();if(objectURL)URL.revokeObjectURL(objectURL);};
  },[path,previewPath,preview,attachment?.id,attachment?.kind]);
  return result;
}

export function ChatMediaThumb({attachment,active=false,onClick}) {
  const {url,loading,error}=useChatMediaAsset(attachment,attachment.kind==='video');
  return <button type="button" className={'zs-chat-media-tile'+(active?' is-active':'')}
    onClick={onClick} title={attachment.name} aria-label={'Xem '+attachment.name}>
    {url ? <img src={url} alt="" loading="lazy" className={attachment.kind==='image'?'zs-chat-image':undefined}/> : <span className="zs-chat-media-fallback">
      {loading?'Đang tải...':attachment.kind==='video'?'Video':error?'Không tải được ảnh':'Ảnh'}
    </span>}
    {attachment.kind==='video'&&<span className="zs-chat-video-play" aria-hidden="true">▶</span>}
  </button>;
}
