-- Fix user role assignment by ensuring all existing users have a role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::app_role 
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.user_roles);