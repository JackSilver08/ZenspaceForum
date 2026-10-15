import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Compass, Heart,
  ImagePlus, MessageCircle, MoreHorizontal, RefreshCw, Send, PenLine, Orbit,
  Share2, Sparkles, Trash2, X
} from 'lucide-react';
import { api } from '../../api';
import { Avatar } from '../../components/layout/AppShell';

const reactionOptions = [
  { key: 'like', symbol: '👍', label: 'Thích' },
  { key: 'love', symbol: '💜', label: 'Yêu thích' },
  { key: 'haha', symbol: '😆', label: 'Haha' },
  { key: 'wow', symbol: '😮', label: 'Bất ngờ' },
  { key: 'sad', symbol: '😢', label: 'Buồn' },
  { key: 'angry', symbol: '😠', label: 'Giận dữ' },
  { key: 'dislike', symbol: '👎', label: 'Không thích' }
];

const formatDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parsed);
};

function Media({ src, title = '' }) {
  if (!src) return null;
  const url = src.startsWith('http') || src.startsWith('/') ? src : '/' + src;
  const noParams = url.split('?')[0].toLowerCase();
  return (
    <div className="zs-post-media">
      {noParams.endsWith('.mp4') ? (
        <video controls preload="metadata" src={url} aria-label={title || 'Video bài viết'} />
      ) : (
        <img loading="lazy" src={url} alt={title ? `Hình ảnh của bài viết: ${title}` : 'Hình ảnh bài viết'} />
      )}
    </div>
  );
}

