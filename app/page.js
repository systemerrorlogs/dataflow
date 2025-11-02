'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Wait for session check

    if (!session) {
      // Not logged in - redirect to login
      router.push('/login');
    } else {
      // Logged in - redirect to dashboard
      router.push('/dashboard');
    }
  }, [session, status, router]);

  // Show loading while checking
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-600">Loading...</div>
    </div>
  );
}