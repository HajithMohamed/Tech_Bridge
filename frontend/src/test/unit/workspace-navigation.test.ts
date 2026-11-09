import { describe, expect, it } from 'vitest';
import { activeWorkspacePath, mobileWorkspaceLinks, workspaceLinks } from '../../utils/workspaceNavigation';
import { providerFixture, studentFixture } from '../fixtures';

describe('workspace navigation boundaries', () => {
  it.each(['ICT', 'ET', 'BST'] as const)('keeps %s students on the existing student role', degree => {
    const user = studentFixture(); user.studentProfile!.degree = degree;
    const paths = workspaceLinks(user).map(link => link.to);
    expect(paths).toContain('/student-profile'); expect(paths).toContain('/creator-profile');
    expect(paths).not.toContain('/admin'); expect(paths).not.toContain('/provider');
    expect(mobileWorkspaceLinks(user)).toHaveLength(4);
  });
  it('exposes only public destinations when signed out', () => {
    expect(workspaceLinks(null).map(link => link.to)).toEqual(['/', '/opportunities', '/resources', '/connections']);
  });
  it('keeps pending providers in verification without publishing links', () => {
    const user = providerFixture();
    expect(workspaceLinks(user).map(link => link.to)).toEqual(['/provider-verification', '/connections', '/']);
    expect(mobileWorkspaceLinks(user).map(link => link.to)).not.toContain('/provider');
  });
  it.each(['company', 'faculty', 'alumni', 'individual'] as const)('preserves the provider role for %s accounts', organizationType => {
    const user = providerFixture(); user.providerProfile = { ...user.providerProfile!, organizationType, verified: true };
    const paths = workspaceLinks(user).map(link => link.to);
    expect(paths).toContain('/provider/profile'); expect(paths).toContain('/provider/applications');
    expect(paths).not.toContain('/admin'); expect(paths).not.toContain('/student-profile');
  });
  it('does not add nonexistent module routes to admin navigation', () => {
    expect(workspaceLinks(studentFixture({ role: 'admin' })).map(link => link.to)).toEqual(['/admin', '/messages', '/connections', '/']);
  });
  it('selects the deepest existing destination without marking the dashboard active', () => {
    const student = workspaceLinks(studentFixture());
    expect(activeWorkspacePath(student, '/resources/list')).toBe('/resources/list');
    expect(activeWorkspacePath(student, '/opportunities/example')).toBe('/opportunities');
    expect(activeWorkspacePath(student, '/unknown')).toBeUndefined();
    const provider = providerFixture(); provider.providerProfile!.verified = true;
    expect(activeWorkspacePath(workspaceLinks(provider), '/provider/profile')).toBe('/provider/profile');
  });
});
