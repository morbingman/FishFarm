type RawEnv = Record<string, unknown>;

const REQUIRED = ['DATABASE_URL', 'JWT_ACCESS_SECRET'] as const;

/**
 * Fail fast on missing/invalid configuration instead of booting a half-configured API.
 * Returns a normalized env object so ConfigService.get<number>('PORT') is actually a number.
 */
export function validateEnv(config: RawEnv): RawEnv {
  config = { ...config };
  for (const key of [...REQUIRED, 'DIRECT_URL'] as const) {
    if (typeof config[key] === 'string') config[key] = config[key].trim();
  }
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Put .env in backend/ or set ENV_FILE to your file path.`,
    );
  }

  for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    if (!config[key]) continue;
    let valid = false;
    try {
      const url = new URL(String(config[key]));
      valid = ['postgres:', 'postgresql:'].includes(url.protocol) && !!url.hostname && url.pathname.length > 1;
    } catch { /* Never include the database URL/password in an error. */ }
    if (!valid) throw new Error(`${key} must be a valid PostgreSQL connection URL with a database name.`);
  }

  const port = Number(config.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `PORT must be a valid TCP port, received: ${String(config.PORT)}`,
    );
  }

  const idleMinutes = Number(config.SESSION_IDLE_MINUTES ?? 30);
  if (!Number.isInteger(idleMinutes) || idleMinutes < 1) {
    throw new Error(
      `SESSION_IDLE_MINUTES must be a positive integer, received: ${String(config.SESSION_IDLE_MINUTES)}`,
    );
  }

  const accessTtl = Number(config.JWT_ACCESS_TTL_SECONDS ?? 900);
  if (!Number.isInteger(accessTtl) || accessTtl < 1) {
    throw new Error(
      `JWT_ACCESS_TTL_SECONDS must be a positive integer, received: ${String(config.JWT_ACCESS_TTL_SECONDS)}`,
    );
  }

  const refreshDays = Number(config.REFRESH_TOKEN_TTL_DAYS ?? 30);
  if (!Number.isInteger(refreshDays) || refreshDays < 1) {
    throw new Error(
      `REFRESH_TOKEN_TTL_DAYS must be a positive integer, received: ${String(config.REFRESH_TOKEN_TTL_DAYS)}`,
    );
  }

  return {
    ...config,
    PORT: port,
    SESSION_IDLE_MINUTES: idleMinutes,
    JWT_ACCESS_TTL_SECONDS: accessTtl,
    REFRESH_TOKEN_TTL_DAYS: refreshDays,
  };
}
