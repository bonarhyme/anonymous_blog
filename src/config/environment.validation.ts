export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const databaseUrl = config.DATABASE_URL;

  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL must be configured.');
  }

  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// protocol.');
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const corsOrigins = config.CORS_ORIGINS;
  if (corsOrigins !== undefined && typeof corsOrigins !== 'string') {
    throw new Error('CORS_ORIGINS must be a comma-separated list of origins.');
  }
  if (typeof corsOrigins === 'string' && corsOrigins.trim()) {
    for (const origin of corsOrigins.split(',').map((value) => value.trim())) {
      if (!origin) {
        throw new Error('CORS_ORIGINS must not contain empty entries.');
      }
      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
      }
      if (
        !['http:', 'https:'].includes(parsedOrigin.protocol) ||
        parsedOrigin.origin !== origin
      ) {
        throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
      }
    }
  }

  return { ...config, PORT: port };
}
