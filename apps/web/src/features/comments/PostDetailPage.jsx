import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Heart, MessageCircle, MoreHorizontal, PenLine, Send, Trash2, X } from 'lucide-react';
import { api, getToken } from '../../api';
import { Avatar } from '../../components/layout/AppShell';
import { PostCard } from '../feed/FeedPage';

function formatCommentDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function CommentItem({ comment, me, postOwnerId, canReply, onLike, onEdit, onDelete, onReply }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.noiDung);
  const [working, setWorking] = useState(false);
  const menu = useRef(null);
  const own = Boolean(me && Number(me.id) === Number(comment.idTaiKhoan));
  const canDelete = Boolean(me && (own || Number(me.id) === Number(postOwnerId) || me.phanQuyen === 'admin'));
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (menu.current && !menu.current.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => { if (!editing) setDraft(comment.noiDung); }, [comment.noiDung, editing]);

  async function saveEdit(event) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || value === comment.noiDung || working) {
      if (value === comment.noiDung) setEditing(false);
      return;
    }
    setWorking(true);
    try { if (await onEdit(comment.id, value)) setEditing(false); }
    finally { setWorking(false); }
  }
  async function remove() {
    setOpen(false);
    if (!window.confirm('Bạn muốn xóa bình luận này?')) return;
    setWorking(true);
    try { await onDelete(comment.id); }
    finally { setWorking(false); }
  }
  async function copyLink() {
    setOpen(false);
    try { await navigator.clipboard.writeText(window.location.origin + window.location.pathname + '#comment-' + comment.id); }
    catch { /* Clipboard may be unavailable on insecure local origins. */ }
  }

  return <article className={'zs-comment' + (comment.parentId ? ' zs-comment--reply' : '')} id={'comment-' + comment.id}>
    <Link to={'/users/' + comment.idTaiKhoan} className="zs-comment-avatar" aria-label={'Xem hồ sơ ' + comment.tenDangNhap}>
      <Avatar name={comment.tenDangNhap} avatar={comment.avatar} />
    </Link>
    <div className="zs-comment-main">
      <div className="zs-comment-bubble">
        <div className="zs-comment-top">
          <div className="zs-comment-author">
            <Link to={'/users/' + comment.idTaiKhoan}>{comment.tenDangNhap}</Link>
            <time dateTime={comment.ngayBinhLuan}>{formatCommentDate(comment.ngayBinhLuan)}</time>
          </div>
          <div className="zs-comment-menu" ref={menu}>
            <button className="zs-comment-more" type="button" aria-label={'Tùy chọn bình luận của ' + comment.tenDangNhap}
              aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(value => !value)}>
              <MoreHorizontal size={19}/>
            </button>
            {open && <div className="zs-comment-dropdown" role="group" aria-label="Tùy chọn bình luận">
              {own && <button type="button" onClick={() => {setOpen(false);setEditing(true);}}>
                <PenLine size={15}/> Sửa bình luận
              </button>}
              {canDelete && <button type="button" className="zs-comment-danger" disabled={working} onClick={remove}>
                <Trash2 size={15}/> Xóa bình luận
              </button>}
              <button type="button" onClick={copyLink}><Check size={15}/> Sao chép liên kết</button>
            </div>}
          </div>
        </div>
        {editing ? <form className="zs-comment-edit" onSubmit={saveEdit}>
          <label className="visually-hidden" htmlFor={'comment-edit-' + comment.id}>Chỉnh sửa bình luận</label>
          <textarea id={'comment-edit-' + comment.id} value={draft} onChange={event => setDraft(event.target.value)}
            rows={3} maxLength={10000} autoFocus required />
          <div className="zs-comment-edit-actions">
            <button type="button" onClick={() => {setEditing(false);setDraft(comment.noiDung);}} disabled={working}>Hủy</button>
            <button type="submit" disabled={working || !draft.trim() || draft.trim() === comment.noiDung}>
              {working ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form> : <p>{comment.noiDung}</p>}
        {comment.editedAt && <small className="zs-comment-edited">Đã chỉnh sửa</small>}
      </div>
      <div className="zs-comment-actions">
        {me ? <button type="button" className={comment.likedByMe ? 'is-liked' : ''}
            aria-pressed={Boolean(comment.likedByMe)} disabled={working}
            onClick={() => onLike(comment)}>
          <Heart size={15} fill={comment.likedByMe ? 'currentColor' : 'none'}/>
          {comment.likedByMe ? 'Đã thích' : 'Thích'}{comment.likeCount > 0 ? ' · ' + comment.likeCount : ''}
        </button> : <Link to="/login"><Heart size={15}/> Thích{comment.likeCount > 0 ? ' · ' + comment.likeCount : ''}</Link>}
        {canReply && (me
          ? <button type="button" onClick={() => onReply(comment)}><MessageCircle size={15}/> Trả lời</button>
          : <Link to="/login"><MessageCircle size={15}/> Trả lời</Link>)}
      </div>
    </div>
  </article>;
}

