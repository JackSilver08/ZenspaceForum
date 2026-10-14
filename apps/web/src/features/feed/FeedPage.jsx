import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Compass, Heart,
  ImagePlus, MessageCircle, MoreHorizontal, RefreshCw, Send,
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
  const [expanded, setExpanded] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const picker = useRef(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.size > 20 * 1024 * 1024) {
      setError('Tệp quá lớn. Giới hạn tải lên là 20 MB.');
      event.target.value = '';
      return;
    }
    const valid = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];
    if (!valid.includes(selected.type)) {
      setError('Chỉ hỗ trợ JPG, PNG, WEBP, GIF hoặc MP4.');
      event.target.value = '';
      return;
    }
    setError('');
    setFile(selected);
    setExpanded(true);
  }

  function clearFile() {
    setFile(null);
    if (picker.current) picker.current.value = '';
  }

  async function publish(event) {
    event.preventDefault();
    if (!title.trim() || !body.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('tieuDe', title.trim());
      form.append('noiDung', body.trim());
      if (file) form.append('file', file);
      await api('/baiviet', { method: 'POST', body: form, auth: true });
      setTitle('');
      setBody('');
      clearFile();
      setExpanded(false);
      onPosted();
    } catch (err) {
      setError(err.message || 'Không thể đăng bài.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!me) {
    return (
      <section id="compose" className="zs-login-nudge">
        <div className="zs-login-nudge-icon"><Sparkles size={20} /></div>
        <div>
          <strong>Câu chuyện tiếp theo có thể là của bạn.</strong>
          <p>Đăng nhập để viết bài và kết nối cùng cộng đồng.</p>
        </div>
        <Link to="/login" className="zs-cta">Tham gia <ArrowUpRight size={16} /></Link>
      </section>
    );
  }

  return (
    <section id="compose" className={`zs-composer ${expanded ? 'is-expanded' : ''}`} aria-label="Viết bài mới">
      <div className="zs-composer-top">
        <Avatar name={me.tenDangNhap} avatar={me.avatar} size="large" />
        <button type="button" className="zs-composer-trigger" onClick={() => setExpanded(true)}>
          {expanded ? 'Viết một câu chuyện mới...' : `${me.tenDangNhap || 'Bạn'} ơi, hôm nay có gì mới?`}
          <span className="zs-composer-trigger-icon"><Sparkles size={18} /></span>
        </button>
      </div>
      {expanded && (
        <form className="zs-composer-form" onSubmit={publish}>
          <input className="zs-input zs-title-input" maxLength={255} required value={title} onChange={e => setTitle(e.target.value)} placeholder="Đặt tên cho câu chuyện của bạn..." aria-label="Tiêu đề bài viết" />
          <textarea className="zs-input zs-body-input" rows={4} required value={body} onChange={e => setBody(e.target.value)} placeholder="Một suy nghĩ, một câu chuyện, một góc nhìn..." aria-label="Nội dung bài viết" />
          {file && (
            <div className="zs-composer-attachment">
              {preview && <img src={preview} alt="Xem trước ảnh đính kèm" />}
              <span>{file.name}</span>
              <button type="button" onClick={clearFile} aria-label="Bỏ tệp đính kèm"><X size={17} /></button>
            </div>
          )}
          {error && <p className="zs-error" role="alert">{error}</p>}
          <div className="zs-composer-bottom">
            <button type="button" className="zs-text-button" onClick={() => setExpanded(false)} disabled={submitting}>Thu gọn</button>
            <button className="zs-cta zs-cta--publish" disabled={submitting || !title.trim() || !body.trim()} type="submit">
              <Send size={15} /> {submitting ? 'Đang đăng...' : 'Đăng bài'}
            </button>
          </div>
        </form>
      )}
      <div className="zs-composer-toolbar">
        <button type="button" className="zs-composer-tool" onClick={() => { setExpanded(true); picker.current?.click(); }}>
          <span className="zs-tool-icon"><ImagePlus size={18} /></span> Ảnh / Video
        </button>
        <input ref={picker} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" onChange={selectFile} aria-label="Chọn ảnh hoặc video" />
        <span className="zs-composer-hint">Cảm hứng được lan tỏa <span aria-hidden="true">✦</span></span>
      </div>
      {!expanded && error && <p className="zs-error" role="alert">{error}</p>}
    </section>
  );
}

function PostCard({ post, me, onDelete }) {
  const [stats, setStats] = useState(post.reactions || null);
  const [menu, setMenu] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [copied, setCopied] = useState(false);
  const id = Number(post.id);
  const author = post.tenDangNhap || 'Thành viên ZenSpace';
  const owned = Boolean(me && (Number(me.id) === Number(post.idTaiKhoan) || me.phanQuyen === 'admin'));

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
      await api(`/camxuc/${id}`, { method: 'POST', auth: true, body: { loaiCamXuc: kind } });
      setStats(await api(`/camxuc/thongke/${id}`));
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
          <div className="zs-post-meta"><span>{formatDate(post.ngayDang)}</span><span className="zs-meta-separator">·</span><span>Công khai</span></div>
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
      {Array.from(new Set((String(post.noiDung || '').match(/#[\p{L}\p{N}_]+/gu) || []))).slice(0, 4).length > 0 && (
        <div className="zs-post-tags">
          {Array.from(new Set((String(post.noiDung || '').match(/#[\p{L}\p{N}_]+/gu) || []))).slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}
        </div>
      )}
      <div className="zs-post-engagement">
        <span><span className="zs-reaction-flame" aria-hidden="true">♥</span>{count ? `${count} lượt cảm xúc` : 'Hãy là người đầu tiên tương tác'}</span>
        <Link to={`/posts/${id}`}>Xem bài viết <ArrowUpRight size={13}/></Link>
      </div>
      <div className="zs-post-actions">
        {me ? (
          <div className="zs-reaction-picker">
            <button className="zs-post-action" type="button" disabled={busy} aria-expanded={reactionsOpen} onClick={() => setReactionsOpen(!reactionsOpen)}><Heart size={18}/> Cảm xúc <ChevronDown size={13}/></button>
            {reactionsOpen && (
              <div className="zs-reaction-menu" role="group" aria-label="Chọn cảm xúc">
                {reactionOptions.map(r => <button key={r.key} title={r.label} type="button" onClick={() => react(r.key)}><span>{r.symbol}</span><small>{r.label}</small></button>)}
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

export default function FeedPage({ me }) {
  const [mode, setMode] = useState('community');
  const [refresh, setRefresh] = useState(0);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const following = mode === 'following' && Boolean(me);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api(following ? '/v1/feed' : '/baiviet', following ? { auth: true } : undefined)
      .then(result => {
        if (!active) return;
        setPosts(Array.isArray(result.data) ? result.data : []);
      })
      .catch(err => { if (active) setError(err.message || 'Không tải được bảng tin.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [following, refresh]);

  const reload = () => setRefresh(number => number + 1);
  useEffect(() => {
    if (window.location.hash === '#compose') {
      window.requestAnimationFrame(() => document.getElementById('compose')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
  }, []);
  return (
    <div className="zs-feed">
      <section className="zs-feed-intro" aria-labelledby="zs-feed-headline">
        <div className="zs-hero-orbits" aria-hidden="true">
          <svg viewBox="0 0 340 340"><circle cx="170" cy="170" r="148" strokeDasharray="2 5"/><circle cx="170" cy="170" r="99"/><circle cx="170" cy="170" r="55" strokeDasharray="6 5"/><path d="M15 170H325M170 15V325"/><circle cx="236" cy="96" r="4" className="zs-hero-node"/><circle cx="102" cy="245" r="3" className="zs-hero-node"/></svg>
        </div>
        <div className="zs-feed-intro-top">
          <span className="zs-feed-eyebrow"><span aria-hidden="true">✦</span> KHÔNG GIAN ĐỐI THOẠI</span>
          <span className="zs-hero-coordinates">ZENSPACE · CELESTIAL JOURNAL</span>
        </div>
        <h1 id="zs-feed-headline">Những câu chuyện. <em>Những kết nối.</em></h1>
        <p>Nơi mỗi suy nghĩ tìm thấy một người đồng điệu giữa muôn trùng vì sao. Một không gian dành cho những tâm hồn trân trọng chiều sâu.</p>
        <div className="zs-hero-footer">
          <span><span className="zs-hero-foot-dot"/> Chia sẻ góc nhìn</span>
          <span><Sparkles size={13}/> Khám phá cộng đồng</span>
        </div>
      </section>

      <Composer me={me} onPosted={reload}/>

      <div className="zs-feed-filter-bar">
        <div>
          <div className="zs-feed-mini-label">DISCOVER & CONNECT</div>
          <h2>Khám phá bảng tin</h2>
        </div>
        <button type="button" className="zs-refresh-button" title="Làm mới bảng tin" aria-label="Làm mới bảng tin" onClick={reload}><RefreshCw size={17}/></button>
      </div>
      <div className="zs-feed-tabs" role="group" aria-label="Chế độ hiển thị bảng tin">
        <button type="button" className={mode === 'community' ? 'is-selected' : ''} aria-pressed={mode === 'community'} onClick={() => setMode('community')}><Compass size={16}/> Cộng đồng</button>
        {me && <button type="button" className={mode === 'following' ? 'is-selected' : ''} aria-pressed={mode === 'following'} onClick={() => setMode('following')}><Heart size={16}/> Đang theo dõi</button>}
      </div>

      {loading ? <LoadingFeed/> : error ? (
        <div className="zs-feed-empty"><span className="zs-empty-star">✦</span><h3>Chưa thể tải bảng tin</h3><p role="alert">{error}</p><button type="button" className="zs-outline-button" onClick={reload}>Thử lại <RefreshCw size={15}/></button></div>
      ) : posts.length ? (
        <div className="zs-post-list">{posts.map(post => <PostCard key={post.id} post={post} me={me} onDelete={reload} />)}</div>
      ) : (
        <div className="zs-feed-empty"><span className="zs-empty-star">✦</span><h3>Không gian còn đang chờ câu chuyện</h3><p>{following ? 'Hãy theo dõi thêm thành viên để thấy những bài viết từ họ.' : 'Chưa có bài viết nào. Hãy là người mở đầu nhé.'}</p><Link to="/explore" className="zs-outline-button">Khám phá thành viên <ArrowRight size={15}/></Link></div>
      )}
      <div className="zs-feed-end"><span>✦</span> YOU ARE PART OF THE UNIVERSE <span>✦</span></div>
    </div>
  );
}
