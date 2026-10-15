import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, EyeOff, Flag, MessageSquareOff, MessageSquareText, MoreHorizontal, PenLine, Pin, PinOff, ShieldBan, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '../../api';

export default function PostActionsMenu({
  post, me, saved: externallySaved, onSavedChange, onHidden, onChanged, onDeleted,
}) {
  const [open,setOpen] = useState(false);
  const [editing,setEditing] = useState(false);
  const [reporting,setReporting] = useState(false);
  const [reason,setReason] = useState('spam');
  const [details,setDetails] = useState('');
  const [reported,setReported] = useState(false);
  const [blocked,setBlocked] = useState(false);
  const [commentsEnabled,setCommentsEnabled] = useState(post.commentsEnabled!==false);
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
  useEffect(()=>{setCommentsEnabled(post.commentsEnabled!==false);},[post.commentsEnabled]);
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
    if(!open || !me || owner)return;
    let alive=true;
    api('/v1/users/'+post.idTaiKhoan+'/block-status',{auth:true})
      .then(res=>{if(alive)setBlocked(Boolean(res.blocked))})
      .catch(err=>{if(alive)setError(err.message)});
    return()=>{alive=false};
  },[open,me?.id,post.idTaiKhoan,owner]);
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
  async function toggleComments(){
    const next=!commentsEnabled;
    await execute(()=>api('/v1/posts/'+id+'/comments',{method:'PUT',auth:true,body:{enabled:next}}),()=>{
      setCommentsEnabled(next);onChanged?.();
    });
  }
  async function toggleBlock(){
    const next=!blocked;
    await execute(()=>api('/v1/users/'+post.idTaiKhoan+'/block',{method:next?'PUT':'DELETE',auth:true}),()=>{
      setBlocked(next);onChanged?.();
    });
  }
  async function submitReport(e){
    e.preventDefault();
    await execute(()=>api('/v1/posts/'+id+'/report',{method:'POST',auth:true,body:{reason,details}}),()=>{
      setReporting(false);setReported(true);
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
        {owner && <button type="button" disabled={busy} onClick={toggleComments}>
          {commentsEnabled ? <MessageSquareOff size={18}/> : <MessageSquareText size={18}/>}
          {commentsEnabled ? 'Tắt bình luận' : 'Bật bình luận'}
        </button>}
        {me && !owner && <button type="button" disabled={busy} onClick={hide}>
          <EyeOff size={18}/> Ẩn khỏi bảng tin của tôi
        </button>}
        {me && !owner && <button type="button" disabled={busy} onClick={toggleBlock}>
          {blocked ? <ShieldCheck size={18}/> : <ShieldBan size={18}/>}
          {blocked ? 'Bỏ chặn tác giả' : 'Chặn tác giả'}
        </button>}
        {me && !owner && <button type="button" disabled={busy || reported}
          onClick={()=>{setOpen(false);setError('');setReporting(true)}}>
          <Flag size={18}/> {reported?'Đã báo cáo bài viết':'Báo cáo bài viết'}
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
    {reporting && <div className="zs-edit-overlay" role="presentation"
      onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setReporting(false)}}>
      <section className="zs-edit-dialog" role="dialog" aria-modal="true" aria-labelledby={'zs-report-title-'+id}>
        <header><h2 id={'zs-report-title-'+id}>Báo cáo bài viết</h2>
          <button type="button" aria-label="Đóng báo cáo" onClick={()=>{setReporting(false);setError('')}} disabled={busy}><X size={19}/></button>
        </header>
        <p className="zs-dialog-help">Báo cáo chỉ gửi đến quản trị viên. Nội dung không bị xóa tự động.</p>
        <form onSubmit={submitReport}>
          <label htmlFor={'zs-report-reason-'+id}>Lý do báo cáo</label>
          <select id={'zs-report-reason-'+id} value={reason} onChange={e=>setReason(e.target.value)} required>
            <option value="spam">Spam hoặc quảng cáo</option>
            <option value="harassment">Quấy rối / bắt nạt</option>
            <option value="hate">Ngôn từ thù ghét</option>
            <option value="violence">Bạo lực hoặc đe dọa</option>
            <option value="sexual">Nội dung nhạy cảm</option>
            <option value="misinformation">Thông tin sai lệch</option>
            <option value="other">Lý do khác</option>
          </select>
          <label htmlFor={'zs-report-details-'+id}>Mô tả thêm (tùy chọn)</label>
          <textarea id={'zs-report-details-'+id} value={details} maxLength={500} rows={3}
            placeholder="Giúp quản trị viên hiểu vấn đề..." onChange={e=>setDetails(e.target.value)}/>
          {error && <p className="zs-error" role="alert">{error}</p>}
          <footer><button type="button" className="zs-control-secondary" disabled={busy} onClick={()=>setReporting(false)}>Hủy</button>
          <button type="submit" className="zs-control-primary" disabled={busy}>{busy?'Đang gửi...':'Gửi báo cáo'}</button></footer>
        </form>
      </section>
    </div>}
    {reported && <span className="zs-control-success" role="status">Báo cáo đã được chuyển đến quản trị viên.</span>}
    {!editing && error && <span className="zs-control-inline-error" role="alert">{error}</span>}
  </>;
}
