import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET - List all users
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await query(`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.is_admin,
        u.created_at,
        u.last_login_at,
        json_agg(
          json_build_object(
            'team_id', t.id,
            'team_name', t.name,
            'role', utm.role
          )
        ) FILTER (WHERE t.id IS NOT NULL) as teams
      FROM users u
      LEFT JOIN team_members utm ON u.id = utm.user_id AND utm.is_active = true
      LEFT JOIN teams t ON utm.team_id = t.id AND t.is_active = true
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST - Create new user
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, first_name, last_name, is_admin = false } = body;

    // Validate required fields
    if (!email || !password || !first_name || !last_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_admin, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, email, first_name, last_name, is_admin, is_active, created_at
    `, [email, password_hash, first_name, last_name, is_admin]);

    return NextResponse.json({ user: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}