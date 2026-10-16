import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, HelpCircle, Info, X } from 'lucide-react';

const PopupContext = createContext(null);
let noticeCounter = 0;

export function PopupProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [notices, setNotices] = useState([]);
  const resolver = useRef(null);
  const dialogRef = useRef(null);
  const returnFocus = useRef(null);

  const dismiss = useCallback((result = false) => {
    const pending = resolver.current;
    resolver.current = null;
    setDialog(null);
    pending?.(result);
    requestAnimationFrame(() => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    });
  }, []);

  const confirm = useCallback((options) => {
    // Avoid silently overwriting an unanswered destructive confirmation.
    if (resolver.current) return Promise.resolve(false);
    const details = typeof options === 'string' ? { message: options } : options;
    returnFocus.current = document.activeElement;
    setDialog({
      title: details.title || 'Xác nhận thao tác',
      message: details.message || '',
      confirmLabel: details.confirmLabel || 'Xác nhận',
      cancelLabel: details.cancelLabel || 'Hủy',
      danger: Boolean(details.danger),
    });
    return new Promise(resolve => { resolver.current = resolve; });
  }, []);

  const notify = useCallback((message, variant = 'error') => {
    if (!message) return;
    const id = ++noticeCounter;
    setNotices(previous => [...previous.slice(-2), { id, message: String(message), variant }]);
    return id;
  }, []);
  const removeNotice = useCallback((id) => {
    setNotices(previous => previous.filter(item => item.id !== id));
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => dialogRef.current?.querySelector('.zs-popup-cancel')?.focus());
    return () => { document.body.style.overflow = original; };
  }, [dialog]);
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);

  function onDialogKeys(event) {
    if (event.key === 'Escape') {
      event.stopPropagation(); event.preventDefault();
      dismiss(false);
    }
    if (event.key === 'Tab') {
      const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
  }

  return <PopupContext.Provider value={{ confirm, notify }}>
    {children}
    {createPortal(<>
      {dialog && <div className="zs-popup-backdrop" onMouseDown={event => {
        if (event.target === event.currentTarget) dismiss(false);
      }}>
        <section className="zs-popup-dialog" role="dialog" aria-modal="true"
          aria-labelledby="zs-popup-title" aria-describedby="zs-popup-message"
          data-zs-popup-dialog tabIndex={-1} ref={dialogRef} onKeyDown={onDialogKeys}>
          <span className={'zs-popup-symbol' + (dialog.danger ? ' is-danger' : '')} aria-hidden="true">
            {dialog.danger ? <AlertCircle size={26}/> : <HelpCircle size={26}/>}
          </span>
          <h2 id="zs-popup-title">{dialog.title}</h2>
          <p id="zs-popup-message">{dialog.message}</p>
          <div className="zs-popup-actions">
            <button type="button" className="zs-popup-cancel" autoFocus
              onClick={() => dismiss(false)}>{dialog.cancelLabel}</button>
            <button type="button" className={'zs-popup-accept' + (dialog.danger ? ' is-danger' : '')}
              onClick={() => dismiss(true)}>{dialog.confirmLabel}</button>
          </div>
        </section>
      </div>}
      <div className="zs-popup-notices" aria-label="Thông báo ZenSpace">
        {notices.map(item => <PopupNotice key={item.id} item={item} onClose={() => removeNotice(item.id)}/>)}
      </div>
    </>, document.body)}
  </PopupContext.Provider>;
}

function PopupNotice({ item, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, item.variant === 'error' ? 8500 : 4500);
    return () => window.clearTimeout(timer);
  }, [item.id, item.variant, onClose]);
  const Icon = item.variant === 'success' ? CheckCircle2 : item.variant === 'error' ? AlertCircle : Info;
  return <section className={'zs-popup-notice is-' + item.variant} role={item.variant === 'error' ? 'alert' : 'status'}>
    <Icon size={19} aria-hidden="true"/>
    <div className="zs-popup-notice-content">
      <strong>{item.variant === 'success' ? 'Thành công' : item.variant === 'error' ? 'Có lỗi xảy ra' : 'Thông báo'}</strong>
      <p>{item.message}</p>
    </div>
    <button type="button" onClick={onClose} aria-label="Đóng thông báo"><X size={17}/></button>
  </section>;
}

export function usePopup() {
  const value = useContext(PopupContext);
  if (!value) throw new Error('usePopup must be used inside PopupProvider');
  return value;
}

// Replace old inline error/alert cards without losing an accessible live region.
export function PopupFeedback({ message, variant = 'error' }) {
  const { notify } = usePopup();
  useEffect(() => { if (message) notify(message, variant); }, [message, variant, notify]);
  return null;
}
