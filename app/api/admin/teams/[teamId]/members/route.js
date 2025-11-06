import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

// POST - Add user to team
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { teamId } = params;
    const body = await request.json();
    const { user_id, role = 'member' } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Check if membership already exists
    const existing = await query(`
      SELECT id, is_active FROM team_members
      WHERE user_id = $1 AND team_id = $2
    `, [user_id, teamId]);

    let result;

    if (existing.rows.length > 0) {
      // Reactivate existing membership
      result = await query(`
        UPDATE team_members
        SET is_active = true, role = $1
        WHERE user_id = $2 AND team_id = $3
        RETURNING id, user_id, team_id, role, joined_at
      `, [role, user_id, teamId]);
    } else {
      // Create new membership
      result = await query(`
        INSERT INTO team_members (user_id, team_id, role, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING id, user_id, team_id, role, joined_at
      `, [user_id, teamId, role]);
    }

    return NextResponse.json({ membership: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}

// DELETE - Remove user from team
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { teamId } = params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 });
    }

    const result = await query(`
      UPDATE team_members
      SET is_active = false
      WHERE user_id = $1 AND team_id = $2
      RETURNING id
    `, [userId, teamId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User removed from team successfully' });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
  }
}