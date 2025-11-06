const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:F1shnr0d@localhost:5433/dataflow'
});

async function fixPassword() {
  try {
    const email = 'admin@example.com';
    const password = 'R3pt1l3#1';

    // Generate hash
    const hash = bcrypt.hashSync(password, 10);
    console.log('Generated hash:', hash);

    // Update user
    const result = await pool.query(
      'UPDATE dataflow.users SET password_hash = $1 WHERE email = $2 RETURNING email',
      [hash, email]
    );

    if (result.rowCount > 0) {
      console.log('✅ Password updated successfully for:', email);
      console.log('📧 You can now login with:');
      console.log('   Email:', email);
      console.log('   Password:', password);
    } else {
      console.log('❌ User not found:', email);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixPassword();