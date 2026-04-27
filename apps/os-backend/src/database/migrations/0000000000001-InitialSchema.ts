import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * InitialSchema — Single source of truth for the full OS database schema.
 *
 * This replaces all previous incremental migrations. It creates the complete
 * schema in one shot for any fresh deployment.
 *
 * For production: run `npm run migration:run` once on a fresh database.
 * After that, only NEW migration files (added in future) will ever run again.
 *
 * Tables created:
 *   - user_types
 *   - client_organizations
 *   - departments
 *   - applications
 *   - users
 *   - user_app_access
 *   - department_default_apps
 *   - sso_tokens
 *   - audit_logs
 */
export class InitialSchema0000000000001 implements MigrationInterface {
  name = 'InitialSchema0000000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── uuid extension ─────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── user_types ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_types" (
        "id"    uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "slug"  varchar NOT NULL,
        "label" varchar NOT NULL,
        CONSTRAINT "PK_user_types"  PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_types_slug" UNIQUE ("slug")
      )
    `);

    // ── client_organizations ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_organizations" (
        "id"         uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "name"       varchar NOT NULL,
        "country"    varchar,
        "is_active"  boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_client_organizations" PRIMARY KEY ("id")
      )
    `);

    // ── departments ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "departments" (
        "id"        uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "slug"      varchar NOT NULL,
        "name"      varchar NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "status"    varchar NOT NULL DEFAULT 'active',
        CONSTRAINT "PK_departments"      PRIMARY KEY ("id"),
        CONSTRAINT "UQ_departments_slug" UNIQUE ("slug")
      )
    `);

    // ── applications ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "applications" (
        "id"          uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "slug"        varchar NOT NULL,
        "name"        varchar NOT NULL,
        "url"         varchar NOT NULL,
        "icon_url"    varchar,
        "webhook_url" varchar,
        "is_active"   boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_applications"      PRIMARY KEY ("id"),
        CONSTRAINT "UQ_applications_slug" UNIQUE ("slug")
      )
    `);

    // ── users_status enum ──────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_status_enum" AS ENUM ('active', 'disabled', 'deleted');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ── users ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"              uuid                NOT NULL DEFAULT uuid_generate_v4(),
        "email"           varchar             NOT NULL,
        "password_hash"   varchar             NOT NULL,
        "name"            varchar             NOT NULL,
        "user_type_id"    uuid                NOT NULL,
        "department_id"   uuid,
        "organization_id" uuid,
        "status"          "users_status_enum" NOT NULL DEFAULT 'active',
        "is_team_lead"    boolean             NOT NULL DEFAULT false,
        "created_at"      TIMESTAMP           NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP           NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users"       PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "FK_users_user_type"
          FOREIGN KEY ("user_type_id") REFERENCES "user_types"("id"),
        CONSTRAINT "FK_users_department"
          FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_users_organization_id"
          FOREIGN KEY ("organization_id") REFERENCES "client_organizations"("id") ON DELETE SET NULL
      )
    `);

    // ── user_app_access ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_app_access" (
        "id"             uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"        uuid    NOT NULL,
        "application_id" uuid    NOT NULL,
        "is_enabled"     boolean NOT NULL DEFAULT true,
        "is_app_admin"   boolean NOT NULL DEFAULT false,
        "granted_by"     uuid    NOT NULL,
        "granted_at"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_app_access"  PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_app_access"  UNIQUE ("user_id", "application_id"),
        CONSTRAINT "FK_uaa_user"
          FOREIGN KEY ("user_id")        REFERENCES "users"("id")        ON DELETE CASCADE,
        CONSTRAINT "FK_uaa_application"
          FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE
      )
    `);

    // ── department_default_apps ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "department_default_apps" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "department_id" uuid NOT NULL,
        "app_id"        uuid NOT NULL,
        CONSTRAINT "PK_department_default_apps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_department_default_apps" UNIQUE ("department_id", "app_id"),
        CONSTRAINT "FK_dda_department"
          FOREIGN KEY ("department_id") REFERENCES "departments"("id")   ON DELETE CASCADE,
        CONSTRAINT "FK_dda_application"
          FOREIGN KEY ("app_id")        REFERENCES "applications"("id")  ON DELETE CASCADE
      )
    `);

    // ── sso_tokens ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sso_tokens" (
        "token_id"   uuid      NOT NULL,
        "user_id"    uuid      NOT NULL,
        "app_slug"   varchar   NOT NULL,
        "used"       boolean   NOT NULL DEFAULT false,
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sso_tokens" PRIMARY KEY ("token_id")
      )
    `);

    // ── audit_logs ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id"          uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id"    varchar   NOT NULL,
        "action"      varchar   NOT NULL,
        "entity_type" varchar,
        "entity_id"   varchar,
        "before"      jsonb,
        "after"       jsonb,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // ── Indexes ────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_email"              ON "users"          ("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_status"             ON "users"          ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_app_access_user_id"  ON "user_app_access" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sso_tokens_user_id"       ON "sso_tokens"     ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sso_tokens_expires_at"    ON "sso_tokens"     ("expires_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity"        ON "audit_logs"     ("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor"         ON "audit_logs"     ("actor_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sso_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "department_default_apps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_app_access"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE  IF EXISTS "users_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "applications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "client_organizations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_types"`);
  }
}
