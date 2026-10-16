import React from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowUpRight, Bookmark, Flag, ShieldBan, Trash2, Users } from 'lucide-react';

// Add new destinations here; the responsive grid renders them automatically.
export const settingsDestinations = [
  { id: 'following', to: '/following', title: 'Đang theo dõi', description: 'Những người bạn kết nối', icon: Users },
  { id: 'saved', to: '/saved', title: 'Đã lưu', description: 'Bài viết bạn muốn đọc lại', icon: Bookmark },
  { id: 'archive', to: '/archive', title: 'Lưu trữ', description: 'Bài viết trong không gian riêng', icon: Archive },
  { id: 'trash', to: '/trash', title: 'Thùng rác', description: 'Quản lý bài viết đã xóa', icon: Trash2 },
  { id: 'blocked', to: '/blocked', title: 'Đã chặn', description: 'Tài khoản bạn không muốn tương tác', icon: ShieldBan },
  { id: 'moderation', to: '/moderation', title: 'Kiểm duyệt', description: 'Quản lý an toàn cộng đồng', icon: Flag, admin: true },
];

export default function SettingsHub({ me }) {
  const destinations = settingsDestinations.filter(item => !item.admin || me?.phanQuyen === 'admin');
  return <section className="zs-settings-hub" aria-labelledby="zs-settings-heading">
    <header className="zs-settings-header">
      <div className="zs-settings-eyebrow">ZENSPACE / PERSONAL SPACE</div>
      <h1 id="zs-settings-heading">Cài đặt</h1>
      <p>Quản lý nội dung, các kết nối và không gian cá nhân của bạn.</p>
    </header>
    <div className="zs-settings-grid" aria-label="Chức năng quản lý">
      {destinations.map(({ id, to, title, description, icon: Icon }) =>
        <Link to={to} className="zs-settings-card" key={id}>
          <span className="zs-settings-icon" aria-hidden="true"><Icon size={29} strokeWidth={1.7}/></span>
          <strong>{title}</strong>
          <span className="zs-settings-description">{description}</span>
          <ArrowUpRight className="zs-settings-card-arrow" size={18} aria-hidden="true"/>
        </Link>
      )}
    </div>
  </section>;
}
