import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { mobileWorkspaceLinks, workspaceLabel, workspaceLinks } from '../utils/workspaceNavigation';
import AppHeader from './AppHeader';
import WorkspaceNavigation from './WorkspaceNavigation';
import Footer from './landing/Footer';

export default function PortalLayout() {
  const { user } = useAuth();
  return <div className="tb-portal">
    <a className="tb-skip-link" href="#workspace-content">Skip to content</a>
    <AppHeader />
    <div className="tb-workspace">
      <aside className="tb-sidebar"><p>{workspaceLabel(user)}</p><WorkspaceNavigation links={workspaceLinks(user)} label="Workspace" /></aside>
      <div id="workspace-content" className="tb-workspace-content" tabIndex={-1}><Outlet /></div>
    </div>
    <Footer />
    <WorkspaceNavigation links={mobileWorkspaceLinks(user)} label="Quick navigation" className="tb-bottom-navigation" />
  </div>;
}
