import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ArrowRight, Home, LogIn, LogOut, MessageCircle,
  PenLine, Search, UserRound, Orbit, ChevronDown, Settings
} from 'lucide-react';
import SearchPalette from '../../features/search/SearchPalette.jsx';
import { api } from '../../api';

const links = [
  { to: '/', label: 'Bảng tin', icon: Home, end: true },
  { to: '/messages', label: 'Tin nhắn', icon: MessageCircle, private: true },
];
const settingsRoutes = new Set(['/settings', '/following', '/saved', '/archive', '/trash', '/blocked', '/moderation']);

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

function NavigationLink({ to, label, icon: Icon, end = false, forceActive = false }) {
  return <NavLink to={to} end={end} aria-label={label} title={label}
    className={({isActive}) => 'zs-nav-item' + (isActive || forceActive ? ' is-active' : '')}>
    <Icon size={19} strokeWidth={1.8} aria-hidden="true"/>
    <span>{label}</span>
  </NavLink>;
}

function AccountMenu({ me, onLogout }) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  useEffect(() => { setExpanded(false); }, [location.pathname]);
  useEffect(() => {
    const onEscape = (e) => {if(e.key==='Escape') setExpanded(false);};
    window.addEventListener('keydown',onEscape);
    return () => window.removeEventListener('keydown',onEscape);
  }, []);
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

function CommunitySuggestions({ me, onSearch }) {
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
    <button type="button" className="zs-suggest-explore" onClick={onSearch}>
      Tìm thêm thành viên <ArrowRight size={16} aria-hidden="true"/>
    </button>
  </section>;
}

export default function AppShell({ me, onLogout, children }) {
  const location = useLocation();
  const showSuggestions = location.pathname === '/' || location.pathname === '/following';
  const isMessages = location.pathname === '/messages';
  const isSettingsSection = settingsRoutes.has(location.pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  useEffect(() => {
    setSearchOpen(Boolean(location.state?.openSearch));
  }, [location.key]);
  useEffect(() => {
    function shortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [openSearch]);
  return <div className={isMessages ? 'zs-app zs-app--messages' : 'zs-app'}>
    <header className="zs-topbar">
      <Brand/>
      <button type="button" className="zs-topbar-search" aria-label="Tìm kiếm thành viên"
        aria-keyshortcuts="Control+K Meta+K" aria-haspopup="dialog" aria-expanded={searchOpen} onClick={openSearch}>
        <Search size={17}/><span>Tìm kiếm thành viên...</span><kbd>Ctrl K</kbd>
      </button>
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
          {links.filter(item => (!item.private || me) && (!item.admin || me?.phanQuyen==='admin')).map(item=><NavigationLink key={item.to} {...item}/>)}
        </nav>
        <div className="zs-sidebar-settings">
          <NavigationLink to={me ? '/settings' : '/login'} label="Cài đặt" icon={Settings}
            forceActive={isSettingsSection}/>
        </div>
      </aside>
      <div className="zs-content-area">
        {isMessages
          ? <main id="main-content" className="zs-main zs-main--messages">{children}</main>
          : <div className={showSuggestions ? "zs-layout" : "zs-layout zs-layout--wide"}>
              <main id="main-content" className="zs-main">{children}</main>
              {showSuggestions && <aside className="zs-right-sidebar" aria-label="Gợi ý thành viên">
                <CommunitySuggestions me={me} onSearch={openSearch}/>
              </aside>}
            </div>}
      </div>
    </div>
    <nav className="zs-mobile-nav" aria-label="Điều hướng trên điện thoại">
      {links.filter(item => (!item.private || me)).map(item=><NavigationLink key={item.to} {...item}/>)}
      <button type="button" className="zs-nav-item zs-mobile-search" aria-label="Tìm kiếm"
        aria-haspopup="dialog" onClick={openSearch}><Search size={19}/><span>Tìm kiếm</span></button>
      <NavigationLink to={me ? '/settings' : '/login'} label="Cài đặt" icon={Settings}
        forceActive={isSettingsSection}/>
    </nav>
    <SearchPalette open={searchOpen} onClose={closeSearch} Avatar={Avatar} me={me}/>
  </div>;
}
export { Avatar };
