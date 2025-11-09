// File: app/api/admin/[...resource]/route.js
// Consolidates all admin routes (users, teams, etc.)

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

// ============================================
// ADMIN ROUTE HANDLER
// ============================================

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resource } = params;
  const [resourceType, resourceId, subResource] = resource || [];

  try {
    // LIST USERS: GET /api/admin/users
    if (resourceType === 'users' && !resourceId) {
      const result = await query(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.is_admin, u.is_active,
               json_agg(
                 json_build_object(
                   'team_id', tm.team_id,
                   'team_name', t.name,
                   'role', tm.role
                 )
               ) FILTER (WHERE tm.team_id IS NOT NULL) as teams
        FROM users u
        LEFT JOIN team_members tm ON u.id = tm.user_id
        LEFT JOIN teams t ON tm.team_id = t.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `);

      return NextResponse.json({ users: result.rows });
    }

    // LIST TEAMS: GET /api/admin/teams
    if (resourceType === 'teams' && !resourceId) {
      const result = await query(`
        SELECT t.*,
               COUNT(tm.user_id) as member_count,
               json_agg(
                 json_build_object(
                   'user_id', u.id,
                   'user_name', u.first_name || ' ' || u.last_name,
                   'user_email', u.email,
                   'role', tm.role
                 )
               ) FILTER (WHERE u.id IS NOT NULL) as members
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        LEFT JOIN users u ON tm.user_id = u.id
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `);

      return NextResponse.json({ teams: result.rows });
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Admin GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resource } = params;
  const [resourceType, resourceId, subResource] = resource || [];

  try {
    const body = await request.json();

    // CREATE USER: POST /api/admin/users
    if (resourceType === 'users' && !resourceId) {
      const { email, password, first_name, last_name, is_admin } = body;

      // Check if user exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return NextResponse.json(
          { error: 'User already exists' },
          { status: 400 }
        );
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      const result = await query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_admin)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, first_name, last_name, is_admin, is_active
      `, [email, password_hash, first_name, last_name, is_admin || false]);

      return NextResponse.json({ user: result.rows[0] });
    }

    // CREATE TEAM: POST /api/admin/teams
    if (resourceType === 'teams' && !resourceId) {
      const { name, description } = body;

      const result = await query(`
        INSERT INTO teams (name, description)
        VALUES ($1, $2)
        RETURNING *
      `, [name, description]);

      return NextResponse.json({ team: result.rows[0] });
    }

    // ADD TEAM MEMBER: POST /api/admin/teams/[teamId]/members
    if (resourceType === 'teams' && resourceId && subResource === 'members') {
      const { user_id, role } = body;

      // Check if already member
      const existing = await query(`
        SELECT * FROM team_members
        WHERE team_id = $1 AND user_id = $2
      `, [resourceId, user_id]);

      if (existing.rows.length > 0) {
        return NextResponse.json(
          { error: 'User already in team' },
          { status: 400 }
        );
      }

      await query(`
        INSERT INTO team_members (team_id, user_id, role)
        VALUES ($1, $2, $3)
      `, [resourceId, user_id, role || 'member']);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Admin POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resource } = params;
  const [resourceType, resourceId] = resource || [];

  try {
    const body = await request.json();

    // UPDATE USER: PATCH /api/admin/users/[userId]
    if (resourceType === 'users' && resourceId) {
      const { email, password, first_name, last_name, is_admin, is_active } = body;

      let password_hash = null;
      if (password) {
        password_hash = await bcrypt.hash(password, 10);
      }

      const result = await query(`
        UPDATE users
        SET email = COALESCE($1, email),
            password_hash = COALESCE($2, password_hash),
            first_name = COALESCE($3, first_name),
            last_name = COALESCE($4, last_name),
            is_admin = COALESCE($5, is_admin),
            is_active = COALESCE($6, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, email, first_name, last_name, is_admin, is_active
      `, [email, password_hash, first_name, last_name, is_admin, is_active, resourceId]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({ user: result.rows[0] });
    }

    // UPDATE TEAM: PATCH /api/admin/teams/[teamId]
    if (resourceType === 'teams' && resourceId) {
      const { name, description, is_active } = body;

      const result = await query(`
        UPDATE teams
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            is_active = COALESCE($3, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [name, description, is_active, resourceId]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      return NextResponse.json({ team: result.rows[0] });
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Admin PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resource } = params;
  const [resourceType, resourceId, subResource] = resource || [];
  const { searchParams } = new URL(request.url);

  try {
    // DELETE USER: DELETE /api/admin/users/[userId]
    if (resourceType === 'users' && resourceId && !subResource) {
      const result = await query(`
        UPDATE users
        SET is_active = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `, [resourceId]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // DELETE TEAM: DELETE /api/admin/teams/[teamId]
    if (resourceType === 'teams' && resourceId && !subResource) {
      const result = await query(`
        UPDATE teams
        SET is_active = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `, [resourceId]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      // Remove all members
      await query('DELETE FROM team_members WHERE team_id = $1', [resourceId]);

      return NextResponse.json({ success: true });
    }

    // REMOVE TEAM MEMBER: DELETE /api/admin/teams/[teamId]/members?userId=X
    if (resourceType === 'teams' && resourceId && subResource === 'members') {
      const userId = searchParams.get('userId');

      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
      }

      const result = await query(`
        DELETE FROM team_members
        WHERE team_id = $1 AND user_id = $2
        RETURNING *
      `, [resourceId, userId]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Admin DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}