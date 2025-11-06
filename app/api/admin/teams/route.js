import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

// GET - List all teams with member counts
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await query(`
      SELECT
        t.id,
        t.name,
        t.description,
        t.is_active,
        t.created_at,
        COUNT(DISTINCT utm.user_id) FILTER (WHERE utm.is_active = true) as member_count,
        json_agg(
          json_build_object(
            'user_id', u.id,
            'user_email', u.email,
            'user_name', u.first_name || ' ' || u.last_name,
            'role', utm.role
          )
        ) FILTER (WHERE u.id IS NOT NULL AND utm.is_active = true) as members
      FROM teams t
      LEFT JOIN team_members utm ON t.id = utm.team_id AND utm.is_active = true
      LEFT JOIN users u ON utm.user_id = u.id AND u.is_active = true
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);

    return NextResponse.json({ teams: result.rows });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

// POST - Create new team
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    const result = await query(`
      INSERT INTO teams (name, description, is_active, created_by)
      VALUES ($1, $2, true, $3)
      RETURNING id, name, description, is_active, created_at
    `, [name, description || null, session.user.id]);

    return NextResponse.json({ team: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}