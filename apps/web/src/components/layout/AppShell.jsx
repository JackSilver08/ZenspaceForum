import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Compass, Home, LogIn, LogOut,
  MessageCircle, Orbit, PenLine, Search, Sparkles, UserRound,
} from 'lucide-react';

const navigation = [
  { to: '/', label: 'Bảng tin', icon: Home, end: true },
  { to: '/explore', label: 'Khám phá', icon: Compass },
  { to: '/messages', label: 'Tin nhắn', icon: MessageCircle, private: true },
];

function Brand() {
  return (
    <Link className="zs-brand" to="/" aria-label="ZenSpace — về trang chủ">
      <span className="zs-brand-mark" aria-hidden="true">
        <span className="zs-brand-orbit" />
        <span className="zs-brand-core" />
      </span>
      <span className="zs-brand-type">zen<span>space</span><span className="zs-brand-dot">.</span></span>
    </Link>
  );
}

function Avatar({ name, avatar, size = 'normal' }) {
  const initials = String(name || 'Z').trim().slice(0, 2).toUpperCase();
  return (
    <span className={`zs-avatar zs-avatar--${size}`} aria-hidden="true">
      {avatar ? <img src={avatar.startsWith('IMG/') ? '/' + avatar : avatar} alt="" /> : initials}
    </span>
  );
}

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `zs-nav-item${isActive ? ' is-active' : ''}`}>
      <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
      <span>{label}</span>
      <span className="zs-nav-active-dot" aria-hidden="true" />
    </NavLink>
  );
}

