-- LOCAL SYNTHETIC HARNESS ONLY. The runner has no remote endpoint or credentials.
CREATE EXTENSION pg_graphql;
CREATE SCHEMA graphql_public;
CREATE SCHEMA extensions;
-- Standard installed extras found in the existing schema metadata. Official EDB modules.
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION pg_stat_statements WITH SCHEMA extensions;
CREATE FUNCTION graphql_public.graphql(
 "operationName" text DEFAULT NULL,query text DEFAULT NULL,
 variables jsonb DEFAULT NULL,extensions jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE sql AS $$
 select graphql.resolve(
  query := query,
  variables := coalesce(variables, '{}'),
  "operationName" := "operationName",
  extensions := extensions
 );
$$;
GRANT USAGE ON SCHEMA graphql_public,graphql,extensions TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA graphql TO anon,authenticated;
GRANT EXECUTE ON FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) TO anon,authenticated;
COMMENT ON SCHEMA public IS '@graphql({"inflect_names": true, "introspection": true})';