function CommentThread({ postId, post, me }) {
  const [comments,setComments] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [draft,setDraft] = useState('');
  const [replyTo,setReplyTo] = useState(null);
  const [submitting,setSubmitting] = useState(false);
  const [refresh,setRefresh] = useState(0);
  const [liking,setLiking] = useState(null);
  const editor = useRef(null);
  const canReply = post.commentsEnabled !== false;

  useEffect(() => {
    let live=true;
    setLoading(true);
    api('/binhluan/' + postId, getToken() ? {auth:true} : undefined)
      .then(result => {if(live){setComments(Array.isArray(result) ? result : []);setError('');}})
      .catch(err => {if(live)setError(err.message);})
      .finally(()=>{if(live)setLoading(false);});
    return () => {live=false;};
  },[postId,refresh]);
  const { roots, replies } = useMemo(() => {
    const ids = new Set(comments.map(comment => Number(comment.id)));
    const roots = [],replies = new Map();
    comments.forEach(comment => {
      const parentId = Number(comment.parentId);
      if (!parentId || !ids.has(parentId)) roots.push(comment);
      else {
        if (!replies.has(parentId)) replies.set(parentId,[]);
        replies.get(parentId).push(comment);
      }
    });
    return { roots,replies };
  },[comments]);

  async function send(event) {
    event.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);setError('');
    try {
      await api('/binhluan',{method:'POST',auth:true,body:{
        idBaiDang:Number(postId),noiDung:draft.trim(),...(replyTo ? {parentId:replyTo.rootId} : {})
      }});
      setDraft('');setReplyTo(null);setRefresh(value=>value+1);
    } catch(err) {setError(err.message);}
    finally {setSubmitting(false);}
  }
  async function edit(commentId,content) {
    setError('');
    try {
      await api('/binhluan/' + commentId,{method:'PUT',auth:true,body:{noiDung:content}});
      setRefresh(value=>value+1);
      return true;
    } catch(err){setError(err.message);return false;}
  }
  async function remove(commentId) {
    setError('');
    try {
      await api('/binhluan/' + commentId,{method:'DELETE',auth:true});
      setRefresh(value=>value+1);
    }catch(err){setError(err.message);}
  }
  async function like(comment) {
    if (liking!==null)return;
    setLiking(comment.id);setError('');
    try {
      const result=await api('/binhluan/' + comment.id + '/like',{
        auth:true,method:comment.likedByMe ? 'DELETE' : 'PUT'
      });
      setComments(current=>current.map(item=>item.id===comment.id
        ? {...item,likedByMe:result.likedByMe,likeCount:result.likeCount} : item));
    }catch(err){setError(err.message);}
    finally{setLiking(null);}
  }
  function reply(comment) {
    const rootId=Number(comment.parentId || comment.id);
    setReplyTo({rootId,name:comment.tenDangNhap});
    editor.current?.focus();
    editor.current?.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function render(comment) {
    return <CommentItem key={comment.id} comment={comment} me={me} postOwnerId={post.idTaiKhoan}
      canReply={canReply} onLike={like} onEdit={edit} onDelete={remove} onReply={reply}/>;
  }
  return <section className="zs-comments-panel" aria-label="Bình luận bài viết" id="comments">
    <div className="zs-comments-heading">
      <div><p className="zs-comments-kicker">CÙNG TRÒ CHUYỆN</p><h2>Bình luận <span>{comments.length}</span></h2></div>
      <MessageCircle size={23} aria-hidden="true"/>
    </div>
    {canReply && me && <form className="zs-comment-compose" onSubmit={send}>
      <Avatar name={me.tenDangNhap} avatar={me.avatar}/>
      <div className="zs-comment-compose-main">
        {replyTo && <div className="zs-comment-replying">
          <span>Đang trả lời <strong>{replyTo.name}</strong></span>
          <button type="button" aria-label="Hủy trả lời" onClick={()=>setReplyTo(null)}><X size={16}/></button>
        </div>}
        <label className="visually-hidden" htmlFor="zs-comment-draft">Viết bình luận</label>
        <textarea id="zs-comment-draft" ref={editor} placeholder="Viết bình luận..." rows={2} maxLength={10000}
          value={draft} onChange={event=>setDraft(event.target.value)} required />
        <div className="zs-comment-compose-footer">
          <span>Chia sẻ suy nghĩ của bạn</span>
          <button type="submit" disabled={submitting || !draft.trim()}>
            <Send size={16}/>{submitting?'Đang gửi...':replyTo?'Gửi trả lời':'Bình luận'}
          </button>
        </div>
      </div>
    </form>}
    {!me && canReply && <p className="zs-comments-guest"><Link to="/login">Đăng nhập</Link> để tham gia cuộc trò chuyện.</p>}
    {!canReply && <p className="zs-comment-closed" role="status">Tác giả đã tắt bình luận cho bài viết này.</p>}
    {error && <p role="alert" className="zs-error">{error}</p>}
    {loading ? <p role="status" className="zs-comments-status">Đang tải bình luận...</p>
      : !comments.length ? <div className="zs-comments-empty">
          <MessageCircle size={25}/><p>Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện!</p>
        </div>
      : <div className="zs-comment-list">{roots.map(root=>
          <div className="zs-comment-thread" key={root.id}>
            {render(root)}
            {(replies.get(Number(root.id)) || []).length > 0 && <div className="zs-comment-replies">
              {(replies.get(Number(root.id)) || []).map(render)}
            </div>}
          </div>
        )}</div>}
  </section>;
}

