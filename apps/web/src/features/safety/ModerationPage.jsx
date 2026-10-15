import React,{useCallback,useEffect,useState} from 'react';
import { Flag, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

const labels={spam:'Spam hoặc quảng cáo',harassment:'Quấy rối / bắt nạt',
  hate:'Ngôn từ thù ghét',violence:'Bạo lực hoặc đe dọa',
  sexual:'Nội dung nhạy cảm',misinformation:'Thông tin sai lệch',other:'Khác'};

export default function ModerationPage({me}) {
  const [filter,setFilter]=useState('pending');
  const [reports,setReports]=useState([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(null);
  const load=useCallback(()=>{
    let active=true;
    setLoading(true);setError('');
    api('/v1/moderation/reports?status='+filter,{auth:true}).then(r=>{if(active)setReports(r.data||[])})
      .catch(e=>{if(active)setError(e.message)})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[filter]);
  useEffect(()=>load(),[load]);
  if(me?.phanQuyen!=='admin')return <p className="zs-safety-page" role="alert">Bạn không có quyền xem khu vực kiểm duyệt.</p>;
  async function review(id,status) {
    setBusy(id);setError('');
    try {
      await api('/v1/moderation/reports/'+id,{method:'PUT',auth:true,body:{status}});
      setReports(prev=>prev.map(item=>item.id===id?{...item,status}:item).filter(item=>filter==='all'||item.status===filter));
    }catch(e){setError(e.message)}finally{setBusy(null)}
  }
  return <div className="zs-safety-page">
    <p className="zs-feed-eyebrow">ZENSPACE / TRUST & SAFETY</p>
    <h1><Flag size={26}/> Trung tâm kiểm duyệt</h1>
    <p>Báo cáo được xem xét bởi quản trị viên. Đánh dấu đã xử lý không tự xóa bài; cần thực hiện thao tác quản trị riêng nếu cần.</p>
    <label htmlFor="zs-report-filter">Trạng thái</label>
    <select id="zs-report-filter" value={filter} onChange={e=>setFilter(e.target.value)}>
      <option value="pending">Chờ xử lý</option><option value="dismissed">Đã bỏ qua</option>
      <option value="actioned">Đã xử lý</option><option value="all">Tất cả</option>
    </select>
    {error&&<p className="zs-error" role="alert">{error}</p>}
    {loading?<p role="status">Đang tải báo cáo...</p>:reports.length===0?<p>Không có báo cáo nào trong mục này.</p>:
      <div className="zs-safety-list">{reports.map(r=><article className="zs-report-card" key={r.id}>
        <div className="zs-report-head"><strong>#{r.id} · {labels[r.reason]||r.reason}</strong>
          <span>{r.status==='pending'?'Chờ xử lý':r.status==='dismissed'?'Đã bỏ qua':'Đã xử lý'}</span></div>
        <p>Người báo cáo: {r.reporterName} · Tác giả: {r.authorName}</p>
        <p className="zs-report-snapshot">{r.snapshot}</p>
        {r.details&&<p><strong>Ghi chú:</strong> {r.details}</p>}
        {r.postId?<Link to={'/posts/'+r.postId} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Xem bài gốc</Link>:
          <p className="zs-report-missing">Bài gốc đã bị xóa; nội dung ghi nhận vẫn được giữ để xem xét.</p>}
        {r.status==='pending'&&<div className="zs-report-actions">
          <button type="button" disabled={busy===r.id} onClick={()=>review(r.id,'dismissed')}><XCircle size={16}/> Bỏ qua</button>
          <button type="button" disabled={busy===r.id} onClick={()=>review(r.id,'actioned')}><CheckCircle2 size={16}/> Đánh dấu đã xử lý</button>
        </div>}
      </article>)}</div>}
  </div>;
}
