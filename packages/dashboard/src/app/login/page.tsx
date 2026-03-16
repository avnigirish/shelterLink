'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-2xl font-bold text-text">Admin Sign In</h2>
      <p className="text-text-subtle text-sm">Sign in with your GitHub account to access the admin panel.</p>
      <button
        onClick={() => signIn('github', { callbackUrl: '/admin' })}
        className="px-6 py-2 bg-text text-white rounded-lg font-medium hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-text"
      >
        Sign in with GitHub
      </button>
    </div>
  );
}
