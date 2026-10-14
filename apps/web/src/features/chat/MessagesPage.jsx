import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircle, Send, RefreshCw } from 'lucide-react';
import { api } from '../../api';
import { Avatar } from '../../components/layout/AppShell';

export default function MessagesPage({ me }) {
  const [params] = useSearchParams();
  const requested = params.get('user') || '';
  const [inbox, setInbox] = useState([]);
  const [peerId, setPeerId] = useState(requested);
  const [manualId, setManualId] = useState('');
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [sending, setSending] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (requested) setPeerId(requested);
  }, [requested]);
  useEffect(() => {
    let active = true;
    setLoadingInbox(true);
    api('/chat/inbox', {auth: true})
      .then(result => {
        if (!active) return;
        setInbox(Array.isArray(result.data) ? result.data : []);
        setError('');
      })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoadingInbox(false); });
    return () => {active = false;};
  }, [refresh]);
  useEffect(() => {
    if (!peerId || !me) {setMessages([]);return;}
    let active = true;
    api('/chat/lichsu/' + me.id + '/' + peerId, {auth: true})
      .then(result => { if (active) {setMessages(result.tinNhan || []);setError('');} })
      .catch(err => { if (active) setError(err.message); });
    return () => {active = false;};
  }, [peerId, me?.id, refresh]);

  async function send(e) {
    e.preventDefault();
    if (!content.trim() || !peerId || sending) return;
    setSending(true);setError('');
    try {
      await api('/chat/gui', {auth:true,method:'POST',body:{nguoiNhanID:Number(peerId),noiDung:content}});
      setContent('');
      setRefresh(v=>v+1);
    } catch (err) {setError(err.message);}
    finally {setSending(false);}
  }
  const participant = inbox.find(m => Number(m.user.id) === Number(peerId))?.user;
  const lastMessage = messages.find(m=>m.nguoiGuiID!==Number(me.id) || m.nguoiNhanID===Number(peerId));
  const participantName = participant?.tenDangNhap
    || (lastMessage && (lastMessage.nguoiGuiID === Number(me.id) ? lastMessage.nguoiNhanTen : lastMessage.nguoiGuiTen))
    || ('Thành viên #' + peerId);
  return <section className="zs-chat-layout" aria-labelledby="zs-chat-title">
    <div className="zs-chat-inbox">
      <h2 id="zs-chat-title">Tin nhắn</h2>
      <form onSubmit={e => {e.preventDefault();if(Number(manualId)>0 && Number(manualId)!==Number(me.id))setPeerId(manualId);}}>
        <label className="visually-hidden" htmlFor="zs-peer-id">ID thành viên</label>
        <div className="zs-chat-new">
          <input id="zs-peer-id" type="number" min="1" placeholder="Nhắn đến ID..." value={manualId} onChange={e=>setManualId(e.target.value)} />
          <button type="submit">Mở</button>
        </div>
      </form>
      {loadingInbox && <p>Đang tải hội thoại...</p>}
      {!loadingInbox && inbox.length === 0 && <p className="zs-chat-hint">Bạn chưa có hội thoại. Có thể bắt đầu từ hồ sơ một thành viên hoặc nhập ID của họ.</p>}
      {inbox.map(item => <button key={item.user.id} type="button" onClick={()=>setPeerId(String(item.user.id))}
        className={'zs-chat-person ' + (Number(peerId)===Number(item.user.id)?'active':'')}>
        <Avatar name={item.user.tenDangNhap} avatar={item.user.avatar}/>
        <span><strong>{item.user.tenDangNhap}</strong><small>{item.noiDung}</small></span>
      </button>)}
    </div>
    <div className="zs-chat-conversation">
      {peerId ? <>
        <div className="zs-chat-header"><MessageCircle size={20}/><strong>{participantName}</strong><Link to={'/users/' + peerId}>Xem hồ sơ</Link></div>
        <div className="zs-chat-messages">
          {messages.length===0 && <p className="zs-chat-hint">Chưa có tin nhắn với thành viên này.</p>}
          {messages.map(m => <div key={m.id} className={'zs-chat-message '+(Number(m.nguoiGuiID)===Number(me.id)?'own':'')}>
            <span>{m.noiDung}</span><small>{m.nguoiGuiTen}</small></div>)}
        </div>
        <form onSubmit={send} className="zs-chat-send">
          <input required maxLength={5000} value={content} onChange={e=>setContent(e.target.value)} placeholder="Viết tin nhắn..." aria-label="Nội dung tin nhắn"/>
          <button disabled={sending||!content.trim()} title="Gửi tin nhắn" aria-label="Gửi tin nhắn"><Send size={18}/></button>
        </form>
      </> : <div className="zs-chat-placeholder"><MessageCircle size={32}/><p>Chọn một cuộc trò chuyện để bắt đầu.</p></div>}
    </div>
    {error && <div className="zs-chat-error" role="alert">{error}<button onClick={()=>setRefresh(v=>v+1)} title="Thử lại"><RefreshCw size={15}/></button></div>}
  </section>;
}
