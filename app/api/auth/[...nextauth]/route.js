async authorize(credentials) {
  const result = await query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [credentials.email]
  );

  const user = result.rows[0];
  
  if (!user) {
    return null;
  }

  const bcrypt = require('bcryptjs');
  const isValid = await bcrypt.compare(credentials.password, user.password_hash);
  
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: `${user.first_name} ${user.last_name}`,
    is_admin: user.is_admin,
  };
}