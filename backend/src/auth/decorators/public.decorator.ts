import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Marks a route as reachable without an access token. Auth is default-deny. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
