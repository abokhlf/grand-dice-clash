INSERT INTO public.user_roles (user_id, role)
VALUES ('8bc3e632-0fb4-4b9c-92d9-cc829d132502', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles SET coins = 999999 WHERE id = '8bc3e632-0fb4-4b9c-92d9-cc829d132502';