REVOKE ALL ON FUNCTION public.create_audit_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_audit_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated, service_role;