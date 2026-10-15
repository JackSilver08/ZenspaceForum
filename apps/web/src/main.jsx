import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import { api, getUser, getToken, saveSession, logout } from './api';
import AppShell from './components/layout/AppShell.jsx';
import FeedPage from './features/feed/FeedPage.jsx';
import MessagesPage from './features/chat/MessagesPage.jsx';
import PostActionsMenu from './features/feed/PostActionsMenu.jsx';
import { Pin } from 'lucide-react';
import BlockedUsersPage from './features/safety/BlockedUsersPage.jsx';
import ModerationPage from './features/safety/ModerationPage.jsx';
import ManagedPostsPage from './features/feed/ManagedPostsPage.jsx';
import PostMedia from './features/feed/PostMedia.jsx';
function useApi(url,version){const[data,setData]=useState(null),[error,setError]=useState('');useEffect(()=>{if(!url)return;let live=true;api(url, getToken() ? {auth:true}:undefined).then(d=>{if(live){setData(d);setError('')}}).catch(e=>live&&setError(e.message));return()=>{live=false}},[url,version]);return{data,error}}
function Auth({onAuth}){const[register,setRegister]=useState(false),[user,setUser]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[err,setErr]=useState('');const nav=useNavigate();async function submit(e){e.preventDefault();try{const d=await api(register?'/DangKy':'/DangNhap',{method:'POST',body:register?{username:user,email,password,confirmPassword}:{TenDangNhap:user,MatKhau:password}});saveSession(d);onAuth(d.user);nav('/')}catch(e){setErr(e.message)}}return <form className="card p-4 shadow-sm auth mx-auto" onSubmit={submit}><h2 className="fw-bold">ZenSpace</h2><p className="text-muted">{register?'Tạo tài khoản':'Đăng nhập'}</p>{err&&<div className="alert alert-danger">{err}</div>}<input className="form-control mb-2" placeholder="Tên đăng nhập" value={user} onChange={e=>setUser(e.target.value)} required/>{register&&<input className="form-control mb-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>}<input className="form-control mb-2" type="password" placeholder="Mật khẩu" value={password} onChange={e=>setPassword(e.target.value)} required/>{register&&<input className="form-control mb-2" type="password" placeholder="Xác nhận mật khẩu" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/>}<button className="btn btn-primary">{register?'Đăng ký':'Đăng nhập'}</button><button className="btn btn-link" type="button" onClick={()=>setRegister(!register)}>{register?'Đã có tài khoản?':'Chưa có tài khoản?'}</button></form>}
function Post({p,me,reload,onDeleted}) {
  const [stats,setStats]=useState(p.reactions||null),[err,setErr]=useState('');
  useEffect(()=>{if(p.reactions){setStats(p.reactions);return;}api('/camxuc/thongke/'+p.id).then(setStats).catch(()=>{})},[p.id,p.reactions]);
  async function react(){
    try{await api('/camxuc/'+p.id,{auth:true,method:'POST',body:{loaiCamXuc:'like'}});setStats(await api('/camxuc/thongke/'+p.id))}
    catch(e){setErr(e.message)}
  }
  return <article className="card post p-3 mb-3">
    <div className="d-flex justify-content-between align-items-start">
      <div><Link className="fw-bold" to={'/users/'+p.idTaiKhoan}>{p.tenDangNhap||'Thành viên'}</Link>
        <small className="text-muted d-block">{new Date(p.ngayDang).toLocaleString('vi-VN')}</small>
        {p.isPinned && <span className="zs-pinned-indicator"><Pin size={13}/> Đã ghim</span>}
      </div>
      <PostActionsMenu post={p} me={me} onChanged={reload} onDeleted={onDeleted || reload}/>
    </div>
    <p className="post-text mt-3"><Link className="zs-legacy-post-content-link" to={'/posts/'+p.id}>{p.noiDung}</Link></p>
    {p.mediaUrl&&<PostMedia src={p.mediaUrl} className="post-media-wrapper"/>}
    <div className="d-flex gap-2 mt-3"><Link className="btn btn-light btn-sm" to={'/posts/'+p.id}>Bình luận</Link>
      {me&&<button className="btn btn-outline-primary btn-sm" onClick={react}>♥ Like {stats?.like||0}</button>}
    </div>{err&&<p className="text-danger">{err}</p>}
  </article>;
}
function Detail({me}){
  const {id}=useParams(),nav=useNavigate();
  const [tick,setTick]=useState(0),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const {data, error:postError}=useApi('/baiviet/'+id,tick);
  const {data:comments}=useApi('/binhluan/'+id,tick);
  const post=data?.data;
  async function send(e){
    e.preventDefault();setError('');setBusy(true);
    try{await api('/binhluan',{method:'POST',auth:true,body:{idBaiDang:Number(id),noiDung:text}});
      setText('');setTick(n=>n+1)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function removeComment(cid){
    if(!window.confirm('Xóa bình luận này?'))return;
    try{await api('/binhluan/'+cid,{method:'DELETE',auth:true});setTick(n=>n+1)}
    catch(e){setError(e.message)}
  }
  return <>
    {postError && <p className="zs-error" role="alert">{postError}</p>}
    {post && <Post p={post} me={me} reload={()=>setTick(n=>n+1)} onDeleted={()=>nav('/')}/>}
    <section className="card post p-3" aria-label="Bình luận bài viết">
      <h5>Bình luận</h5>
      {Array.isArray(comments) && comments.length===0 && <p>Chưa có bình luận.</p>}
      {Array.isArray(comments) && comments.map(c=><div key={c.id} className="border-bottom py-2">
        <div className="d-flex justify-content-between gap-2">
          <Link to={'/users/'+c.idTaiKhoan}>{c.tenDangNhap}</Link>
          {me && (Number(me.id)===Number(c.idTaiKhoan) || Number(me.id)===Number(post?.idTaiKhoan) || me.phanQuyen==='admin') &&
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={()=>removeComment(c.id)}>Xóa bình luận</button>}
        </div>
        <p className="post-text mb-0">{c.noiDung}</p>
      </div>)}
      {post?.commentsEnabled===false ? <p className="zs-comment-closed" role="status">Tác giả đã tắt bình luận cho bài viết này.</p>
        : me && <form className="d-flex gap-2 mt-3" onSubmit={send}>
            <input className="form-control" value={text} onChange={e=>setText(e.target.value)} maxLength={10000}
              required placeholder="Viết bình luận..."/>
            <button className="btn btn-primary" type="submit" disabled={busy||!text.trim()}>{busy?'Đang gửi...':'Gửi'}</button>
          </form>}
      {error&&<p className="zs-error" role="alert">{error}</p>}
    </section>
  </>;
}
function Profile({me}){
  const {id}=useParams();
  const [tick,setTick]=useState(0),[following,setFollowing]=useState(false);
  const [followers,setFollowers]=useState(0),[blockStatus,setBlockStatus]=useState(null);
  const [err,setErr]=useState('');
  const {data,error}=useApi('/nguoidung/trangcanhan/'+id,tick);
  useEffect(()=>{
    let active=true;
    setBlockStatus(null);
    if(!me || Number(me.id)===Number(id))return()=>{active=false};
    api('/v1/users/'+id+'/follow-status',{auth:true})
      .then(r=>{if(active){setFollowing(r.following);setFollowers(r.followers)}}).catch(()=>{});
    api('/v1/users/'+id+'/block-status',{auth:true})
      .then(r=>{if(active)setBlockStatus(r)}).catch(e=>{if(active)setErr(e.message)});
    return()=>{active=false};
  },[id,me?.id,tick]);
  async function follow(){
    try{await api('/v1/users/'+id+'/follow',{auth:true,method:following?'DELETE':'POST'});
      setTick(n=>n+1)}catch(e){setErr(e.message)}
  }
  async function toggleBlock(){
    const next=!blockStatus?.blocked;
    if(next && !window.confirm('Chặn tài khoản này? Hai người sẽ không thể tương tác; quan hệ theo dõi bị xóa.'))return;
    try{
      await api('/v1/users/'+id+'/block',{auth:true,method:next?'PUT':'DELETE'});
      setBlockStatus(previous=>({...previous,blocked:next}));setTick(n=>n+1);
    }catch(e){setErr(e.message)}
  }
  const u=data?.data?.user, blocked=Boolean(blockStatus?.blocked || blockStatus?.blockedBy);
  const stranger=Boolean(me && Number(me.id)!==Number(id));
  return <>{(err||error)&&<p className="zs-error" role="alert">{err||error}</p>}
    {u && <>
      <div className="card post p-4 mb-3">
        <h3>{u.tenDangNhap}</h3>
        <p className="text-muted">{followers||u.followers||0} người theo dõi</p>
        {stranger && blockStatus?.blocked && <p className="zs-comment-closed">Bạn đã chặn tài khoản này.</p>}
        {stranger && blockStatus?.blockedBy && <p className="zs-comment-closed">Tài khoản này đã chặn bạn.</p>}
        {stranger && !blocked && <Link to={'/messages?user='+id} className="btn btn-outline-primary me-2">Nhắn tin</Link>}
        {stranger && !blocked && <button type="button" className="btn btn-primary me-2" onClick={follow}>{following?'Bỏ theo dõi':'Theo dõi'}</button>}
        {stranger && <button type="button" className="btn btn-outline-danger" onClick={toggleBlock}>{blockStatus?.blocked?'Bỏ chặn':'Chặn tài khoản'}</button>}
      </div>
      {blocked ? <p className="zs-comment-closed">Bài viết của thành viên không được hiển thị khi quan hệ chặn đang có hiệu lực.</p>
        : data.data.baiViets.map(p=><Post key={p.id} p={{...p,tenDangNhap:u.tenDangNhap,avatar:u.avatar}}
            me={me} reload={()=>setTick(n=>n+1)}/>)}
    </>}
  </>;
}
function Explore(){const[q,setQ]=useState(''),[term,setTerm]=useState('');const{data}=useApi(term?'/timkiemnguoidung?key='+encodeURIComponent(term):'/timkiemnguoidung');return <><h3>Khám phá thành viên</h3><form className="d-flex gap-2" onSubmit={e=>{e.preventDefault();setTerm(q)}}><input className="form-control" value={q} onChange={e=>setQ(e.target.value)} minLength={2} placeholder="Tìm tên"/><button className="btn btn-primary">Tìm</button></form>{data?.data?.map(u=><div className="card p-3 mt-2" key={u.id}><Link to={'/users/'+u.id}>{u.tenDangNhap}</Link></div>)}</>}
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
        <Route path="/posts/:id" element={<Detail me={me} />} />
        <Route path="/users/:id" element={<Profile me={me} />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/messages" element={me ? <MessagesPage me={me} /> : <Auth onAuth={setMe} />} />
        <Route path="*" element={<div className="zs-not-found"><h2>Lạc giữa những vì sao?</h2><p>Trang bạn tìm không tồn tại.</p><Link to="/">Quay về bảng tin →</Link></div>} />
      </Routes>
    </AppShell>
  );
}
createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);