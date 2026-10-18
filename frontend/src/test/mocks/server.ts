import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { providerFixture, studentFixture } from '../fixtures';

export const apiUrl = (path: string) => `http://localhost:5173/api${path}`;
export const server = setupServer(
  http.post(apiUrl('/auth/login'), () => HttpResponse.json({ success: true, data: { user: studentFixture(), token: 'synthetic-session-token' } })),
  http.get(apiUrl('/auth/me'), ({ request }) => request.headers.get('authorization') === 'Bearer synthetic-session-token'
    ? HttpResponse.json({ success: true, data: { user: studentFixture() } })
    : HttpResponse.json({ success: false, message: 'Invalid token' }, { status: 401 })),
  http.post(apiUrl('/auth/register'), () => HttpResponse.json({ success: true, message: 'Awaiting verification', data: { user: providerFixture() } }, { status: 201 })),
);
