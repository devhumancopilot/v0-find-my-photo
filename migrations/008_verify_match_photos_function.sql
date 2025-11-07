-- Verify that match_photos function exists and has SECURITY DEFINER
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  provolatile as volatility,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'match_photos';

-- If is_security_definer is 'f' (false), the function needs to be recreated
-- It should be 't' (true) after running migration 005

-- Also check the function's search_path
SELECT
  proname,
  proconfig
FROM pg_proc
WHERE proname = 'match_photos';
