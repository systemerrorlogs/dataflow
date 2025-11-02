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
              'SELECT * FROM users WHERE email = $1',
              [credentials.email]
            );

            if (result.rows.length === 0) {
              throw new Error('Invalid email or password');
            }

            const user = result.rows[0];

            // Check if password_hash exists
            if (!user.password_hash) {
              throw new Error('Account not properly configured. Please contact administrator.');
            }

            // Verify password
            const isValid = await bcrypt.compare(
              credentials.password,
              user.password_hash
            );


            if (!isValid) {
              throw new Error('Invalid email or password');
            }

            return {
              id: user.id.toString(),
              email: user.email,
              name: `${user.first_name} ${user.last_name}`,
              is_admin: user.is_admin
            };
          } catch (error) {
            console.error('❌ Auth error:', error);
            throw error;
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
        token.is_admin = user.is_admin;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.is_admin = token.is_admin;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
    signOut: '/login',  // ✅ Skip confirmation page
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

// ✅ CRITICAL: Export both GET and POST
export { handler as GET, handler as POST };