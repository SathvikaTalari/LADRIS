-- Raw project provenance and physical-domain integrity for ML source records.
ALTER TABLE projects ALTER COLUMN milestone_data_status SET DEFAULT 'USER_ENTERED';

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT ck_projects_rehabilitation_pct
    CHECK (rehabilitation_progress_pct IS NULL OR rehabilitation_progress_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT ck_projects_compensation_amounts
    CHECK (estimated_compensation_inr IS NULL OR disbursed_compensation_inr IS NULL OR disbursed_compensation_inr <= estimated_compensation_inr);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT ck_projects_family_counts
    CHECK (total_affected_families IS NULL OR ((families_compensated IS NULL OR families_compensated <= total_affected_families) AND (families_rehabilitated IS NULL OR families_rehabilitated <= total_affected_families)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT ck_projects_coordinates
    CHECK ((latitude IS NULL OR latitude BETWEEN -90 AND 90) AND (longitude IS NULL OR longitude BETWEEN -180 AND 180));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
