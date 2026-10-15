import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Compass, Heart,
  ImagePlus, MessageCircle, RefreshCw, Send, PenLine, Orbit, Pin,
  Share2, Sparkles, X
} from 'lucide-react';
import { api } from '../../api';
import { Avatar } from '../../components/layout/AppShell';
import PostActionsMenu from './PostActionsMenu.jsx';
import Composer from './Composer.jsx';
import PostMedia from './PostMedia.jsx';

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

function PostCard({ post, me, onDelete, onHidden, saved, onSavedChange, selectedReaction, onReactionChange, reactionLoading }) {
  const [stats, setStats] = useState(post.reactions || null);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [copied, setCopied] = useState(false);
  const id = Number(post.id);
  const author = post.tenDangNhap || 'Thành viên ZenSpace';
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
          <div className="zs-post-meta"><time>{formatDate(post.ngayDang)}</time>
            {post.isPinned && <span className="zs-pinned-indicator"><Pin size={12}/> Đã ghim</span>}
            {post.visibility==='followers'&&<small>· Người theo dõi</small>}
            {post.visibility==='private'&&<small>· Chỉ mình tôi</small>}
            {post.edited&&<small>· Đã chỉnh sửa</small>}
          </div>
        </div>
        <PostActionsMenu post={post} me={me} saved={saved} onSavedChange={onSavedChange}
          onHidden={onHidden} onChanged={onDelete} onDeleted={onDelete}/>
      </div>
      <div className="zs-post-content">
        <Link to={`/posts/${id}`} className="zs-post-body-link">{post.noiDung}</Link>
      </div>
      <PostMedia src={post.mediaUrl} />
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
  const savedMode = feedMode === 'saved' && Boolean(me);
  const [refresh, setRefresh] = useState(0);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myReactions, setMyReactions] = useState({});
  const [reactionLoading, setReactionLoading] = useState(Boolean(me));
  const [reactionError, setReactionError] = useState('');
  const [savedFlags, setSavedFlags] = useState({});
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    api(savedMode ? '/v1/bookmarks' : following ? '/v1/feed' : me ? '/v1/feed/public' : '/baiviet',
      me ? {auth:true} : undefined)
      .then(result => {if(live)setPosts(Array.isArray(result.data) ? result.data : []);})
      .catch(err => {if(live)setError(err.message || 'Không tải được bài viết.');})
      .finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  }, [following,savedMode,me?.id,refresh]);

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

  useEffect(() => {
    let alive=true;
    if(!me || !posts.length || loading){setSavedFlags({});return () => {alive=false};}
    api('/v1/posts/my-state?ids='+encodeURIComponent(posts.map(p=>p.id).join(',')),{auth:true})
      .then(result=>{
        if(!alive)return;
        const values=Object.fromEntries((result.data?.bookmarked || []).map(id=>[String(id),true]));
        setSavedFlags(values);
      })
      .catch(()=>{if(alive)setSavedFlags({});});
    return () => {alive=false};
  },[me?.id,posts,loading]);

  function changedBookmark(postId,enabled) {
    setSavedFlags(previous=>({...previous,[String(postId)]:enabled}));
    if(savedMode && !enabled) setPosts(previous=>previous.filter(p=>Number(p.id)!==Number(postId)));
  }
  function hiddenPost(postId){
    // Hiding removes a post from feeds, not from the user's private Saved collection.
    if(!savedMode)setPosts(previous=>previous.filter(p=>Number(p.id)!==Number(postId)));
    setNotice({id:postId});
  }
  async function undoHide() {
    if(!notice)return;
    try {
      await api('/v1/posts/'+notice.id+'/hide',{auth:true,method:'DELETE'});
      setNotice(null);setRefresh(n=>n+1);
    } catch(err){setError(err.message);}
  }
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
        <h1>{savedMode ? 'Bài viết đã lưu' : following ? 'Đang theo dõi' : 'Bảng tin'}</h1>
        <p className="zs-feed-description">{savedMode ? 'Góc lưu trữ những câu chuyện bạn muốn đọc lại.'
          : following ? 'Bài viết từ những người bạn theo dõi và từ chính bạn.'
          : 'Những câu chuyện mới nhất từ cộng đồng ZenSpace.'}</p>
      </div>
      <div className="zs-feed-emblem" aria-hidden="true"><Orbit size={45} strokeWidth={.8}/></div>
    </header>
    {!savedMode && <Composer me={me} onPosted={reload}/>}
    <div className="zs-feed-filter-bar">
      <h2>{savedMode ? 'Đã lưu gần đây' : following ? 'Bài viết đang theo dõi' : 'Bài viết mới nhất'}</h2>
      <button type="button" className="zs-refresh-button"
        onClick={reload} aria-label="Làm mới bài viết" title="Làm mới bài viết">
        <RefreshCw size={17}/>
      </button>
    </div>
    {notice && <div className="zs-undo-toast" role="status">
      <span>Đã ẩn bài khỏi bảng tin của bạn.</span>
      <button type="button" onClick={undoHide}>Hoàn tác</button>
    </div>}
    {reactionError && <p className="zs-error" role="alert">{reactionError}</p>}
    {loading ? <LoadingFeed/> : error ? <div className="zs-feed-empty">
      <h3>Không thể tải bài viết</h3><p role="alert">{error}</p>
      <button type="button" className="zs-outline-button" onClick={reload}>Thử lại <RefreshCw size={15}/></button>
    </div> : posts.length ? <div className="zs-post-list">
      {posts.map(post=><PostCard key={post.id} post={post} me={me}
        selectedReaction={myReactions[String(post.id)] || null} saved={savedFlags[String(post.id)]}
        onSavedChange={changedBookmark} onHidden={hiddenPost}
        reactionLoading={reactionLoading} onReactionChange={onReactionChange}
        onDelete={reload}/>)}
    </div> : <div className="zs-feed-empty">
      <h3>{savedMode ? 'Chưa có bài viết đã lưu' : 'Chưa có bài viết'}</h3>
      <p>{savedMode ? 'Bạn chưa lưu bài viết nào.' : following ? 'Theo dõi thêm thành viên để đọc những câu chuyện của họ.' : 'Cộng đồng đang chờ bài viết đầu tiên.'}</p>
      <Link to="/explore" className="zs-outline-button">Khám phá thành viên <ArrowRight size={15}/></Link>
    </div>}
  </div>;
}

export { PostCard };