function SideNavigation({ me, onLogout }) {
  return (
    <aside className="zs-sidebar" aria-label="Điều hướng">
      <div className="zs-sidebar-inner">
        <Brand />
        <div className="zs-sidebar-group-title">KHÔNG GIAN CỦA BẠN</div>
        <nav className="zs-side-nav" aria-label="Trang chính">
          {navigation.filter((item) => !item.private || me).map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          {me && <NavItem to={`/users/${me.id}`} label="Trang cá nhân" icon={UserRound} />}
        </nav>

        <section className="zs-sidebar-feature" aria-label="Gợi ý viết">
          <div className="zs-feature-art" aria-hidden="true"><span /><span /><span /></div>
          <div className="zs-feature-kicker"><Sparkles size={13} /> YOUR SPACE</div>
          <h3>Ý tưởng của bạn.<br /><em>Vũ trụ của bạn.</em></h3>
          <p>Một góc nhỏ dành cho những câu chuyện đáng được lắng nghe.</p>
          {me
            ? <Link to="/#compose" className="zs-feature-link">Viết một điều gì đó <ArrowUpRight size={15} /></Link>
            : <Link to="/login" className="zs-feature-link">Tham gia cộng đồng <ArrowUpRight size={15} /></Link>}
        </section>

        <div className="zs-sidebar-bottom">
          {me ? (
            <>
              <Link to={`/users/${me.id}`} className="zs-current-user">
                <Avatar name={me.tenDangNhap} avatar={me.avatar} />
                <span className="zs-current-user-details">
                  <strong>{me.tenDangNhap}</strong>
                  <small>Xem hồ sơ</small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <button className="zs-logout" type="button" onClick={onLogout}>
                <LogOut size={17} /> Đăng xuất
              </button>
            </>
          ) : (
            <Link className="zs-cta zs-cta--full" to="/login"><LogIn size={17} /> Đăng nhập</Link>
          )}
          <div className="zs-sidebar-credit">ZENSPACE SOCIAL <span>·</span> MADE TO CONNECT</div>
        </div>
      </div>
    </aside>
  );
}

function RightSidebar({ me }) {
  return (
    <aside className="zs-right-sidebar" aria-label="Thông tin cộng đồng">
      <div className="zs-right-sticky">
        <div className="zs-right-head"><span className="zs-activity-dot" /> THE SOCIAL UNIVERSE <Orbit size={17}/></div>
        <section className="zs-discover-card">
          <div className="zs-discover-visual" aria-hidden="true">
            <div className="zs-discover-orbit zs-discover-orbit--outer" />
            <div className="zs-discover-orbit zs-discover-orbit--middle" />
            <div className="zs-discover-orbit zs-discover-orbit--inner" />
            <div className="zs-discover-planet" />
            <div className="zs-star zs-star--a" /><div className="zs-star zs-star--b" /><div className="zs-star zs-star--c" />
          </div>
          <span className="zs-eyebrow">WELCOME TO ZENSPACE</span>
          <h3>Ở đây, mỗi người<br/>là một <em>thế giới.</em></h3>
          <p>Gặp gỡ những góc nhìn mới và khám phá câu chuyện của cộng đồng.</p>
          <Link to="/explore" className="zs-discover-action">Khám phá ngay <ArrowUpRight size={16}/></Link>
        </section>
        <section className="zs-right-links">
          <div className="zs-section-header"><h3>Khám phá thêm</h3><Sparkles size={16}/></div>
          <Link to="/explore" className="zs-right-link"><span className="zs-right-link-icon"><Compass size={18}/></span><span><strong>Thành viên</strong><small>Tìm người cùng kết nối</small></span><ArrowRight size={17}/></Link>
          <Link to="/" className="zs-right-link"><span className="zs-right-link-icon"><Home size={18}/></span><span><strong>Bài viết mới</strong><small>Xem câu chuyện cộng đồng</small></span><ArrowRight size={17}/></Link>
          {me && <Link to={`/users/${me.id}`} className="zs-right-link"><span className="zs-right-link-icon"><PenLine size={18}/></span><span><strong>Góc của bạn</strong><small>Quản lý bài viết cá nhân</small></span><ArrowRight size={17}/></Link>}
        </section>
        <p className="zs-right-footer">ZenSpace © 2026 <span>·</span> A PLACE TO BELONG</p>
      </div>
    </aside>
  );
}

function MobileNavigation({ me }) {
  return (
    <nav className="zs-mobile-nav" aria-label="Điều hướng điện thoại">
      <NavItem to="/" label="Bảng tin" icon={Home} end />
      <NavItem to="/explore" label="Khám phá" icon={Compass} />
      {me ? (
        <>
          <NavItem to="/messages" label="Tin nhắn" icon={MessageCircle} />
          <NavItem to={`/users/${me.id}`} label="Hồ sơ" icon={UserRound} />
        </>
      ) : <NavItem to="/login" label="Đăng nhập" icon={LogIn} />}
    </nav>
  );
}

export default function AppShell({ me, onLogout, children }) {
  return (
    <div className="zs-app">
      <div className="zs-ambient zs-ambient--one" aria-hidden="true" />
      <div className="zs-ambient zs-ambient--two" aria-hidden="true" />
      <SideNavigation me={me} onLogout={onLogout} />
      <div className="zs-content-area">
        <header className="zs-topbar">
          <div className="zs-topbar-mobile-brand"><Brand /></div>
          <div className="zs-topbar-heading"><span className="zs-topbar-status-dot"/> YOUR UNIVERSE, YOUR STORIES</div>
          <div className="zs-topbar-actions">
            <Link className="zs-topbar-search" to="/explore" aria-label="Tìm kiếm thành viên"><Search size={18}/><span>Tìm kiếm trong ZenSpace...</span><span className="zs-shortcut">/</span></Link>
            {me
              ? <Link className="zs-topbar-avatar" to={`/users/${me.id}`} aria-label="Hồ sơ cá nhân"><Avatar name={me.tenDangNhap} avatar={me.avatar} size="small" /></Link>
              : <Link className="zs-cta zs-cta--small" to="/login">Đăng nhập <ArrowUpRight size={15}/></Link>}
          </div>
        </header>
        <div className="zs-layout">
          <main className="zs-main" id="main-content">{children}</main>
          <RightSidebar me={me} />
        </div>
      </div>
      <MobileNavigation me={me} />
    </div>
  );
}

export { Avatar };
