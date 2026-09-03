-- 1. Root cause: stop granting ALL on every new public table to anon/authenticated/service_role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM service_role;

-- 2. assume_role_audit: append-only, owner read-only, inserts via service_role only
REVOKE ALL ON public.assume_role_audit FROM anon;
REVOKE ALL ON public.assume_role_audit FROM authenticated;
GRANT SELECT ON public.assume_role_audit TO authenticated;
REVOKE ALL ON public.assume_role_audit FROM service_role;
GRANT SELECT, INSERT ON public.assume_role_audit TO service_role;

-- 3. clients: owner-scoped CRUD, no anon, no TRUNCATE/REFERENCES/TRIGGER
REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.clients FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
REVOKE ALL ON public.clients FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO service_role;

-- 4. auditor_identity: same treatment
REVOKE ALL ON public.auditor_identity FROM anon;
REVOKE ALL ON public.auditor_identity FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditor_identity TO authenticated;
REVOKE ALL ON public.auditor_identity FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditor_identity TO service_role;

-- 5. RLS enforced regardless of table owner context
ALTER TABLE public.assume_role_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditor_identity ENABLE ROW LEVEL SECURITY;