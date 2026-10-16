import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CornerDownLeft, Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';

export default function SearchPalette({ open, onClose, Avatar, me }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTerm('');
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setTerm(query.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    if (term.length === 1) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }
    let live = true;
    setLoading(true);
    setError('');
    const url = term.length >= 2
      ? '/timkiemnguoidung?key=' + encodeURIComponent(term)
      : '/timkiemnguoidung';
    api(url)
      .then(data => {
        if (!live) return;
        setResults((Array.isArray(data.data) ? data.data : [])
          .filter(person => !me || Number(person.id) !== Number(me.id))
          .slice(0, 8));
        setActive(0);
      })
      .catch(err => {
        if (!live) return;
        setResults([]);
        setError(err.message);
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open, term, me?.id]);

  // Closing on navigation prevents a stale overlay over the next destination.
  useEffect(() => { if (open && !location.state?.openSearch) onClose(); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    function escape(event) { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, onClose]);

  if (!open) return null;

  function select(person) {
    onClose();
    navigate('/users/' + person.id);
  }

  function onKeys(event) {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setActive(value => (value + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setActive(value => (value - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      select(results[active]);
    } else if (event.key === 'Tab' && panelRef.current) {
      const nodes = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
  }

  return <div className="zs-search-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panelRef} className="zs-search-dialog" role="dialog" aria-modal="true"
      aria-label="Khám phá ZenSpace" onKeyDown={onKeys}>
      <div className="zs-search-dialog-header">
        <strong>Khám phá ZenSpace</strong>
        <button type="button" aria-label="Đóng tìm kiếm" className="zs-search-close" onClick={onClose}>
          <X size={18}/>
          <kbd>Esc</kbd>
        </button>
      </div>
      <div className="zs-search-dialog-input">
        <Search size={20} aria-hidden="true"/>
        <input ref={inputRef} type="search" role="combobox" aria-expanded="true"
          aria-controls="zs-search-results" aria-activedescendant={results[active] ? 'zs-search-option-' + results[active].id : undefined}
          aria-label="Tìm kiếm thành viên" placeholder="Nhập tên thành viên..."
          value={query} autoComplete="off" onChange={event => setQuery(event.target.value)}/>
      </div>
      <div id="zs-search-results" className="zs-search-results" role="listbox" aria-label="Kết quả thành viên">
        <p className="zs-search-section-label">{term.length >= 2 ? 'KẾT QUẢ TÌM KIẾM' : 'GỢI Ý KẾT NỐI'}</p>
        {query.trim().length === 1 && <p className="zs-search-message">Nhập ít nhất 2 ký tự để tìm thành viên.</p>}
        {loading && <p className="zs-search-message" role="status">Đang tìm kiếm...</p>}
        {error && <p className="zs-search-message zs-search-error" role="alert">Không thể tìm thành viên: {error}</p>}
        {!loading && !error && query.trim().length !== 1 && (
          results.length ? results.map((person, index) =>
            <button type="button" key={person.id} role="option" id={'zs-search-option-' + person.id}
              aria-selected={active === index}
              className={'zs-search-result' + (active === index ? ' is-active' : '')}
              onMouseEnter={() => setActive(index)} onClick={() => select(person)}>
              <Avatar name={person.tenDangNhap} avatar={person.avatar}/>
              <span className="zs-search-result-copy">
                <strong>{person.tenDangNhap}</strong><small>Xem hồ sơ thành viên</small>
              </span><ArrowRight size={17} aria-hidden="true"/>
            </button>)
          : <p className="zs-search-message">{term.length >= 2
            ? 'Không tìm thấy thành viên phù hợp.' : 'Chưa có thành viên gợi ý.'}</p>
        )}
      </div>
      <footer className="zs-search-dialog-footer" aria-hidden="true">
        <span><kbd>↑</kbd> <kbd>↓</kbd> Di chuyển</span>
        <span><CornerDownLeft size={14}/> Chọn</span>
        <span><kbd>Esc</kbd> Đóng</span>
      </footer>
    </div>
  </div>;
}
