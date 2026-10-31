import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export default function AuthFlowShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="min-h-screen bg-surface-50 px-4 py-12 sm:px-6"><div className="mx-auto max-w-md">
    <Link to="/" className="text-xl font-bold text-primary-800">TechBridge</Link>
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8"><h1 className="text-2xl font-bold text-gray-900">{title}</h1><p className="mt-3 text-sm leading-6 text-gray-600">{description}</p><div className="mt-6">{children}</div></section>
    <Link to="/login" className="mt-6 inline-block font-semibold text-primary-800 underline underline-offset-4">Back to sign in</Link>
  </div></main>;
}
