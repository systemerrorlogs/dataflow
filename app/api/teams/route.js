// ==============================================
// /app/api/teams/route.js - List User Teams
// ==============================================
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

import { query } from '@/lib/db';

export async function GET(req) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // For now, return all teams (add auth later)
    const result = await query(
      `SELECT t.id, t.name, t.description, 'admin' as role
       FROM teams t
       WHERE t.is_active = true
       ORDER BY t.name`
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}