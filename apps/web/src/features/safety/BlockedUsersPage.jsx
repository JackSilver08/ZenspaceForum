import React,{useEffect,useState} from 'react';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { api } from '../../api';
import { PopupFeedback } from '../../components/ui/PopupProvider';

export default function BlockedUsersPage() {
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(null);
  useEffect(()=>{
    let active=true;
    api('/v1/users/blocks',{auth:true}).then(r=>{if(active)setUsers(r.data||[])})
      .catch(e=>{if(active)setError(e.message)})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);
  async function unblock(id) {
    setBusy(id);setError('');
    try {
      await api('/v1/users/'+id+'/block',{method:'DELETE',auth:true});
      setUsers(prev=>prev.filter(u=>u.id!==id));
    }catch(e){setError(e.message)}finally{setBusy(null)}
  }
  return <div className="zs-safety-page">
    <p className="zs-feed-eyebrow">ZENSPACE / AN TOÀN CỘNG ĐỒNG</p>
    <h1><ShieldX size={26}/> Tài khoản đã chặn</h1>
    <p>Những tài khoản này không thể tương tác với bạn. Các bài công khai vẫn có thể truy cập khi không đăng nhập.</p>
    <PopupFeedback message={error}/>
    {loading?<p role="status">Đang tải danh sách...</p>:users.length===0?<p>Chưa có tài khoản nào bị chặn.</p>:
      <div className="zs-safety-list">{users.map(u=><div className="zs-safety-item" key={u.id}>
        <span>{u.tenDangNhap}</span><button type="button" disabled={busy===u.id} onClick={()=>unblock(u.id)}>
          <ShieldCheck size={16}/> Bỏ chặn
        </button>
      </div>)}</div>}
  </div>;
}
