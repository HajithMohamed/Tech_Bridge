import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import AdminUsersPanel from '../../components/admin/AdminUsersPanel';
import { apiUrl, server } from '../mocks/server';
import { studentFixture } from '../fixtures';

describe('admin users panel with API client', () => {
  it('applies role/status/search filters and navigates server pages', async () => {
    const user = userEvent.setup(); const queries: URLSearchParams[] = [];
    server.use(http.get(apiUrl('/admin/users'), ({ request }) => {
      const query = new URL(request.url).searchParams; queries.push(query);
      return HttpResponse.json({ data: { users: [studentFixture()], page: Number(query.get('page') || 1), pages: 2, total: 21 } });
    }));
    render(<AdminUsersPanel />); await screen.findByRole('heading', { name: 'Synthetic Student' });
    await user.selectOptions(screen.getByLabelText('Role'), 'student');
    await user.selectOptions(screen.getByLabelText('Account status'), 'active');
    await user.type(screen.getByLabelText('Search users'), 'Synthetic'); await user.click(screen.getByRole('button', { name: /^Search$/ }));
    await waitFor(() => expect(queries.at(-1)?.get('q')).toBe('Synthetic'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next user page' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Next user page' }));
    await waitFor(() => expect(queries.at(-1)?.get('page')).toBe('2'));
    expect(queries.at(-1)?.get('role')).toBe('student'); expect(queries.at(-1)?.get('status')).toBe('active');
  });
  it('requires a reason, submits suspension, and reloads actual account state', async () => {
    const user = userEvent.setup(); let suspended = false; let submitted: unknown;
    server.use(
      http.get(apiUrl('/admin/users'), () => HttpResponse.json({ data: { users: [studentFixture({ accountStatus: suspended ? 'suspended' : 'active' })], page: 1, pages: 1, total: 1 } })),
      http.patch(apiUrl('/admin/users/000000000000000000000001/suspend'), async ({ request }) => { submitted = await request.json(); suspended = true; return HttpResponse.json({ success: true }); }),
    );
    render(<AdminUsersPanel />); await user.click(await screen.findByRole('button', { name: 'Suspend Synthetic Student' }));
    expect(screen.getByRole('button', { name: 'Confirm account change' })).toBeDisabled();
    await user.type(screen.getByLabelText('Action reason'), 'Documented policy review'); await user.click(screen.getByRole('button', { name: 'Confirm account change' }));
    expect(await screen.findByRole('button', { name: 'Reinstate Synthetic Student' })).toBeVisible();
    expect(submitted).toEqual({ reason: 'Documented policy review' });
  });
  it('loads per-user action history and reports failed role actions without changing the row', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(apiUrl('/admin/users'), () => HttpResponse.json({ data: { users: [studentFixture()], page: 1, pages: 1, total: 1 } })),
      http.get(apiUrl('/admin/users/000000000000000000000001/history'), () => HttpResponse.json({ data: { entries: [{ _id: 'history', adminId: 'actor', action: 'user_reinstated', targetType: 'user', targetId: 'target', reason: 'Review completed', createdAt: '2026-01-01T00:00:00Z' }], page: 1, pages: 1, total: 1 } })),
      http.patch(apiUrl('/admin/users/000000000000000000000001/role'), () => HttpResponse.json({ message: 'Account is not eligible.' }, { status: 409 })),
    );
    render(<AdminUsersPanel />); await user.click(await screen.findByRole('button', { name: 'History for Synthetic Student' }));
    expect(await screen.findByText('Review completed')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Change role for Synthetic Student' }));
    await user.type(screen.getByLabelText('Action reason'), 'Approved appointment'); await user.click(screen.getByRole('button', { name: 'Confirm account change' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Account is not eligible.');
    expect(screen.getByRole('heading', { name: 'Synthetic Student' })).toBeVisible();
  });
});