export default function PostDetailPage({ me }) {
  const {id}=useParams();
  const navigate=useNavigate();
  const [post,setPost]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
  const [reaction,setReaction]=useState(null);
  const [reactionLoading,setReactionLoading]=useState(Boolean(me));

  useEffect(()=>{
    let active=true;
    setLoading(true);setError('');setPost(null);
    api('/baiviet/' + id,getToken()?{auth:true}:undefined)
      .then(result=>{if(active)setPost(result.data || null);})
      .catch(err=>{if(active)setError(err.message);})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[id,refresh]);
  useEffect(()=>{
    let active=true;
    setReaction(null);
    if(!me || !post) {setReactionLoading(false);return ()=>{active=false};}
    setReactionLoading(true);
    api('/camxuc/cua-toi?ids=' + post.id,{auth:true})
      .then(result=>{if(active)setReaction(result.data?.[String(post.id)] || null);})
      .catch(err=>{if(active)setError(err.message);})
      .finally(()=>{if(active)setReactionLoading(false);});
    return ()=>{active=false;};
  },[post,me?.id]);

  return <div className="zs-detail-page">
    <header className="zs-detail-header">
      <Link to="/" className="zs-detail-back"><ArrowLeft size={17}/> Về bảng tin</Link>
      <p>ZENSPACE / CUỘC TRÒ CHUYỆN</p>
      <h1>Chi tiết bài viết</h1>
    </header>
    {error && <p className="zs-error" role="alert">{error}</p>}
    {loading && <p className="zs-comments-status" role="status">Đang tải bài viết...</p>}
    {post && <>
      <PostCard post={post} me={me} selectedReaction={reaction} reactionLoading={reactionLoading}
        onReactionChange={(_,kind)=>setReaction(kind)}
        onDelete={()=>setRefresh(value=>value+1)}
        onHidden={()=>navigate('/')} onSavedChange={()=>{}} />
      <CommentThread key={post.id} postId={id} post={post} me={me} />
    </>}
  </div>;
}
