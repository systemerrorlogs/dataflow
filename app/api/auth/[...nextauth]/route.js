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

          console.log('🔍 Login attempt for:', credentials.email);

          try {
            const result = await query(
              'SELECT * FROM users WHERE email = $1',
              [credentials.email]
            );

            if (result.rows.length === 0) {
              console.log('❌ No user found');
              throw new Error('Invalid email or password');
            }

            const user = result.rows[0];
            console.log('✅ User found:', user.email);
            console.log('🔑 Has password_hash:', !!user.password_hash);

            // Check if password_hash exists
            if (!user.password_hash) {
              console.log('❌ No password hash in database');
              throw new Error('Account not properly configured. Please contact administrator.');
            }

            // Verify password
            const isValid = await bcrypt.compare(
              credentials.password,
              user.password_hash
            );

            console.log('🔐 Password valid:', isValid);

            if (!isValid) {
              throw new Error('Invalid email or password');
            }

            console.log('✅ Login successful');

            return {
              id: user.id.toString(),
              email: user.email,
              name: user.name
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
    signOut: '/login',  // ✅ Skip confirmation page
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

// ✅ CRITICAL: Export both GET and POST
export { handler as GET, handler as POST };