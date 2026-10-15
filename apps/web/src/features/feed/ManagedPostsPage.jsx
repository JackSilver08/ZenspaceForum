import React,{useEffect,useState} from 'react';
import {Archive,Trash2,RotateCcw} from 'lucide-react';
import {api} from '../../api';
export default function ManagedPostsPage({state}){
 const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(null);
 const title=state==='archived'?'Kho lưu trữ':'Thùng rác';
 async function load(){
  setError('');setLoading(true);
  try{const r=await api('/v1/me/posts/'+state,{auth:true});setItems(r.data||[])}
  catch(e){setError(e.message)}finally{setLoading(false)}
 }
 useEffect(()=>{load()},[state]);
 async function act(id,kind){
  if(kind==='permanent'&&!window.confirm('Xóa vĩnh viễn bài viết và media? Không thể khôi phục.'))return;
  setBusy(id);setError('');
  try{
   const path=kind==='unarchive'?'/v1/posts/'+id+'/archive':
    kind==='restore'?'/v1/posts/'+id+'/restore':'/v1/posts/'+id+'/permanent';
   await api(path,{auth:true,method:kind==='restore'?'POST':'DELETE'});
   setItems(old=>old.filter(p=>p.id!==id));
  }catch(e){setError(e.message)}finally{setBusy(null)}
 }
 return <section className="zs-managed-page">
  <h1>{state==='archived'?<Archive size={26}/>:<Trash2 size={26}/>} {title}</h1>
  <p>{state==='archived'?'Bài viết chỉ mình bạn có thể truy cập từ kho lưu trữ.':'Bài viết sẽ bị xóa vĩnh viễn sau 30 ngày.'}</p>
  {error&&<p className="zs-error" role="alert">{error}</p>}
  {loading?<p role="status">Đang tải...</p>:!items.length?<p>Chưa có bài viết nào.</p>:
   <div className="zs-managed-list">{items.map(post=><article className="zs-managed-post" key={post.id}>
    <p>{post.noiDung}</p><small>{new Date(post.ngayDang).toLocaleDateString('vi-VN')}
     {post.purgeAfter&&' · Hạn xóa: '+new Date(post.purgeAfter).toLocaleDateString('vi-VN')}</small>
    <div className="zs-managed-actions">
     <button type="button" disabled={busy===post.id} onClick={()=>act(post.id,state==='archived'?'unarchive':'restore')}>
      <RotateCcw size={16}/> Khôi phục
     </button>
     {state==='trashed'&&<button type="button" disabled={busy===post.id} onClick={()=>act(post.id,'permanent')}>
      <Trash2 size={16}/> Xóa vĩnh viễn
     </button>}
    </div>
   </article>)}</div>}
 </section>;
}
