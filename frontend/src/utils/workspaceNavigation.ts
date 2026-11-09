import type { LucideIcon } from 'lucide-react';
import { BriefcaseBusiness, ClipboardList, House, LayoutDashboard, MessageCircle, Package, Palette, Plus, ShieldCheck, UserRound, Users } from 'lucide-react';
import type { User } from '../types';

export interface WorkspaceLink { to: string; label: string; icon: LucideIcon; exact?: boolean }
const home: WorkspaceLink = { to: '/', label: 'Home', icon: House, exact: true };
const community: WorkspaceLink = { to: '/connections', label: 'Community', icon: Users };
const messages: WorkspaceLink = { to: '/messages', label: 'Messages', icon: MessageCircle };
const studentProfile: WorkspaceLink = { to: '/student-profile', label: 'Profile', icon: UserRound };
const providerProfile: WorkspaceLink = { to: '/provider/profile', label: 'Profile', icon: UserRound };

export function workspaceLinks(user: User | null): WorkspaceLink[] {
  if (!user) return [home, { to: '/opportunities', label: 'Opportunities', icon: BriefcaseBusiness }, { to: '/resources', label: 'Resources', icon: Package }, community];
  if (user.role === 'admin') return [{ to: '/admin', label: 'Admin', icon: ShieldCheck }, messages, community, home];
  if (user.role === 'provider') {
    if (!user.providerProfile?.verified) return [{ to: '/provider-verification', label: 'Provider verification', icon: ShieldCheck }, community, home];
    return [
      { to: '/provider', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { to: '/provider/opportunities', label: 'Listings', icon: BriefcaseBusiness },
      { to: '/provider/applications', label: 'Applications', icon: ClipboardList },
      { to: '/provider/resources', label: 'Resources', icon: Package },
      { to: '/provider/resource-requests', label: 'Requests', icon: ClipboardList },
      { to: '/creators', label: 'Creators', icon: Palette },
      { to: '/provider/promotion-requests', label: 'Campaigns', icon: BriefcaseBusiness },
      messages, community, providerProfile, home,
    ];
  }
  return [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/opportunities', label: 'Opportunities', icon: BriefcaseBusiness },
    { to: '/resources', label: 'Resources', icon: Package },
    { to: '/my-activity', label: 'My activity', icon: ClipboardList },
    { to: '/my-applications', label: 'Applications', icon: ClipboardList },
    { to: '/my-resource-requests', label: 'Resource requests', icon: Package },
    { to: '/resources/list', label: 'Share a resource', icon: Plus },
    { to: '/creator-profile', label: 'Creator profile', icon: Palette },
    { to: '/my-promotion-requests', label: 'Campaign requests', icon: BriefcaseBusiness },
    messages, community, studentProfile, home,
  ];
}

export function mobileWorkspaceLinks(user: User | null): WorkspaceLink[] {
  const links = workspaceLinks(user);
  const destinations = !user ? ['/', '/opportunities', '/resources', '/connections']
    : user.role === 'student' ? ['/dashboard', '/opportunities', '/messages', '/student-profile']
      : user.role === 'provider' && user.providerProfile?.verified ? ['/provider', '/provider/opportunities', '/messages', '/provider/profile']
        : user.role === 'admin' ? ['/admin', '/messages', '/connections', '/'] : ['/provider-verification', '/connections', '/'];
  return destinations.flatMap(to => links.filter(link => link.to === to));
}

export function activeWorkspacePath(links: WorkspaceLink[], pathname: string): string | undefined {
  return links.filter(link => pathname === link.to || (!link.exact && link.to !== '/' && pathname.startsWith(`${link.to}/`)))
    .sort((left, right) => right.to.length - left.to.length)[0]?.to;
}

export function workspaceLabel(user: User | null): string {
  if (!user) return 'Campus opportunities';
  if (user.role === 'admin') return 'Admin workspace';
  if (user.role === 'provider') return 'Provider workspace';
  return 'Student workspace';
}
