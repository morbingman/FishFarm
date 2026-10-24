import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Works from src/config (development) and dist/config (production).
export const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
export const envFilePath = resolve(backendRoot, process.env.ENV_FILE?.trim() || '.env');
