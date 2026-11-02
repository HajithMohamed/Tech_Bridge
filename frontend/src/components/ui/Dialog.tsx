import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

interface DialogProps { open: boolean; title: string; onClose: () => void; children: ReactNode }

export default function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  const keepFocusInDialog = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
      .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return <dialog ref={ref} className="tb-dialog" aria-labelledby={titleId} onKeyDown={keepFocusInDialog} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="tb-dialog-heading"><h2 id={titleId}>{title}</h2><Button variant="quiet" aria-label={`Close ${title}`} onClick={onClose}><X size={20} aria-hidden="true" /></Button></div>
    {children}
  </dialog>;
}
