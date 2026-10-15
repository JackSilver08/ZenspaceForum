import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, EyeOff, MoreHorizontal, PenLine, Pin, PinOff, Trash2, X } from 'lucide-react';
import { api } from '../../api';

export default function PostActionsMenu({
  post, me, saved: externallySaved, onSavedChange, onHidden, onChanged, onDeleted,
}) {
  const [open,setOpen] = useState(false);
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState(post.noiDung || '');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [localSaved,setLocalSaved] = useState(false);
  const [pinned,setPinned] = useState(Boolean(post.isPinned));
  const root = useRef(null);
  const dialog = useRef(null);
  const id = Number(post.id);
  const owner = Boolean(me && Number(me.id) === Number(post.idTaiKhoan));
  const canDelete = Boolean(owner || me?.phanQuyen === 'admin');
  const saved = externallySaved === undefined ? localSaved : externallySaved;

  useEffect(()=>{setPinned(Boolean(post.isPinned));},[post.isPinned]);
  useEffect(()=>{if(!editing)setDraft(post.noiDung || '');},[post.noiDung,editing]);
  useEffect(()=>{
    if(!open)return;
    function key(e){if(e.key==='Escape'){setOpen(false);}}
    function close(e){if(root.current && !root.current.contains(e.target))setOpen(false);}
    document.addEventListener('keydown',key);
    document.addEventListener('pointerdown',close);
    return ()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',close);};
  },[open]);
  useEffect(()=>{
    if(!editing)return;
    dialog.current?.focus();
    function warn(e){e.preventDefault();e.returnValue='';}
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[editing]);
  useEffect(()=>{
    if(!open || !me || externallySaved!==undefined)return;
    let active=true;
    api('/v1/posts/my-state?ids='+id,{auth:true})
      .then(result=>{
        if(active)setLocalSaved((result.data?.bookmarked||[]).includes(id));
      }).catch(err=>{if(active)setError(err.message)});
    return ()=>{active=false};
  },[open,id,me?.id,externallySaved]);

  async function execute(fn,after){
    setBusy(true);setError('');
    try {await fn();setOpen(false);after?.();}
    catch(err){setError(err.message || 'Không thực hiện được thao tác.');}
    finally{setBusy(false);}
  }
  function cancelEdit(){
    if(draft!==post.noiDung && !window.confirm('Bỏ nội dung đang chỉnh sửa?'))return;
    setEditing(false);setError('');
  }
  async function updatePost(e){
    e.preventDefault();
    const content=draft.trim();
    if(!content || [...content].length>10000){setError('Nội dung phải từ 1 đến 10.000 ký tự.');return;}
    await execute(()=>api('/baiviet/'+id,{method:'PUT',auth:true,body:{noiDung:content}}),()=>{
      setEditing(false);onChanged?.();
    });
  }
  async function changeSaved(){
    const next=!saved;
    await execute(()=>api('/v1/posts/'+id+'/bookmark',{auth:true,method:next?'PUT':'DELETE'}),()=>{
      setLocalSaved(next);onSavedChange?.(id,next);
    });
  }
  async function hide(){
    await execute(()=>api('/v1/posts/'+id+'/hide',{auth:true,method:'PUT'}),()=>onHidden?.(id));
  }
  async function changePinned(){
    const next=!pinned;
    await execute(()=>api('/v1/posts/'+id+'/pin',{auth:true,method:next?'PUT':'DELETE'}),()=>{
      setPinned(next);onChanged?.();
    });
  }
  async function remove(){
    setOpen(false);
    if(!window.confirm('Xóa vĩnh viễn bài viết này? Hành động không thể hoàn tác.'))return;
    await execute(()=>api('/baiviet/'+id,{method:'DELETE',auth:true}),()=>onDeleted?.());
  }

  return <>
    <div className="zs-post-menu-wrap" ref={root}>
      <button type="button" className="zs-icon-button" aria-label="Tùy chọn bài viết"
        aria-haspopup="true" aria-expanded={open} onClick={()=>{setOpen(v=>!v);setError('');}}>
        <MoreHorizontal size={21}/>
      </button>
      {open && <div className="zs-control-menu" aria-label="Tùy chọn bài viết">
        {!me && <p className="zs-control-menu-note">Đăng nhập để quản lý bài viết.</p>}
        {owner && <button type="button" disabled={busy} onClick={()=>{setDraft(post.noiDung);setEditing(true);setOpen(false)}}>
          <PenLine size={18}/> Chỉnh sửa bài viết
        </button>}
        {me && <button type="button" disabled={busy} onClick={changeSaved}>
          {saved ? <BookmarkCheck size={18}/> : <Bookmark size={18}/>}
          {saved?'Bỏ lưu bài viết':'Lưu bài viết'}
        </button>}
        {owner && <button type="button" disabled={busy} onClick={changePinned}>
          {pinned ? <PinOff size={18}/> : <Pin size={18}/>}
          {pinned?'Bỏ ghim khỏi hồ sơ':'Ghim trên trang cá nhân'}
        </button>}
        {me && !owner && <button type="button" disabled={busy} onClick={hide}>
          <EyeOff size={18}/> Ẩn khỏi bảng tin của tôi
        </button>}
        {canDelete && <><div className="zs-control-divider"/>
          <button className="zs-control-danger" type="button" disabled={busy} onClick={remove}>
            <Trash2 size={18}/> Xóa bài viết
          </button>
        </>}
      </div>}
    </div>
    {editing && <div className="zs-edit-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)cancelEdit();}}>
      <section className="zs-edit-dialog" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true"
        aria-labelledby={'zs-edit-heading-'+id}>
        <header>
          <h2 id={'zs-edit-heading-'+id}>Chỉnh sửa bài viết</h2>
          <button type="button" aria-label="Đóng chỉnh sửa" disabled={busy} onClick={cancelEdit}><X size={19}/></button>
        </header>
        <form onSubmit={updatePost}>
          <label htmlFor={'zs-edit-content-'+id}>Nội dung bài viết</label>
          <textarea id={'zs-edit-content-'+id} value={draft} onChange={e=>setDraft(e.target.value)}
            rows={7} maxLength={10000} required autoFocus/>
          <small>{[...draft].length.toLocaleString('vi-VN')} / 10.000 ký tự · Ảnh/video hiện tại được giữ nguyên.</small>
          {error && <p className="zs-error" role="alert">{error}</p>}
          <footer>
            <button type="button" className="zs-control-secondary" onClick={cancelEdit} disabled={busy}>Hủy</button>
            <button type="submit" className="zs-control-primary" disabled={busy || !draft.trim() || draft===post.noiDung}>
              {busy?'Đang lưu...':'Lưu thay đổi'}
            </button>
          </footer>
        </form>
      </section>
    </div>}
    {!editing && error && <span className="zs-control-inline-error" role="alert">{error}</span>}
  </>;
}
