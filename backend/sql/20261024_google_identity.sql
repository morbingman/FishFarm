-- Google identities are server-only. Existing account data is unchanged.
CREATE TABLE IF NOT EXISTS public."GoogleIdentity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "subject" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL UNIQUE REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public."GoogleIdentity" ENABLE ROW LEVEL SECURITY;