function Composer({ me, onPosted }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const picker = useRef(null);
  const titleRef = useRef(null);
  const dirty = Boolean(title.trim() || body.trim() || file);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    function openComposer() {
      setExpanded(true);
      setTimeout(() => titleRef.current?.focus(), 0);
    }
    window.addEventListener('zenspace:compose', openComposer);
    if (window.location.hash === '#compose') openComposer();
    return () => window.removeEventListener('zenspace:compose', openComposer);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    const guardNavigation = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || anchor.target === '_blank') return;
      const destination = new URL(anchor.href, window.location.href);
      const changesPage = destination.origin === window.location.origin &&
        (destination.pathname !== window.location.pathname || destination.search !== window.location.search);
      if (changesPage && !window.confirm('Bạn có bài viết chưa đăng. Rời trang và bỏ nội dung này?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', guardNavigation, true);
    };
  }, [dirty]);

  function reset() {
    if (dirty && !window.confirm('Bỏ nội dung bài viết chưa lưu?')) return;
    setTitle(''); setBody(''); setFile(null); setPreview('');
    setError(''); setExpanded(false);
    if (picker.current) picker.current.value = '';
  }

  function selectFile(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const accepted = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];
    if (!accepted.includes(selected.type)) {
      setError('Chỉ hỗ trợ JPG, PNG, WEBP, GIF hoặc MP4.');
      e.target.value = ''; return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setError('Tệp không được vượt quá 20 MB.');
      e.target.value = ''; return;
    }
    setFile(selected); setError(''); setExpanded(true);
  }

  async function publish(event) {
    event.preventDefault();
    if (!title.trim() || !body.trim() || submitting) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const data = new FormData();
      data.append('tieuDe', title.trim());
      data.append('noiDung', body.trim());
      if (file) data.append('file', file);
      await api('/baiviet', {method:'POST', body:data, auth:true});
      setTitle(''); setBody(''); setFile(null); setExpanded(false);
      if (picker.current) picker.current.value = '';
      setNotice('Đã đăng bài thành công.');
      onPosted();
    } catch(err) {setError(err.message || 'Không đăng được bài viết.');}
    finally {setSubmitting(false);}
  }

  if (!me) return <section id="compose" className="zs-login-nudge">
    <p>Muốn chia sẻ câu chuyện của bạn?</p>
    <Link to="/login" className="zs-cta">Đăng nhập để viết bài <ArrowRight size={16}/></Link>
  </section>;

  return <section className={'zs-composer' + (expanded ? ' is-expanded' : '')} id="compose" aria-label="Tạo bài viết">
    <div className="zs-composer-top">
      <Avatar name={me.tenDangNhap} avatar={me.avatar}/>
      <button type="button" className="zs-composer-trigger" onClick={() => {setExpanded(true);titleRef.current?.focus();}}
        aria-expanded={expanded} aria-controls="zs-composer-fields">
        {expanded ? 'Tạo bài viết' : 'Bạn đang nghĩ gì?'}
        {!expanded && <PenLine size={18} aria-hidden="true"/>}
      </button>
    </div>
    {expanded && <form id="zs-composer-fields" className="zs-composer-form" onSubmit={publish}>
      <label htmlFor="zs-post-title">Tiêu đề</label>
      <input id="zs-post-title" ref={titleRef} className="zs-input zs-title-input"
        value={title} onChange={e => setTitle(e.target.value)} maxLength={255}
        placeholder="Tiêu đề bài viết" required/>
      <label htmlFor="zs-post-body">Nội dung</label>
      <textarea id="zs-post-body" className="zs-input zs-body-input" value={body}
        onChange={e=>setBody(e.target.value)} rows={3}
        placeholder="Chia sẻ câu chuyện của bạn..." required/>
      {file && <div className="zs-composer-attachment">
        {preview && <img src={preview} alt="Xem trước ảnh đính kèm"/>}
        <span>{file.name}</span>
        <button type="button" onClick={()=>{setFile(null);if(picker.current)picker.current.value='';}} aria-label="Bỏ tệp đính kèm"><X size={17}/></button>
      </div>}
      {error && <p className="zs-error" role="alert">{error}</p>}
      <div className="zs-composer-bottom">
        <button type="button" className="zs-composer-tool" onClick={()=>picker.current?.click()} disabled={submitting}>
          <ImagePlus size={18}/> Ảnh / Video
        </button>
        <div className="zs-composer-buttons">
          <button type="button" className="zs-text-button" onClick={reset} disabled={submitting}>Hủy</button>
          <button className="zs-cta zs-cta--publish" type="submit"
            disabled={submitting || !title.trim() || !body.trim()}>
            <Send size={16}/> {submitting ? 'Đang đăng...' : 'Đăng bài'}
          </button>
        </div>
      </div>
    </form>}
    <input ref={picker} className="visually-hidden" type="file"
      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
      onChange={selectFile} aria-label="Chọn ảnh hoặc video"/>
    {!expanded && error && <p className="zs-error" role="alert">{error}</p>}
    {notice && <p className="zs-success" role="status">{notice}</p>}
  </section>;
}

