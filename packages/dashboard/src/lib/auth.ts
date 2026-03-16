import type { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);
const ALLOWED_ORG = process.env.GITHUB_ALLOWED_ORG ?? '';

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Allow if email is in the explicit allow-list
      if (ALLOWED_EMAILS.length > 0 && user.email && ALLOWED_EMAILS.includes(user.email)) {
        return true;
      }
      // Allow if no restrictions are configured (dev mode)
      if (ALLOWED_EMAILS.length === 0 && !ALLOWED_ORG) {
        return true;
      }
      return false;
    },
  },
  pages: {
    signIn: '/login',
  },
};
