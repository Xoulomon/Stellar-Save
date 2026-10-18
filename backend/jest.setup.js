if (!process.env['ADMIN_SECRET']) {
  process.env['ADMIN_SECRET'] = 'test-only-admin-secret';
}
if (!process.env['JWT_SECRET']) {
  process.env['JWT_SECRET'] = 'test-only-jwt-secret-value-that-is-long-enough';
}
if (!process.env['CORS_ALLOWED_ORIGINS']) {
  process.env['CORS_ALLOWED_ORIGINS'] = 'http://localhost:3000';
}
