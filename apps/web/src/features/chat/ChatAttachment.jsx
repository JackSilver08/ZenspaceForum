import React from 'react';
import { Download, FileArchive, FileText, Music2 } from 'lucide-react';
import { getToken } from '../../api';
import { ChatMediaThumb, useChatMediaAsset } from './ChatMediaAsset';

export const chatFileSize = bytes => {
  const value=Number(bytes)||0;
  return value>=1024*1024?(value/1024/1024).toFixed(1)+' MB':(value/1024).toFixed(0)+' KB';
};

export async function downloadChatFile(file) {
  const response=await fetch(file.url,{headers:{Authorization:'Bearer '+getToken()}});
  if(!response.ok)throw new Error('Không thể tải tệp đính kèm.');
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=file.name||'attachment';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function ChatDocument({attachment}) {
  const {url,loading,error}=useChatMediaAsset(attachment);
  const isAudio=attachment.kind==='audio';
  return <div className="zs-chat-document zs-chat-media-caption">
    <span className="zs-chat-document-icon" aria-hidden="true">
      {isAudio?<Music2 size={21}/>:attachment.name?.endsWith('.zip')?<FileArchive size={21}/>:<FileText size={21}/>}
    </span>
    <div className="zs-chat-document-info">
      <strong title={attachment.name}>{attachment.name}</strong>
      <span>{chatFileSize(attachment.size)}</span>
      {isAudio&&url&&<audio controls preload="metadata" src={url} aria-label={attachment.name}/>}
      {error&&<small role="alert">{error}</small>}
    </div>
    <button type="button" disabled={loading||!url} aria-label={'Tải tệp '+attachment.name}
      title="Tải xuống" onClick={()=>downloadChatFile(attachment).catch(()=>{})}>
      <Download size={18}/>
    </button>
  </div>;
}

export default function ChatAttachment({attachment,attachments,onOpen}) {
  const files=attachments?.length?attachments:attachment?[attachment]:[];
  if(!files.length)return null;
  const media=files.filter(file=>file.kind==='image'||file.kind==='video');
  const rest=files.filter(file=>file.kind!=='image'&&file.kind!=='video');
  return <div className="zs-chat-attachment">
    {media.length>0&&<div className={'zs-chat-media-grid'+(media.length===1?' is-single':media.length===3?' is-trio':media.length>4?' is-many':'')}
      aria-label={media.length+' ảnh hoặc video'}>
      {media.map(file=><ChatMediaThumb key={file.id} attachment={file}
        onClick={()=>onOpen?.(file.id)}/>)}
    </div>}
    {media.length===1&&<div className="zs-chat-media-caption">
      <span title={media[0].name}>{media[0].name}</span>
      <small>{chatFileSize(media[0].size)}</small>
      <button type="button" aria-label={'Tải tệp '+media[0].name}
        onClick={()=>downloadChatFile(media[0]).catch(()=>{})}><Download size={17}/></button>
    </div>}
    {rest.length>0&&<div className="zs-chat-documents">
      {rest.map(file=><ChatDocument key={file.id} attachment={file}/>)}
    </div>}
  </div>;
}
