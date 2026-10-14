import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ArrowRight, Compass, Home, LogIn, LogOut, MessageCircle,
  PenLine, Search, UserRound, Users, Orbit, ChevronDown
} from 'lucide-react';
import { api } from '../../api';

const links = [
  { to: '/', label: 'Bảng tin', icon: Home, end: true },
  { to: '/following', label: 'Đang theo dõi', icon: Users, private: true },
  { to: '/explore', label: 'Khám phá', icon: Compass },
  { to: '/messages', label: 'Tin nhắn', icon: MessageCircle, private: true },
];

function Avatar({ name, avatar, size = 'normal' }) {
  const fallback = String(name || 'Z').trim().slice(0, 2).toUpperCase();
  let src = avatar || '';
  if (/(?:^|\/)ZenUser\.png$/i.test(src)) src = '';
  if (src.startsWith('IMG/')) src = '/' + src;
  return <span className={'zs-avatar zs-avatar--' + size} aria-hidden="true">
    {src ? <img src={src} alt="" loading="lazy"/> : fallback}
  </span>;
}

function Brand() {
  return <Link to="/" className="zs-brand" aria-label="ZenSpace, về bảng tin">
    <span className="zs-brand-mark" aria-hidden="true">
      <span className="zs-brand-orbit"/><span className="zs-brand-core"/>
    </span>
    <span className="zs-brand-label"><strong>ZenSpace</strong><small>YOUR SPACE TO CONNECT</small></span>
  </Link>;
}

function NavigationLink({ to, label, icon: Icon, end = false }) {
  return <NavLink to={to} end={end} className={({isActive}) => 'zs-nav-item' + (isActive ? ' is-active' : '')}>
    <Icon size={19} strokeWidth={1.8} aria-hidden="true"/>
    <span>{label}</span>
  </NavLink>;
}

function AccountMenu({ me, onLogout }) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  useEffect(() => { setExpanded(false); }, [location.pathname]);
  if (!me) return <Link to="/login" className="zs-topbar-write"><LogIn size={16}/> Đăng nhập</Link>;
  return <div className="zs-account-wrap">
    <button type="button" className="zs-account-trigger" aria-expanded={expanded}
      aria-label="Mở menu tài khoản" onClick={() => setExpanded(v=>!v)}>
      <Avatar name={me.tenDangNhap} avatar={me.avatar} size="small"/>
      <span className="zs-account-name">{me.tenDangNhap}</span><ChevronDown size={15} aria-hidden="true"/>
    </button>
    {expanded && <div className="zs-account-menu">
      <Link to={'/users/' + me.id} onClick={() => setExpanded(false)}><UserRound size={17}/> Trang cá nhân</Link>
      <button type="button" onClick={() => {setExpanded(false);onLogout();}}><LogOut size={17}/> Đăng xuất</button>
    </div>}
  </div>;
}

function CommunitySuggestions({ me }) {
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let live = true;
    api('/timkiemnguoidung').then(result=>{
      if (!live) return;
      setMembers((Array.isArray(result.data) ? result.data : [])
        .filter(member => !me || Number(member.id) !== Number(me.id)).slice(0, 4));
      setStatus('ready');
    }).catch(() => { if(live) setStatus('error'); });
    return () => {live=false;};
  }, [me?.id]);
  return <section className="zs-suggest-card" aria-labelledby="zs-suggest-heading">
    <div className="zs-suggest-heading">
      <span className="zs-small-orbit" aria-hidden="true"><Orbit size={19}/></span>
      <span className="zs-kicker">KHÁM PHÁ</span>
      <h2 id="zs-suggest-heading">Kết nối mới</h2>
      <p>Gặp gỡ những người bạn có thể muốn theo dõi.</p>
    </div>
    {status==='loading' && <p className="zs-panel-status" role="status">Đang tải thành viên...</p>}
    {status==='error' && <p className="zs-panel-status">Chưa tải được gợi ý. Bạn vẫn có thể tìm thành viên.</p>}
    {status==='ready' && !members.length && <p className="zs-panel-status">Chưa có thành viên phù hợp.</p>}
    <div className="zs-suggest-list">
      {members.map(person=><Link to={'/users/'+person.id} key={person.id} className="zs-suggest-person">
        <Avatar name={person.tenDangNhap} avatar={person.avatar}/>
        <span>{person.tenDangNhap}</span><ArrowRight size={16} aria-hidden="true"/>
      </Link>)}
    </div>
    <Link to="/explore" className="zs-suggest-explore">Tìm thêm thành viên <ArrowRight size={16} aria-hidden="true"/></Link>
  </section>;
}

export default function AppShell({ me, onLogout, children }) {
  return <div className="zs-app">
    <header className="zs-topbar">
      <Brand/>
      <Link to="/explore" className="zs-topbar-search" aria-label="Tìm kiếm thành viên">
        <Search size={17}/><span>Tìm kiếm thành viên...</span>
      </Link>
      <div className="zs-topbar-actions">
        {me && <Link to="/#compose" className="zs-topbar-write"
          onClick={() => {window.dispatchEvent(new Event('zenspace:compose'));requestAnimationFrame(()=>document.getElementById('compose')?.scrollIntoView({block:'center',behavior:'smooth'}));}}>
          <PenLine size={17}/> Tạo bài
        </Link>}
        <AccountMenu me={me} onLogout={onLogout}/>
      </div>
    </header>
    <div className="zs-body">
      <aside className="zs-sidebar" aria-label="Điều hướng chính">
        <div className="zs-sidebar-label">KHÔNG GIAN CỦA BẠN</div>
        <nav className="zs-side-nav" aria-label="Điều hướng">
          {links.filter(item => !item.private || me).map(item=><NavigationLink key={item.to} {...item}/>)}
        </nav>
        <div className="zs-sidebar-footer">ZENSPACE <span>✦</span> 2026</div>
      </aside>
      <div className="zs-content-area">
        <div className="zs-layout">
          <main id="main-content" className="zs-main">{children}</main>
          <aside className="zs-right-sidebar" aria-label="Gợi ý thành viên">
            <CommunitySuggestions me={me}/>
          </aside>
        </div>
      </div>
    </div>
    <nav className="zs-mobile-nav" aria-label="Điều hướng trên điện thoại">
      {links.filter(item => !item.private || me).map(item=><NavigationLink key={item.to} {...item}/>)}
    </nav>
  </div>;
}
export { Avatar };