function PostCard({ post, me, onDelete, selectedReaction, onReactionChange, reactionLoading }) {
  const [stats, setStats] = useState(post.reactions || null);
  const [menu, setMenu] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [copied, setCopied] = useState(false);
  const id = Number(post.id);
  const author = post.tenDangNhap || 'Thành viên ZenSpace';
  const owned = Boolean(me && (Number(me.id) === Number(post.idTaiKhoan) || me.phanQuyen === 'admin'));
  const activeReaction = reactionOptions.find(option => option.key === selectedReaction) || null;

  useEffect(() => {
    if (post.reactions) { setStats(post.reactions); return; }
    let active = true;
    api(`/camxuc/thongke/${id}`).then(result => { if (active) setStats(result); }).catch(() => {});
    return () => { active = false; };
  }, [id, post.reactions]);

  async function react(kind) {
    setBusy(true);
    setFeedback('');
    setReactionsOpen(false);
    try {
      const result = await api(`/camxuc/${id}`, { method: 'POST', auth: true, body: { loaiCamXuc: kind } });
      // The mutation response is authoritative; counts alone cannot identify the user's reaction.
      onReactionChange(id, result.action === 'deleted' ? null : kind);
      try {
        setStats(await api(`/camxuc/thongke/${id}`));
      } catch {
        setFeedback('Đã lưu cảm xúc, nhưng chưa cập nhật được lượt tương tác.');
      }
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setMenu(false);
    if (!window.confirm('Bạn có chắc muốn xóa bài viết này?')) return;
    setBusy(true);
    setFeedback('');
    try {
      await api(`/baiviet/${id}`, { method: 'DELETE', auth: true });
      onDelete?.();
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setFeedback('');
    const link = window.location.origin + '/posts/' + id;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setFeedback('Không thể sao chép liên kết. Hãy mở bài viết để chia sẻ URL.');
    }
  }

  const count = stats ? Object.values(stats).reduce((total, n) => total + (Number.isFinite(Number(n)) ? Number(n) : 0), 0) : 0;
  return (
    <article className="zs-post-card">
      <div className="zs-post-top">
        <Link className="zs-post-author-avatar" to={`/users/${post.idTaiKhoan}`} aria-label={`Xem hồ sơ ${author}`}>
          <Avatar name={author} avatar={post.avatar} size="large" />
        </Link>
        <div className="zs-post-author-text">
          <Link to={`/users/${post.idTaiKhoan}`} className="zs-post-author-name">{author}</Link>
          <div className="zs-post-meta"><time>{formatDate(post.ngayDang)}</time></div>
        </div>
        {owned && (
          <div className="zs-post-menu-wrap">
            <button type="button" className="zs-icon-button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Tùy chọn bài viết"><MoreHorizontal size={20}/></button>
            {menu && <div className="zs-post-menu"><button type="button" disabled={busy} onClick={remove}><Trash2 size={15}/> Xóa bài viết</button></div>}
          </div>
        )}
      </div>
      <div className="zs-post-content">
        <Link to={`/posts/${id}`} className="zs-post-title">{post.tieuDe}</Link>
        <p>{post.noiDung}</p>
      </div>
      <Media src={post.mediaUrl} title={post.tieuDe} />
      {count > 0 && <div className="zs-post-engagement">{count} lượt cảm xúc</div>}
      <div className="zs-post-actions">
        {me ? (
          <div className="zs-reaction-picker">
            <button
              className={'zs-post-action zs-reaction-trigger' + (activeReaction ? ' is-reacted' : '')}
              type="button"
              disabled={busy || reactionLoading}
              aria-expanded={reactionsOpen}
              aria-label={activeReaction ? `Cảm xúc của bạn: ${activeReaction.label}. Chọn để đổi hoặc hủy` : 'Chọn cảm xúc'}
              onClick={() => setReactionsOpen(!reactionsOpen)}
            >
              {activeReaction ? <span className="zs-selected-emoji" aria-hidden="true">{activeReaction.symbol}</span> : <Heart size={18}/>}
              <span>{activeReaction ? activeReaction.label : 'Cảm xúc'}</span>
              <ChevronDown size={13}/>
            </button>
            {reactionsOpen && (
              <div className="zs-reaction-menu" role="group" aria-label="Chọn cảm xúc">
                {reactionOptions.map(r => <button key={r.key} title={r.label} type="button" disabled={busy}
                  aria-pressed={selectedReaction === r.key}
                  className={selectedReaction === r.key ? 'is-selected' : ''}
                  onClick={() => react(r.key)}>
                  <span>{r.symbol}</span><small>{r.label}</small>
                </button>)}
              </div>
            )}
          </div>
        ) : <Link className="zs-post-action" to="/login"><Heart size={18}/> Cảm xúc</Link>}
        <Link className="zs-post-action" to={`/posts/${id}`}><MessageCircle size={18}/> Bình luận</Link>
        <button className="zs-post-action" type="button" onClick={share}>{copied ? <Check size={18}/> : <Share2 size={18}/>} {copied ? 'Đã sao chép' : 'Chia sẻ'}</button>
      </div>
      {feedback && <p className="zs-error zs-post-error" role="alert">{feedback}</p>}
    </article>
  );
}

function LoadingFeed() {
  return <div className="zs-skeleton-stack" role="status" aria-label="Đang tải bảng tin">
    {[0, 1].map(n => <div className="zs-skeleton-card" key={n}><div className="zs-skeleton-line zs-skeleton-line--short" /><div className="zs-skeleton-line zs-skeleton-line--title" /><div className="zs-skeleton-line" /><div className="zs-skeleton-line" /></div>)}
  </div>;
}

export default function FeedPage({me, feedMode = 'community'}) {
  const following = feedMode === 'following' && Boolean(me);
  const [refresh, setRefresh] = useState(0);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myReactions, setMyReactions] = useState({});
  const [reactionLoading, setReactionLoading] = useState(Boolean(me));
  const [reactionError, setReactionError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    api(following ? '/v1/feed' : '/baiviet', following ? {auth:true} : undefined)
      .then(result => {if(live)setPosts(Array.isArray(result.data) ? result.data : []);})
      .catch(err => {if(live)setError(err.message || 'Không tải được bài viết.');})
      .finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  }, [following,refresh]);

  // One authenticated query per feed page, rather than one query for every card.
  useEffect(() => {
    let live = true;
    if (!me || posts.length === 0 || loading) {
      setMyReactions({});
      setReactionLoading(false);
      setReactionError('');
      return () => { live = false; };
    }
    setReactionLoading(true);
    setReactionError('');
    const ids = posts.map(post => post.id).join(',');
    api('/camxuc/cua-toi?ids=' + encodeURIComponent(ids), { auth: true })
      .then(result => {
        if (live) setMyReactions(result.data && typeof result.data === 'object' ? result.data : {});
      })
      .catch(err => {
        if (live) {
          setMyReactions({});
          setReactionError('Không tải được cảm xúc đã chọn: ' + err.message);
        }
      })
      .finally(() => { if (live) setReactionLoading(false); });
    return () => { live = false; };
  }, [me?.id, posts, loading]);

  const onReactionChange = (postId, kind) => {
    setMyReactions(previous => {
      const next = { ...previous };
      if (kind) next[String(postId)] = kind;
      else delete next[String(postId)];
      return next;
    });
  };
  const reload = () => setRefresh(n=>n+1);
  return <div className="zs-feed">
    <header className="zs-feed-heading">
      <div>
        <p className="zs-feed-eyebrow"><span aria-hidden="true">✦</span> ZENSPACE / SOCIAL JOURNAL</p>
        <h1>{following ? 'Đang theo dõi' : 'Bảng tin'}</h1>
        <p className="zs-feed-description">{following
          ? 'Bài viết từ những người bạn theo dõi và từ chính bạn.'
          : 'Những câu chuyện mới nhất từ cộng đồng ZenSpace.'}</p>
      </div>
      <div className="zs-feed-emblem" aria-hidden="true"><Orbit size={45} strokeWidth={.8}/></div>
    </header>
    <Composer me={me} onPosted={reload}/>
    <div className="zs-feed-filter-bar">
      <h2>{following ? 'Bài viết đang theo dõi' : 'Bài viết mới nhất'}</h2>
      <button type="button" className="zs-refresh-button"
        onClick={reload} aria-label="Làm mới bài viết" title="Làm mới bài viết">
        <RefreshCw size={17}/>
      </button>
    </div>
    {reactionError && <p className="zs-error" role="alert">{reactionError}</p>}
    {loading ? <LoadingFeed/> : error ? <div className="zs-feed-empty">
      <h3>Không thể tải bài viết</h3><p role="alert">{error}</p>
      <button type="button" className="zs-outline-button" onClick={reload}>Thử lại <RefreshCw size={15}/></button>
    </div> : posts.length ? <div className="zs-post-list">
      {posts.map(post=><PostCard key={post.id} post={post} me={me}
        selectedReaction={myReactions[String(post.id)] || null}
        reactionLoading={reactionLoading}
        onReactionChange={onReactionChange}
        onDelete={reload}/>)}
    </div> : <div className="zs-feed-empty">
      <h3>Chưa có bài viết</h3>
      <p>{following ? 'Theo dõi thêm thành viên để đọc những câu chuyện của họ.' : 'Cộng đồng đang chờ bài viết đầu tiên.'}</p>
      <Link to="/explore" className="zs-outline-button">Khám phá thành viên <ArrowRight size={15}/></Link>
    </div>}
  </div>;
}
