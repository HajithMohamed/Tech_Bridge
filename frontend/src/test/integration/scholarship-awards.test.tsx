import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import ProviderApplicationsPage from '../../pages/ProviderApplicationsPage';
import type { Opportunity, OpportunityApplication } from '../../types';
import { apiUrl, server } from '../mocks/server';

const scholarship: Opportunity = {
  _id: 'synthetic-scholarship', providerId: 'synthetic-provider', title: 'Synthetic Capacity Scholarship',
  description: 'Synthetic scholarship for isolated approval tests.', type: 'scholarship', requiredSkills: [],
  location: 'Test Campus', workMode: 'remote', status: 'open', views: 0,
  applicationDeadline: '2099-01-01T00:00:00Z', numberOfAwards: 1, amount: 1000, currency: 'LKR',
  coverageType: 'partial', eligibilityCriteria: ['Enrolled student'], renewable: false,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const application: OpportunityApplication = {
  _id: 'synthetic-application', studentId: { _id: 'synthetic-student', fullName: 'Synthetic Applicant', email: 'applicant@example.test' },
  opportunityId: scholarship._id, status: 'applied', justification: 'Synthetic justification for a human scholarship review.',
  selfDeclaredNeed: 'medium', appliedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', priorityScore: 90,
};
function renderReview() {
  server.use(
    http.get(apiUrl('/opportunities/mine'), () => HttpResponse.json({ success: true, data: { opportunities: [scholarship] } })),
    http.get(apiUrl('/applications/opportunity/synthetic-scholarship'), () => HttpResponse.json({ success: true, data: { applications: [application] } })),
  );
  render(<MemoryRouter><ProviderApplicationsPage /></MemoryRouter>);
}

describe('existing scholarship review UI with guarded decisions', () => {
  it('retains applicant details after an explicit human approval', async () => {
    const user = userEvent.setup();
    let decision: unknown;
    server.use(http.patch(apiUrl('/applications/synthetic-application/status'), async ({ request }) => {
      decision = await request.json();
      return HttpResponse.json({ success: true, data: { application: { ...application, status: 'accepted' } } });
    }));
    renderReview();
    expect(await screen.findByRole('heading', { name: 'Synthetic Applicant' })).toBeVisible();
    expect(decision).toBeUndefined();
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'accepted');
    await waitFor(() => expect(screen.getAllByRole('combobox')[1]).toHaveValue('accepted'));
    expect(decision).toEqual({ status: 'accepted' });
    expect(screen.getByRole('heading', { name: 'Synthetic Applicant' })).toBeVisible();
  });
  it('retains the unapproved application when capacity returns a conflict', async () => {
    const user = userEvent.setup();
    server.use(http.patch(apiUrl('/applications/synthetic-application/status'), () => HttpResponse.json({ success: false, message: 'Scholarship capacity filled' }, { status: 409 })));
    renderReview();
    await screen.findByRole('heading', { name: 'Synthetic Applicant' });
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'accepted');
    expect(await screen.findByText('Unable to update application status.')).toBeVisible();
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('applied');
  });
});
