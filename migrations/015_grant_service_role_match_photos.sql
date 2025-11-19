-- Grant service_role permission to execute match_photos function
-- This allows internal server-to-server calls to use the function

GRANT EXECUTE ON FUNCTION match_photos TO service_role;

COMMENT ON FUNCTION match_photos IS 'Search photos using vector similarity. REQUIRES user_id in filter for security. Accessible by authenticated users and service_role for internal calls.';
