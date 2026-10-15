import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import { api, getUser, saveSession, logout } from './api';
import AppShell from './components/layout/AppShell.jsx';
import FeedPage from './features/feed/FeedPage.jsx';
import MessagesPage from './features/chat/MessagesPage.jsx';
import PostActionsMenu from './features/feed/PostActionsMenu.jsx';
import { Pin } from 'lucide-react';
function useApi(url,version){const[data,setData]=useState(null),[error,setError]=useState('');useEffect(()=>{if(!url)return;let live=true;api(url, url.startsWith('/chat/') ? { auth: true } : undefined).then(d=>{if(live){setData(d);setError('')}}).catch(e=>live&&setError(e.message));return()=>{live=false}},[url,version]);return{data,error}}
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
    {p.mediaUrl&&(p.mediaUrl.toLowerCase().endsWith('.mp4')?<video controls className="post-media" src={p.mediaUrl}/>:<img className="post-media" src={p.mediaUrl} alt="Media"/>)}
    <div className="d-flex gap-2 mt-3"><Link className="btn btn-light btn-sm" to={'/posts/'+p.id}>Bình luận</Link>
      {me&&<button className="btn btn-outline-primary btn-sm" onClick={react}>♥ Like {stats?.like||0}</button>}
    </div>{err&&<p className="text-danger">{err}</p>}
  </article>;
}
function Detail({me}){const{id}=useParams(),nav=useNavigate(),[tick,setTick]=useState(0),[text,setText]=useState(''),[error,setError]=useState('');const{data}=useApi('/baiviet/'+id,tick),{data:comments}=useApi('/binhluan/'+id,tick);async function send(e){e.preventDefault();try{await api('/binhluan',{method:'POST',auth:true,body:{idBaiDang:Number(id),noiDung:text}});setText('');setTick(n=>n+1)}catch(e){setError(e.message)}}return <>{data?.data&&<Post p={data.data} me={me} reload={()=>setTick(n=>n+1)} onDeleted={()=>nav('/')}/>}<div className="card post p-3"><h5>Bình luận</h5>{comments?.map(c=><div key={c.id} className="border-bottom py-2"><Link to={'/users/'+c.idTaiKhoan}>{c.tenDangNhap}</Link><p className="post-text mb-0">{c.noiDung}</p></div>)}{me&&<form className="d-flex gap-2 mt-3" onSubmit={send}><input className="form-control" value={text} onChange={e=>setText(e.target.value)} required placeholder="Viết bình luận..."/><button className="btn btn-primary">Gửi</button></form>}{error&&<p className="text-danger">{error}</p>}</div></>}
function Profile({me}){const{id}=useParams(),[tick,setTick]=useState(0),[following,setFollowing]=useState(false),[followers,setFollowers]=useState(0),[err,setErr]=useState('');const{data,error}=useApi('/nguoidung/trangcanhan/'+id,tick);useEffect(()=>{if(me)api('/v1/users/'+id+'/follow-status',{auth:true}).then(d=>{setFollowing(d.following);setFollowers(d.followers)}).catch(()=>{})},[id,me,tick]);async function follow(){try{await api('/v1/users/'+id+'/follow',{auth:true,method:following?'DELETE':'POST'});setTick(n=>n+1)}catch(e){setErr(e.message)}}const u=data?.data?.user;return <>{(err||error)&&<p className="text-danger">{err||error}</p>}{u&&<><div className="card post p-4 mb-3"><h3>{u.tenDangNhap}</h3><p className="text-muted">{followers||u.followers||0} người theo dõi</p>{me&&Number(me.id)!==Number(id)&&<Link to={'/messages?user='+id} className="btn btn-outline-primary me-2">Nhắn tin</Link>}{me&&Number(me.id)!==Number(id)&&<button className="btn btn-primary" onClick={follow}>{following?'Bỏ theo dõi':'Theo dõi'}</button>}</div>{data.data.baiViets.map(p=><Post key={p.id} p={{...p,tenDangNhap:u.tenDangNhap,avatar:u.avatar}} me={me} reload={()=>setTick(n=>n+1)}/>)}</>}</>}
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