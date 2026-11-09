import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { workspaceLabel, workspaceLinks } from '../utils/workspaceNavigation';
import WorkspaceNavigation from './WorkspaceNavigation';
import Button from './ui/Button';
import Dialog from './ui/Dialog';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const signOut = () => { setMenuOpen(false); logout(); navigate('/'); };
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 1000px)');
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return <>
    <header className="tb-header">
      <div className="tb-header-inner">
        <Link to="/" className="tb-brand" aria-label="TechBridge home"><GraduationCap size={30} aria-hidden="true" /><span>TECH<span>BRIDGE</span></span></Link>
        <span className="tb-workspace-label">{workspaceLabel(user)}</span>
        <div className="tb-header-actions">
          {user ? <div className="tb-desktop-account"><span className="tb-account-name">{user.fullName}</span><Button variant="quiet" onClick={signOut}><LogOut size={18} aria-hidden="true" />Sign out</Button></div>
            : <div className="tb-public-actions"><Link className="tb-button tb-button--secondary" to="/login">Sign in</Link><Link className="tb-button tb-button--primary" to="/register">Get started</Link></div>}
          <Button variant="secondary" className="tb-menu-button" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20} aria-hidden="true" /></Button>
        </div>
      </div>
    </header>
    <Dialog open={menuOpen} title="Navigation" onClose={() => setMenuOpen(false)}>
      <WorkspaceNavigation links={workspaceLinks(user)} label="Mobile workspace" onNavigate={() => setMenuOpen(false)} />
      {user ? <Button variant="quiet" onClick={signOut}><LogOut size={18} aria-hidden="true" />Sign out</Button>
        : <div className="tb-auth-actions"><Link to="/login" className="tb-button tb-button--secondary" onClick={() => setMenuOpen(false)}>Sign in</Link><Link to="/register" className="tb-button tb-button--primary" onClick={() => setMenuOpen(false)}>Get started</Link></div>}
    </Dialog>
  </>;
}
