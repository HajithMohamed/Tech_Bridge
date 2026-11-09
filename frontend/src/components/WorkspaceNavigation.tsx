import { Link, useLocation } from 'react-router-dom';
import { activeWorkspacePath, type WorkspaceLink } from '../utils/workspaceNavigation';

interface NavigationProps { links: WorkspaceLink[]; label: string; className?: string; onNavigate?: () => void }

export default function WorkspaceNavigation({ links, label, className = '', onNavigate }: NavigationProps) {
  const { pathname } = useLocation();
  const active = activeWorkspacePath(links, pathname);
  return <nav aria-label={label} className={`tb-navigation ${className}`}>
    {links.map(({ to, label: text, icon: Icon }) => <Link key={to} to={to} aria-current={active === to ? 'page' : undefined} onClick={onNavigate}><Icon size={20} aria-hidden="true" /><span>{text}</span></Link>)}
  </nav>;
}
