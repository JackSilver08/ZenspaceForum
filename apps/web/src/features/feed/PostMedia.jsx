import React,{useEffect,useState} from 'react';
import {getToken} from '../../api';

// Media always comes through the Go authorization gateway. Fetching as a Blob
// lets a Bearer-token client render follower/private images without exposing
// secrets in query strings, URLs, browser history or CDN caches.
export default function PostMedia({src,title='',className='zs-post-media'}){
 const [url,setUrl]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{
  if(!src){setUrl('');return}
  const ctl=new AbortController();let objectURL='';
  setError(false);
  (async()=>{
   try{
    const token=getToken();
    const response=await fetch(src,{signal:ctl.signal,headers:token?{Authorization:'Bearer '+token}:{}});
    if(!response.ok)throw Error('Media unavailable');
    const blob=await response.blob();
    if(ctl.signal.aborted)return;
    objectURL=URL.createObjectURL(blob);setUrl(objectURL);
   }catch(e){if(!ctl.signal.aborted)setError(true)}
  })();
  return()=>{ctl.abort();if(objectURL)URL.revokeObjectURL(objectURL);setUrl('')};
 },[src]);
 if(!src||error)return null;
 const isVideo=src.split('?')[0].toLowerCase().endsWith('.mp4');
 return <div className={className}>{url?(isVideo?
  <video controls preload="metadata" src={url} aria-label={title||'Video bài viết'}/>:
  <img loading="lazy" src={url} alt={title||'Hình ảnh bài viết'}/>)
  :<span className="zs-media-loading" role="status">Đang tải ảnh/video...</span>}</div>;
}
