import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Compass, Home, LogIn, LogOut,
  MessageCircle, Orbit, PenLine, Search, Sparkles, UserRound, Telescope,
} from 'lucide-react';
import { api } from '../../api';

const navigation = [
  { to: '/', label: 'Bảng tin', icon: Home, end: true },
  { to: '/explore', label: 'Khám phá', icon: Compass },
  { to: '/messages', label: 'Tin nhắn', icon: MessageCircle, private: true },
];

function Brand() {
  return <Link className="zs-brand" to="/" aria-label="ZenSpace – Trang chủ">
    <span className="zs-brand-mark" aria-hidden="true"><span className="zs-brand-orbit"/><span className="zs-brand-core"/></span>
    <span className="zs-brand-label"><strong>ZenSpace</strong><small>Your universe, your stories</small></span>
  </Link>;
}

function Avatar({ name, avatar, size = 'normal' }) {
  const initials = String(name || 'Z').trim().slice(0, 2).toUpperCase();
  let url = avatar;
  // Never load the old demo avatar asset; use a clear typographic placeholder instead.
  if (url && /(?:^|\/)(ZenUser\.png)$/i.test(url)) url = '';
  if (url && url.startsWith('IMG/')) url = '/' + url;
  return <span className={'zs-avatar zs-avatar--' + size} aria-hidden="true">
    {url ? <img src={url} alt="" loading="lazy"/> : initials}
  </span>;
}

function NavItem({ to, label, icon: Icon, end }) {
  return <NavLink to={to} end={end} className={({isActive}) => 'zs-nav-item' + (isActive ? ' is-active' : '')}>
    <Icon size={18} strokeWidth={1.7} aria-hidden="true"/>
    <span>{label}</span>
  </NavLink>;
}

function LeftSidebar({ me, onLogout }) {
  return <aside className="zs-sidebar" aria-label="Điều hướng chính">
    <nav className="zs-side-nav">
      {navigation.filter(item => !item.private || me).map(item => <NavItem key={item.to} {...item}/>)}
      {me && <NavItem to={'/users/' + me.id} label="Trang cá nhân" icon={UserRound}/>}
    </nav>
    <div className="zs-sidebar-bottom">
      <section className="zs-sidebar-feature">
        <span className="zs-feature-kicker">VÙNG KHÔNG GIAN <Orbit size={14}/></span>
        <strong>Không gian vũ trụ</strong>
        <p>Khám phá những suy tưởng độc đáo trong một vũ trụ của riêng bạn.</p>
        <div className="zs-orbit-mini" aria-hidden="true"><i/><i/><i/><b/></div>
      </section>
      {me ? <div className="zs-sidebar-user">
        <Link to={'/users/' + me.id} className="zs-current-user"><Avatar name={me.tenDangNhap} avatar={me.avatar}/><span><strong>{me.tenDangNhap}</strong><small>Trang cá nhân</small></span></Link>
        <button type="button" className="zs-logout" onClick={onLogout}><LogOut size={17}/> Đăng xuất</button>
      </div> : <Link to="/login" className="zs-sidebar-signin"><LogIn size={16}/> Tham gia ZenSpace</Link>}
    </div>
  </aside>;
}

