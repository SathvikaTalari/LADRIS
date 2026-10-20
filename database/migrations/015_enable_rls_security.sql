-- =============================================================================
-- LADRIS — Migration 015: Enable Row-Level Security (RLS) on all Public Tables
-- Fixes Supabase Security Advisor "rls_disabled_in_public" critical alerts.
-- =============================================================================
--
-- Why this is needed:
-- 1. Supabase exposes the "public" schema via the PostgREST Data API (HTTPS).
-- 2. When RLS is disabled, anyone with your Supabase URL & anon key can read/modify
--    tables directly over the internet.
-- 3. With RLS enabled:
--    - Direct backend connections (FastAPI via DATABASE_URL / postgres user) continue
--      working normally because table owners / superusers automatically bypass RLS.
--    - Public / anon HTTP requests without explicit policies are rejected by default.
--    - "service_role" retains full administrative access.
-- =============================================================================

-- ─── 1. Dynamically Enable RLS on all existing tables in schema "public" ──────
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping %: %', tbl.tablename, SQLERRM;
        END;
    END LOOP;
END $$;

-- ─── 2. Explicit Fallback for known LADRIS tables ──────────────────────────────
-- In case dynamic iteration misses any newly created or referenced tables:
DO $$
DECLARE
    t TEXT;
    known_tables TEXT[] := ARRAY[
        'users',
        'projects',
        'project_stages',
        'project_events',
        'land_parcels',
        'compensation_records',
        'legal_cases',
        'rr_records',
        'approvals',
        'possessions',
        'predictions',
        'stage_predictions',
        'risk_factors',
        'recommendations',
        'intervention_scenarios',
        'intervention_recommendations',
        'alerts',
        'audit_logs',
        'data_sources',
        'ml_model_registry',
        'data_quality_snapshots',
        'prediction_logs',
        'ml_predictions',
        'project_risk_snapshots',
        'stakeholder_updates',
        'ingestion_jobs',
        'raw_ingestion_records',
        'source_documents',
        'field_mapping_rules',
        'project_interventions',
        'notification_logs',
        'live_sync_jobs',
        'project_change_log',
        'external_la_projects',
        'bhoomirashi_projects',
        'districts',
        'schema_migrations'
    ];
BEGIN
    FOREACH t IN ARRAY known_tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        END IF;
    END LOOP;
END $$;

-- ─── 3. Grant Permissions for service_role (Admin & Supabase Dashboard Access) 
-- Complies with Supabase PostgREST Data API guidelines (including Oct 30 update).
DO $$
DECLARE
    t RECORD;
BEGIN
    -- Check if service_role exists (Supabase environment)
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        FOR t IN
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
        LOOP
            EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', t.tablename);
            
            -- Add explicit permissive policy for service_role if not present
            EXECUTE format(
                'DROP POLICY IF EXISTS "service_role_full_access" ON public.%I; ' ||
                'CREATE POLICY "service_role_full_access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
                t.tablename, t.tablename
            );
        END LOOP;
    END IF;
END $$;
