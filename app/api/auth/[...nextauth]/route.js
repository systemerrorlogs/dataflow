import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

export const authOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter email and password');
        }

        try {
          const result = await query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [credentials.email]
          );

          if (result.rows.length === 0) {
            throw new Error('No user found');
          }

          const user = result.rows[0];

          if (!user.password_hash) {
            throw new Error('Invalid login method');
          }

          const isValid = await bcrypt.compare(
            credentials.password,
            user.password_hash
          );

          if (!isValid) {
            throw new Error('Invalid password');
          }

          await query(
            'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
          );

          return {
            id: user.id.toString(),
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
          };
        } catch (error) {
          throw new Error(error.message || 'Authentication failed');
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };