import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export function Notice({ tone = 'success', children }: { tone?: 'success' | 'error' | 'info'; children: ReactNode }) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck;
  return <div className={`tb-notice tb-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon size={20} aria-hidden="true" /><div>{children}</div></div>;
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  return <span className={`tb-badge tb-badge--${tone}`}>{children}</span>;
}

export function Skeleton({ label = 'Loading content' }: { label?: string }) {
  return <div className="tb-skeleton" role="status"><span className="sr-only">{label}</span><div aria-hidden="true" className="tb-skeleton-block" /><div aria-hidden="true" className="tb-skeleton-lines"><span /><span /></div></div>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="tb-empty"><h2>{title}</h2><p>{children}</p>{action}</div>;
}
