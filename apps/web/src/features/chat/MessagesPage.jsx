import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MessageCircle, MessageSquarePlus, Orbit, Search, Send, Sparkles, UserRoundPlus, X } from 'lucide-react';
import { api, getToken } from '../../api';
import { PopupFeedback } from '../../components/ui/PopupProvider';
import { Avatar } from '../../components/layout/AppShell';

function clock(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('vi-VN', {hour:'2-digit',minute:'2-digit'}).format(date) : '';
}
function inboxTime(value) {
  const date = new Date(value), today = new Date();
  if (!value || Number.isNaN(date.getTime())) return '';
  if (date.toDateString() === today.toDateString()) return clock(value);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate()-1);
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return new Intl.DateTimeFormat('vi-VN', {day:'2-digit',month:'2-digit'}).format(date);
}
function messageDay(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('vi-VN', {weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(date) : '';
}

export default function MessagesPage({me}) {
  const [params,setParams] = useSearchParams();
  const raw = params.get('user') || '';
  const peerId = /^[1-9]\d*$/.test(raw) && Number(raw) !== Number(me.id) ? raw : '';
  const [inbox,setInbox] = useState([]);
  const [messages,setMessages] = useState([]);
  const [peer,setPeer] = useState(null);
  const [query,setQuery] = useState('');
  const [searchTerm,setSearchTerm] = useState('');
  const [people,setPeople] = useState([]);
  const [newChat,setNewChat] = useState(false);
  const [loadingInbox,setLoadingInbox] = useState(true);
  const [loadingPeople,setLoadingPeople] = useState(false);
  const [loadingChat,setLoadingChat] = useState(false);
  const [error,setError] = useState('');
  const [searchError,setSearchError] = useState('');
  const [content,setContent] = useState('');
  const [sending,setSending] = useState(false);
  const [inboxTick,setInboxTick] = useState(0);
  const [historyTick,setHistoryTick] = useState(0);
  const [socketState,setSocketState] = useState('connecting');
  const currentPeer=useRef(peerId);
  currentPeer.current=peerId;
  const searchRef=useRef(null);
  const messagePanel=useRef(null);

  useEffect(()=>{
    const timer=window.setTimeout(()=>setSearchTerm(query.trim()),260);
    return ()=>window.clearTimeout(timer);
  },[query]);
  useEffect(()=>{
    let active=true;
    setLoadingInbox(true);
    api('/chat/inbox',{auth:true}).then(res=>{
      if (active) setInbox(Array.isArray(res.data)?res.data:[]);
    }).catch(err=>{if(active)setError(err.message);})
      .finally(()=>{if(active)setLoadingInbox(false);});
    return ()=>{active=false;};
  },[inboxTick,me.id]);
  useEffect(()=>{
    let active=true;
    setPeople([]);setSearchError('');
    if(!newChat||searchTerm.length<2) {setLoadingPeople(false);return ()=>{active=false;};}
    setLoadingPeople(true);
    api('/timkiemnguoidung?key='+encodeURIComponent(searchTerm))
      .then(res=>{if(active)setPeople((Array.isArray(res.data)?res.data:[]).filter(p=>Number(p.id)!==Number(me.id)));})
      .catch(err=>{if(active)setSearchError(err.message);})
      .finally(()=>{if(active)setLoadingPeople(false);});
    return ()=>{active=false;};
  },[newChat,searchTerm,me.id]);
  useEffect(()=>{
    setPeer(null);
    setMessages([]);
    setContent('');
  },[peerId]);
  useEffect(()=>{
    let active=true;
    if(!peerId) {setLoadingChat(false);return ()=>{active=false;};}
    setLoadingChat(true);
    Promise.all([api('/chat/lichsu/'+me.id+'/'+peerId,{auth:true}),api('/nguoidung/'+peerId)])
      .then(([history,user])=>{
        if(active){setMessages(Array.isArray(history.tinNhan)?history.tinNhan:[]);setPeer(user.data||null);}
      }).catch(err=>{if(active)setError(err.message);})
      .finally(()=>{if(active)setLoadingChat(false);});
    return ()=>{active=false;};
  },[peerId,me.id,historyTick]);
  useEffect(()=>{
    if(messagePanel.current) messagePanel.current.scrollTop=messagePanel.current.scrollHeight;
  },[messages,peerId]);

  // Messages continue to be written through the authenticated REST endpoint.
  // WebSocket delivers immediate change notifications to every active browser.
  // Re-fetching on reconnect fills gaps that occur during network outages.
  useEffect(()=>{
    let alive=true,ws=null,retryTimer=null,attempt=0;
    const sync=()=>{setInboxTick(v=>v+1);setHistoryTick(v=>v+1);};
    function connect() {
      if(!alive)return;
      const token=getToken();
      if(!token){setSocketState('offline');return;}
      setSocketState('connecting');
      const scheme=window.location.protocol==='https:'?'wss:':'ws:';
      ws=new WebSocket(scheme+'//'+window.location.host+'/api/chat/ws',
        ['zenspace.chat.v1','auth.'+token]);
      ws.onopen=()=>{
        if(!alive)return;
        attempt=0;
        setSocketState('online');
        sync();
      };
      ws.onmessage=event=>{
        if(!alive)return;
        let payload;
        try{payload=JSON.parse(event.data);}catch{return;}
        if(payload.type!=='chat.message')return;
        setInboxTick(v=>v+1);
        if(String(payload.peerId)===String(currentPeer.current))
          setHistoryTick(v=>v+1);
      };
      ws.onerror=()=>ws?.close();
      ws.onclose=()=>{
        if(!alive)return;
        setSocketState('reconnecting');
        const delay=Math.min(1000*Math.pow(2,attempt++),15000);
        retryTimer=window.setTimeout(connect,delay);
      };
    }
    const onFocus=()=>{if(alive)sync();};
    const onVisible=()=>{if(!document.hidden)onFocus();};
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    connect();
    return ()=>{
      alive=false;
      window.clearTimeout(retryTimer);
      window.removeEventListener('focus',onFocus);
      document.removeEventListener('visibilitychange',onVisible);
      if(ws) {
        ws.onclose=null;
        ws.onerror=null;
        ws.close();
      }
    };
  },[me.id]);

  function selectPeer(id) {
    setParams({user:String(id)});
    setQuery('');setSearchTerm('');setNewChat(false);setSearchError('');setError('');
  }
  function startNew() {
    setNewChat(v=>!v);setQuery('');setPeople([]);setSearchError('');
    window.requestAnimationFrame(()=>searchRef.current?.focus());
  }
  function back() {setParams({});setContent('');setError('');}
  async function send(event) {
    event.preventDefault();
    const value=content.trim();
    if(!peerId||!value||sending)return;
    setSending(true);setError('');
    try {
      await api('/chat/gui',{auth:true,method:'POST',body:{nguoiNhanID:Number(peerId),noiDung:value}});
      setContent('');setInboxTick(v=>v+1);setHistoryTick(v=>v+1);
    }catch(err){setError(err.message);}
    finally{setSending(false);}
  }
  function onMessageKey(e) {
    if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing) {
      e.preventDefault();
      if(content.trim()&&!sending)e.currentTarget.form?.requestSubmit();
    }
  }
  const visibleInbox=inbox.filter(item=>!query.trim()||
    item.user.tenDangNhap.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
  const known=new Set(inbox.map(item=>Number(item.user.id)));
  const suggestions=people.filter(p=>!known.has(Number(p.id)));
  const selectedUser=peer||inbox.find(item=>String(item.user.id)===peerId)?.user;
  const name=selectedUser?.tenDangNhap||'Đang tải thành viên...';
  let previousDay='';

  const personRow=(user,snippet,time,active=false,keyPrefix='')=>
    <button key={keyPrefix+user.id} type="button" onClick={()=>selectPeer(user.id)}
      className={'zs-messenger-person'+(active?' is-active':'')} aria-current={active?'true':undefined}>
      <Avatar name={user.tenDangNhap} avatar={user.avatar}/>
      <span className="zs-messenger-person-info">
        <span className="zs-messenger-person-heading"><strong>{user.tenDangNhap}</strong>{time&&<time>{inboxTime(time)}</time>}</span>
        <small>{snippet}</small>
      </span>
      {keyPrefix&&<ArrowRight size={16}/>}
    </button>;

  return <section className={'zs-messenger'+(peerId?' zs-messenger--open':'')} aria-label="Không gian tin nhắn">
    <aside className="zs-messenger-list" aria-label="Danh sách hội thoại">
      <div className="zs-messenger-list-top">
        <div className="zs-messenger-title">
          <div><p>ZENSPACE / KẾT NỐI</p><h1>Tin nhắn</h1></div>
          <button className={'zs-messenger-new'+(newChat?' is-active':'')} type="button"
            aria-label={newChat?'Đóng tìm thành viên':'Bắt đầu cuộc trò chuyện mới'} aria-expanded={newChat}
            title="Tin nhắn mới" onClick={startNew}>{newChat?<X size={19}/>:<MessageSquarePlus size={20}/>}</button>
        </div>
        <div className="zs-messenger-search">
          <Search size={18} aria-hidden="true"/>
          <label className="visually-hidden" htmlFor="zs-messenger-search-input">Tìm kiếm hội thoại hoặc thành viên</label>
          <input id="zs-messenger-search-input" ref={searchRef} type="search" autoComplete="off"
            value={query} onChange={e=>setQuery(e.target.value)}
            placeholder={newChat?'Tìm người theo tên...':'Tìm hội thoại...'}/>
          {query&&<button type="button" aria-label="Xóa tìm kiếm" onClick={()=>setQuery('')}><X size={15}/></button>}
        </div>
        <div className="zs-messenger-tabs">
          <span>{newChat?'Tìm người':'Tất cả'}</span>
          {!newChat&&<span className="zs-messenger-count">{inbox.length} hội thoại</span>}
        </div>
      </div>
      <div className="zs-messenger-scroll">
        {newChat ? <>
          {searchTerm.length<2&&<div className="zs-messenger-list-empty"><UserRoundPlus size={27}/>
            <strong>Tìm một người bạn</strong><p>Nhập ít nhất 2 ký tự để tìm thành viên và bắt đầu cuộc trò chuyện.</p>
          </div>}
          {loadingPeople&&<p role="status" className="zs-messenger-status">Đang tìm thành viên...</p>}
          <PopupFeedback message={searchError}/>
          {!loadingPeople&&searchTerm.length>=2&&!searchError&&<>
            {visibleInbox.length>0&&<p className="zs-messenger-group-label">Hội thoại hiện có</p>}
            {visibleInbox.map(item=>personRow(item.user,'Tiếp tục trò chuyện',null,String(item.user.id)===peerId,'inbox-'))}
            {suggestions.length>0&&<p className="zs-messenger-group-label">Thành viên ZenSpace</p>}
            {suggestions.map(user=>personRow(user,'Bắt đầu trò chuyện',null,false,'new-'))}
            {!visibleInbox.length&&!suggestions.length&&<div className="zs-messenger-list-empty">
              <Search size={25}/><strong>Không tìm thấy thành viên</strong><p>Thử tìm kiếm bằng tên khác.</p>
            </div>}
          </>}
        </> : <>
          {loadingInbox&&<p role="status" className="zs-messenger-status">Đang tải hội thoại...</p>}
          {!loadingInbox&&!visibleInbox.length&&<div className="zs-messenger-list-empty"><MessageCircle size={27}/>
            <strong>{query?'Không tìm thấy hội thoại':'Chưa có cuộc trò chuyện'}</strong>
            <p>{query?'Thử tìm bằng tên khác.':'Chọn biểu tượng tạo tin nhắn để kết nối với một thành viên.'}</p>
            {!query&&<button type="button" onClick={startNew}>Tìm thành viên <ArrowRight size={15}/></button>}
          </div>}
          {visibleInbox.map(item=>personRow(item.user,
            (Number(item.nguoiGuiID)===Number(me.id)?'Bạn: ':'')+item.noiDung,
            item.thoiGian,String(item.user.id)===peerId))}
        </>}
      </div>
    </aside>
    <section className="zs-messenger-conversation" aria-label={peerId?'Hội thoại với '+name:'Khung trò chuyện'}>
      {peerId ? <>
        <header className="zs-messenger-conversation-header">
          <button className="zs-messenger-back" type="button" onClick={back} aria-label="Quay lại danh sách hội thoại"><ArrowLeft size={21}/></button>
          <Avatar name={selectedUser?.tenDangNhap} avatar={selectedUser?.avatar}/>
          <div className="zs-messenger-chat-person"><strong>{name}</strong>
            <span className={socketState==='online'?'zs-chat-connection is-online':'zs-chat-connection'}>
              {socketState==='online'?'Kết nối thời gian thực':
                socketState==='reconnecting'?'Đang kết nối lại...':
                socketState==='offline'?'Đang ngoại tuyến':'Đang kết nối realtime...'}
            </span>
          </div>
          <Link to={'/users/'+peerId} className="zs-messenger-profile">Xem hồ sơ <ArrowRight size={15}/></Link>
        </header>
        <div className="zs-messenger-chat-scroll" ref={messagePanel} aria-live="polite">
          {loadingChat&&<p role="status" className="zs-messenger-chat-status">Đang tải tin nhắn...</p>}
          {!loadingChat&&!messages.length&&<div className="zs-messenger-first-message"><Orbit size={28}/>
            <h2>Hãy gửi lời chào!</h2><p>Đây là nơi bắt đầu câu chuyện giữa bạn và {name}.</p>
          </div>}
          {(!loadingChat||messages.length>0)&&messages.map(m=>{
            const day=messageDay(m.thoiGian),showDay=day!==previousDay;
            previousDay=day;
            const own=Number(m.nguoiGuiID)===Number(me.id);
            return <React.Fragment key={m.id}>
              {showDay&&day&&<div className="zs-messenger-day"><span>{day}</span></div>}
              <div className={'zs-messenger-bubble-row'+(own?' is-own':'')}>
                {!own&&<Avatar name={m.nguoiGuiTen} avatar={m.nguoiGuiAvatar} size="small"/>}
                <div className="zs-messenger-message-group">
                  <p className="zs-messenger-bubble">{m.noiDung}</p>
                  <time dateTime={m.thoiGian}>{clock(m.thoiGian)}</time>
                </div>
              </div>
            </React.Fragment>;
          })}
        </div>
        <form className="zs-messenger-composer" onSubmit={send}>
          <label className="visually-hidden" htmlFor="zs-message-text">Nội dung tin nhắn</label>
          <textarea id="zs-message-text" rows={2} maxLength={5000} value={content}
            onChange={e=>setContent(e.target.value)} onKeyDown={onMessageKey}
            placeholder={'Nhắn tin cho '+name+'...'}/>
          <div className="zs-messenger-composer-bottom">
            <span>Enter để gửi · Shift + Enter để xuống dòng</span>
            <button type="submit" disabled={sending||!content.trim()}>
              <Send size={17}/>{sending?'Đang gửi...':'Gửi'}
            </button>
          </div>
        </form>
      </> : <div className="zs-messenger-welcome">
        <div className="zs-messenger-welcome-art" aria-hidden="true"><div className="zs-messenger-glow"/>
          <Orbit size={95} strokeWidth={.8}/><Sparkles size={22} className="zs-messenger-sparkle"/>
          <span className="zs-messenger-planet zs-messenger-planet--one"/>
          <span className="zs-messenger-planet zs-messenger-planet--two"/>
        </div>
        <span className="zs-messenger-welcome-kicker">YOUR SPACE TO CONNECT</span>
        <h2>Chào mừng đến với <strong>ZenSpace</strong></h2>
        <p>Một không gian dành cho những cuộc trò chuyện và kết nối ý nghĩa. Chọn hội thoại ở bên trái hoặc bắt đầu một câu chuyện mới.</p>
        <button type="button" onClick={startNew}><MessageSquarePlus size={17}/> Trò chuyện mới</button>
      </div>}
    </section>
    <PopupFeedback message={error}/>
  </section>;
}