function RecentPosts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let mounted = true;
    api('/baiviet?limit=3').then(result => {
      if(mounted && Array.isArray(result.data)) setItems(result.data.slice(0, 3));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  return <section className="zs-right-card zs-right-recent">
    <div className="zs-right-section-heading"><h3>Câu chuyện gần đây</h3><ArrowUpRight size={15} aria-hidden="true"/></div>
    {items.length ? <div className="zs-recent-list">{items.map((p, i) =>
      <Link to={'/posts/' + p.id} className="zs-recent-item" key={p.id}>
        <span className="zs-recent-index">{String(i + 1).padStart(2, '0')}</span>
        <span><strong>{p.tieuDe}</strong><small>{p.tenDangNhap || 'Thành viên ZenSpace'}</small></span>
        <ArrowRight size={14} aria-hidden="true"/>
      </Link>
    )}</div> : <p className="zs-right-muted">Bài viết mới từ cộng đồng sẽ xuất hiện tại đây.</p>}
  </section>;
}

function RightSidebar() {
  return <aside className="zs-right-sidebar" aria-label="Khám phá ZenSpace">
    <div className="zs-right-sticky">
      <section className="zs-right-spotlight">
        <div className="zs-eyebrow">ĐIỂM NHÌN KHÔNG GIAN <span>✦</span></div>
        <h3>Vọng cảnh<br/><em>thời gian.</em></h3>
        <p>Gặp gỡ những góc nhìn mới, khám phá câu chuyện của cộng đồng giữa vô vàn vì sao.</p>
        <div className="zs-celestial-spot" aria-hidden="true"><i/><i/><b/></div>
        <Link to="/explore" className="zs-spotlight-link">Khám phá ngay <ArrowUpRight size={16}/></Link>
      </section>
      <section className="zs-right-card zs-people-card">
        <div className="zs-right-section-heading"><h3>Những kết nối mới</h3><Link to="/explore">Xem thêm</Link></div>
        <div className="zs-people-illustration" aria-hidden="true"><span/><span/><span/><span/></div>
        <p>Tìm những người có cùng mối quan tâm, theo dõi và chia sẻ câu chuyện của nhau.</p>
        <Link className="zs-people-link" to="/explore"><Telescope size={15}/> Khám phá thành viên <ArrowRight size={15}/></Link>
      </section>
      <RecentPosts/>
      <section className="zs-right-card zs-right-atlas">
        <div className="zs-right-section-heading"><h3>Bản đồ cảm hứng</h3><Sparkles size={17}/></div>
        <div className="zs-atlas-art" aria-hidden="true"><span/><span/><span/><span/><span/></div>
        <p>Câu chuyện của mỗi người là một ngôi sao trên bản đồ chung.</p>
      </section>
      <p className="zs-right-footer">ZenSpace © 2026 <span>·</span> COSMIC ATELIER</p>
    </div>
  </aside>;
}

function MobileNavigation({ me }) {
  return <nav className="zs-mobile-nav" aria-label="Điều hướng điện thoại">
    <NavItem to="/" label="Bảng tin" icon={Home} end/>
    <NavItem to="/explore" label="Khám phá" icon={Compass}/>
    {me ? <>
      <NavItem to="/messages" label="Tin nhắn" icon={MessageCircle}/>
      <NavItem to={'/users/' + me.id} label="Hồ sơ" icon={UserRound}/>
    </> : <NavItem to="/login" label="Đăng nhập" icon={LogIn}/>}
  </nav>;
}

export default function AppShell({ me, onLogout, children }) {
  return <div className="zs-app">
    <header className="zs-topbar">
      <Brand/>
      <div className="zs-topbar-search-wrap">
        <Link to="/explore" className="zs-topbar-search" aria-label="Tìm kiếm người dùng">
          <Search size={16}/><span>Tìm kiếm trong ZenSpace...</span><kbd>⌕</kbd>
        </Link>
      </div>
      <div className="zs-topbar-actions">
        {me && <Link to="/#compose" className="zs-topbar-write" onClick={() => window.requestAnimationFrame(() => document.getElementById('compose')?.scrollIntoView({behavior:'smooth',block:'center'}))}><PenLine size={15}/> Bài viết mới</Link>}
        {me ? <Link className="zs-topbar-account" to={'/users/' + me.id} aria-label="Hồ sơ cá nhân"><Avatar name={me.tenDangNhap} avatar={me.avatar} size="small"/><span>{me.tenDangNhap}</span></Link>
          : <Link to="/login" className="zs-topbar-write">Đăng nhập <ArrowUpRight size={14}/></Link>}
        {me && <button className="zs-topbar-signout" aria-label="Đăng xuất" title="Đăng xuất" onClick={onLogout}><LogOut size={17}/></button>}
      </div>
    </header>
    <div className="zs-body">
      <LeftSidebar me={me} onLogout={onLogout}/>
      <div className="zs-content-area">
        <div className="zs-layout">
          <main className="zs-main" id="main-content">{children}</main>
          <RightSidebar/>
        </div>
      </div>
    </div>
    <MobileNavigation me={me}/>
  </div>;
}

export { Avatar };
