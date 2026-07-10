
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_module(uuid, public.app_module) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module(uuid, public.app_module) TO authenticated, service_role;
