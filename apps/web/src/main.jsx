import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import { api, getUser, getToken, saveSession, logout } from './api';
import AppShell from './components/layout/AppShell.jsx';
import { Avatar } from './components/layout/AppShell.jsx';
import FeedPage, { PostCard } from './features/feed/FeedPage.jsx';
import MessagesPage from './features/chat/MessagesPage.jsx';
import { UserPlus, MessageCircle, Layers, Images, Orbit, Search, ArrowRight } from 'lucide-react';
import BlockedUsersPage from './features/safety/BlockedUsersPage.jsx';
import ModerationPage from './features/safety/ModerationPage.jsx';
import ManagedPostsPage from './features/feed/ManagedPostsPage.jsx';
import PostDetailPage from './features/comments/PostDetailPage.jsx';
function useApi(url,version){const[data,setData]=useState(null),[error,setError]=useState('');useEffect(()=>{if(!url)return;let live=true;api(url, getToken() ? {auth:true}:undefined).then(d=>{if(live){setData(d);setError('')}}).catch(e=>live&&setError(e.message));return()=>{live=false}},[url,version]);return{data,error}}
function Auth({onAuth}){const[register,setRegister]=useState(false),[user,setUser]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[err,setErr]=useState('');const nav=useNavigate();async function submit(e){e.preventDefault();try{const d=await api(register?'/DangKy':'/DangNhap',{method:'POST',body:register?{username:user,email,password,confirmPassword}:{TenDangNhap:user,MatKhau:password}});saveSession(d);onAuth(d.user);nav('/')}catch(e){setErr(e.message)}}return <form className="card p-4 shadow-sm auth mx-auto" onSubmit={submit}><h2 className="fw-bold">ZenSpace</h2><p className="text-muted">{register?'Tạo tài khoản':'Đăng nhập'}</p>{err&&<div className="alert alert-danger">{err}</div>}<input className="form-control mb-2" placeholder="Tên đăng nhập" value={user} onChange={e=>setUser(e.target.value)} required/>{register&&<input className="form-control mb-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>}<input className="form-control mb-2" type="password" placeholder="Mật khẩu" value={password} onChange={e=>setPassword(e.target.value)} required/>{register&&<input className="form-control mb-2" type="password" placeholder="Xác nhận mật khẩu" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/>}<button className="btn btn-primary">{register?'Đăng ký':'Đăng nhập'}</button><button className="btn btn-link" type="button" onClick={()=>setRegister(!register)}>{register?'Đã có tài khoản?':'Chưa có tài khoản?'}</button></form>}
function Profile({ me }) {
  const { id } = useParams();
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState('posts');
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(null);
  const [blockStatus, setBlockStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reactions, setReactions] = useState({});
  const [reactionLoading, setReactionLoading] = useState(Boolean(me));
  const { data, error: loadError } = useApi('/nguoidung/trangcanhan/' + id, refresh);
  const person = data?.data?.user;
  const posts = Array.isArray(data?.data?.baiViets) ? data.data.baiViets : [];
  const isSelf = Boolean(me && Number(me.id) === Number(id));
  const isOther = Boolean(me && !isSelf);
  const blocked = Boolean(blockStatus?.blocked || blockStatus?.blockedBy);

  useEffect(() => { setTab('posts'); setFeedback(''); }, [id]);
  useEffect(() => {
    let live = true;
    setBlockStatus(null);
    setFollowers(null);
    if (!isOther) return () => { live = false; };
    api('/v1/users/' + id + '/follow-status', { auth: true })
      .then(result => { if (live) { setFollowing(Boolean(result.following)); setFollowers(result.followers); } })
      .catch(err => { if (live) setFeedback(err.message); });
    api('/v1/users/' + id + '/block-status', { auth: true })
      .then(result => { if (live) setBlockStatus(result); })
      .catch(err => { if (live) setFeedback(err.message); });
    return () => { live = false; };
  }, [id, me?.id, isOther, refresh]);

  useEffect(() => {
    let live = true;
    setReactions({});
    if (!me || !person || posts.length === 0) {
      setReactionLoading(false);
      return () => { live = false; };
    }
    setReactionLoading(true);
    const ids = posts.map(post => post.id).join(',');
    api('/camxuc/cua-toi?ids=' + encodeURIComponent(ids), { auth: true })
      .then(result => { if (live) setReactions(result.data || {}); })
      .catch(err => { if (live) setFeedback('Không tải được cảm xúc: ' + err.message); })
      .finally(() => { if (live) setReactionLoading(false); });
    return () => { live = false; };
  }, [data, me?.id]);

  async function toggleFollow() {
    if (busy) return;
    setBusy(true); setFeedback('');
    try {
      await api('/v1/users/' + id + '/follow', { auth: true, method: following ? 'DELETE' : 'POST' });
      setFollowing(current => !current);
      setFollowers(current => current === null ? current : Math.max(0, current + (following ? -1 : 1)));
      setRefresh(value => value + 1);
    } catch (err) { setFeedback(err.message); }
    finally { setBusy(false); }
  }

  async function toggleBlock() {
    if (busy || !blockStatus) return;
    const next = !blockStatus.blocked;
    if (next && !window.confirm('Chặn tài khoản này? Quan hệ theo dõi sẽ bị hủy.')) return;
    setBusy(true); setFeedback('');
    try {
      await api('/v1/users/' + id + '/block', { auth: true, method: next ? 'PUT' : 'DELETE' });
      setBlockStatus(value => ({ ...value, blocked: next }));
      setRefresh(value => value + 1);
    } catch (err) { setFeedback(err.message); }
    finally { setBusy(false); }
  }

  function reactionChanged(postId, kind) {
    setReactions(current => {
      const next = { ...current };
      if (kind) next[String(postId)] = kind;
      else delete next[String(postId)];
      return next;
    });
  }

  const visiblePosts = tab === 'media' ? posts.filter(post => Boolean(post.mediaUrl)) : posts;
  const count = followers ?? person?.followers ?? 0;
  return <div className="zs-profile-page">
    {(feedback || loadError) && <p className="zs-error" role="alert">{feedback || loadError}</p>}
    {!person && !loadError && <p className="zs-panel-status" role="status">Đang tải không gian cá nhân...</p>}
    {person && <>
      <section className="zs-profile-hero" aria-label={'Hồ sơ của ' + person.tenDangNhap}>
        <div className="zs-profile-cover" aria-hidden="true">
          <span className="zs-profile-orbit zs-profile-orbit--one" />
          <span className="zs-profile-orbit zs-profile-orbit--two" />
          <span className="zs-profile-star zs-profile-star--one" />
          <span className="zs-profile-star zs-profile-star--two" />
        </div>
        <div className="zs-profile-info">
          <div className="zs-profile-avatar"><Avatar name={person.tenDangNhap} avatar={person.avatar} size="large" /></div>
          <div className="zs-profile-identity">
            <p className="zs-profile-eyebrow">KHÔNG GIAN CÁ NHÂN · ZENSPACE</p>
            <h1>{person.tenDangNhap}</h1>
            <p className="zs-profile-subtitle">{isSelf ? 'Không gian của bạn trên ZenSpace' : 'Một thành viên trong cộng đồng ZenSpace'}</p>
            <div className="zs-profile-stats">
              <span><strong>{count}</strong> người theo dõi</span>
              <span><strong>{person.following ?? 0}</strong> đang theo dõi</span>
            </div>
          </div>
          <div className="zs-profile-actions">
            {isOther && blockStatus && !blocked && <>
              <button type="button" className="zs-nebula-button zs-nebula-button--primary" onClick={toggleFollow} disabled={busy}>
                <UserPlus size={17}/>{following ? 'Bỏ theo dõi' : 'Theo dõi'}
              </button>
              <Link to={'/messages?user=' + id} className="zs-nebula-button zs-nebula-button--secondary"><MessageCircle size={17}/> Nhắn tin</Link>
            </>}
            {isOther && blockStatus && <button type="button" className="zs-profile-block" disabled={busy} onClick={toggleBlock}>
              {blockStatus.blocked ? 'Bỏ chặn tài khoản' : 'Chặn tài khoản'}
            </button>}
          </div>
        </div>
        {isOther && blocked && <p className="zs-profile-notice" role="status">{blockStatus?.blocked ? 'Bạn đã chặn tài khoản này.' : 'Tài khoản này đã chặn bạn.'}</p>}
      </section>
      {!blocked && <>
        <nav className="zs-profile-tabs" aria-label="Nội dung hồ sơ">
          <button type="button" className={tab === 'posts' ? 'is-active' : ''} aria-current={tab === 'posts' ? 'page' : undefined} onClick={() => setTab('posts')}><Layers size={17}/> Bài viết</button>
          <button type="button" className={tab === 'media' ? 'is-active' : ''} aria-current={tab === 'media' ? 'page' : undefined} onClick={() => setTab('media')}><Images size={17}/> Ảnh & video</button>
        </nav>
        <div className="zs-profile-feed">
          {visiblePosts.length ? visiblePosts.map(post => (
            <PostCard key={post.id} post={{ ...post, tenDangNhap: person.tenDangNhap, avatar: person.avatar }}
              me={me} selectedReaction={reactions[String(post.id)] || null} reactionLoading={reactionLoading}
              onReactionChange={reactionChanged} onSavedChange={() => setRefresh(value => value + 1)}
              onHidden={() => setRefresh(value => value + 1)} onDelete={() => setRefresh(value => value + 1)} />
          )) : <div className="zs-nebula-empty"><Orbit size={29} aria-hidden="true"/>
            <h2>{tab === 'media' ? 'Chưa có ảnh hoặc video' : 'Chưa có bài viết'}</h2>
            <p>{tab === 'media' ? 'Những khoảnh khắc được chia sẻ sẽ xuất hiện ở đây.' : 'Không gian này đang chờ câu chuyện đầu tiên.'}</p>
          </div>}
        </div>
      </>}
    </>}
  </div>;
}
function Explore() {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = window.setTimeout(() => setTerm(query.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [query]);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    const url = term.length >= 2 ? '/timkiemnguoidung?key=' + encodeURIComponent(term) : '/timkiemnguoidung';
    api(url)
      .then(result => { if (live) setMembers(Array.isArray(result.data) ? result.data : []); })
      .catch(err => { if (live) setError(err.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [term]);
  const shown = query.trim().length === 1
    ? members.filter(person => person.tenDangNhap?.toLowerCase().includes(query.trim().toLowerCase()))
    : members;
  return <div className="zs-explore-page">
    <header className="zs-explore-heading">
      <p className="zs-profile-eyebrow">ZENSPACE / KHÁM PHÁ</p>
      <h1>Khám phá thành viên</h1>
      <p>Kết nối với những người bạn muốn đồng hành.</p>
    </header>
    <div className="zs-explore-search">
      <Search size={20} aria-hidden="true"/>
      <label className="visually-hidden" htmlFor="zs-explore-query">Tìm kiếm thành viên</label>
      <input id="zs-explore-query" type="search" value={query} onChange={event => setQuery(event.target.value)}
        placeholder="Tìm thành viên theo tên..." autoComplete="off" />
    </div>
    {loading && <p className="zs-panel-status" role="status">Đang tìm kiếm thành viên...</p>}
    {error && <p className="zs-error" role="alert">Không tải được danh sách thành viên: {error}</p>}
    {!loading && !error && <>
      <h2 className="zs-explore-section-title">{query.trim() ? 'Kết quả tìm kiếm' : 'Thành viên cộng đồng'}</h2>
      {shown.length ? <div className="zs-member-grid">
        {shown.map(person => <article className="zs-member-card" key={person.id}>
          <div className="zs-member-avatar"><Avatar name={person.tenDangNhap} avatar={person.avatar} size="large"/></div>
          <div className="zs-member-info">
            <h3><Link to={'/users/' + person.id}>{person.tenDangNhap}</Link></h3>
            <p>Thành viên ZenSpace</p>
          </div>
          <Link className="zs-member-action" to={'/users/' + person.id}>Xem hồ sơ <ArrowRight size={15}/></Link>
        </article>)}
      </div> : <div className="zs-nebula-empty"><Search size={29} aria-hidden="true"/>
        <h2>Không tìm thấy thành viên</h2><p>Hãy thử một tên khác để khám phá cộng đồng.</p></div>}
    </>}
  </div>;
}
function App() {
  const [me, setMe] = useState(getUser());
  const navigate = useNavigate();
  function handleLogout() {
    logout();
    setMe(null);
    navigate('/login');
  }
  return (
    <AppShell me={me} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<FeedPage me={me} />} />
        <Route path="/following" element={me ? <FeedPage me={me} feedMode="following" /> : <Auth onAuth={setMe}/>} />
        <Route path="/saved" element={me ? <FeedPage me={me} feedMode="saved" /> : <Auth onAuth={setMe}/>} />
        <Route path="/archive" element={me?<ManagedPostsPage state="archived"/>:<Auth onAuth={setMe}/>} />
        <Route path="/trash" element={me?<ManagedPostsPage state="trashed"/>:<Auth onAuth={setMe}/>} />
        <Route path="/blocked" element={me ? <BlockedUsersPage/> : <Auth onAuth={setMe}/>} />
        <Route path="/moderation" element={me?.phanQuyen === 'admin' ? <ModerationPage me={me}/> : <div className="zs-not-found">Không có quyền truy cập.</div>} />
        <Route path="/login" element={<Auth onAuth={setMe} />} />
        <Route path="/posts/:id" element={<PostDetailPage me={me} />} />
        <Route path="/users/:id" element={<Profile me={me} />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/messages" element={me ? <MessagesPage me={me} /> : <Auth onAuth={setMe} />} />
        <Route path="*" element={<div className="zs-not-found"><h2>Lạc giữa những vì sao?</h2><p>Trang bạn tìm không tồn tại.</p><Link to="/">Quay về bảng tin →</Link></div>} />
      </Routes>
    </AppShell>
  );
}
createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);