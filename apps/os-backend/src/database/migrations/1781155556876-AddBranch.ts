import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBranch1781155556876 implements MigrationInterface {
    name = 'AddBranch1781155556876'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_app_access" DROP CONSTRAINT "FK_uaa_user"`);
        await queryRunner.query(`ALTER TABLE "user_app_access" DROP CONSTRAINT "FK_uaa_application"`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" DROP CONSTRAINT "FK_dda_department"`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" DROP CONSTRAINT "FK_dda_application"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_user_type"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_department"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_organization_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_app_access_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sso_tokens_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sso_tokens_expires_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_entity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_actor"`);
        await queryRunner.query(`ALTER TABLE "user_app_access" DROP CONSTRAINT "UQ_user_app_access"`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" DROP CONSTRAINT "UQ_department_default_apps"`);
        await queryRunner.query(`CREATE TABLE "branch_default_apps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid, "app_id" uuid, CONSTRAINT "UQ_3dcb3af4e88d397de82687fd53f" UNIQUE ("branch_id", "app_id"), CONSTRAINT "PK_865bca70935ef40b07e40a59935" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "name" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "status" character varying NOT NULL DEFAULT 'active', CONSTRAINT "UQ_c2c16397fa98d34f8db37684c41" UNIQUE ("slug"), CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "client_organizations" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "branch_id" uuid`);
        await queryRunner.query(`ALTER TABLE "user_app_access" DROP COLUMN "granted_by"`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ADD "granted_by" character varying`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ALTER COLUMN "user_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ALTER COLUMN "application_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ALTER COLUMN "department_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ALTER COLUMN "app_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "user_type_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sso_tokens" DROP COLUMN "user_id"`);
        await queryRunner.query(`ALTER TABLE "sso_tokens" ADD "user_id" character varying NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_62948e1b2f80c832fa8e7654f5" ON "user_app_access" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_3676155292d72c67cd4e090514" ON "users" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_be2775e6aec59d359203137b7a" ON "sso_tokens" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9368896d17c263897ea7c3ceb3" ON "sso_tokens" ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_177183f29f438c488b5e8510cd" ON "audit_logs" ("actor_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7421efc125d95e413657efa3c6" ON "audit_logs" ("entity_type", "entity_id") `);
        await queryRunner.query(`ALTER TABLE "user_app_access" ADD CONSTRAINT "UQ_38add16df5477da6c39baa5a477" UNIQUE ("user_id", "application_id")`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ADD CONSTRAINT "UQ_d78dcf5f4f77b5331f6f6b2f122" UNIQUE ("department_id", "app_id")`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ADD CONSTRAINT "FK_62948e1b2f80c832fa8e7654f58" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ADD CONSTRAINT "FK_74c20ba4f2681f7ed49b21af23c" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ADD CONSTRAINT "FK_0497a4d26c4f016e17e44b13884" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ADD CONSTRAINT "FK_3478dacdf5c28fa3fcb6be9a6c3" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "branch_default_apps" ADD CONSTRAINT "FK_f787b0e26f21e71bbc62496ae0e" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "branch_default_apps" ADD CONSTRAINT "FK_3be3ad7199647a0b6d43fe111c7" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_cd9740f36970d326b3f65bd5e99" FOREIGN KEY ("user_type_id") REFERENCES "user_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_0921d1972cf861d568f5271cd85" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_5a58f726a41264c8b3e86d4a1de" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_21a659804ed7bf61eb91688dea7" FOREIGN KEY ("organization_id") REFERENCES "client_organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // Data Migration: Insert 'HO (Chembur)' branch and assign to existing internal users
        await queryRunner.query(`INSERT INTO "branches" ("slug", "name", "is_active", "status") VALUES ('ho-chembur', 'HO (Chembur)', true, 'active')`);
        await queryRunner.query(`
          UPDATE "users" 
          SET "branch_id" = (SELECT "id" FROM "branches" WHERE "slug" = 'ho-chembur' LIMIT 1)
          WHERE "branch_id" IS NULL 
          AND "user_type_id" IN (SELECT "id" FROM "user_types" WHERE "slug" != 'client')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_21a659804ed7bf61eb91688dea7"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_5a58f726a41264c8b3e86d4a1de"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_0921d1972cf861d568f5271cd85"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_cd9740f36970d326b3f65bd5e99"`);
        await queryRunner.query(`ALTER TABLE "branch_default_apps" DROP CONSTRAINT "FK_3be3ad7199647a0b6d43fe111c7"`);
        await queryRunner.query(`ALTER TABLE "branch_default_apps" DROP CONSTRAINT "FK_f787b0e26f21e71bbc62496ae0e"`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" DROP CONSTRAINT "FK_3478dacdf5c28fa3fcb6be9a6c3"`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" DROP CONSTRAINT "FK_0497a4d26c4f016e17e44b13884"`);
        await queryRunner.query(`ALTER TABLE "user_app_access" DROP CONSTRAINT "FK_74c20ba4f2681f7ed49b21af23c"`);
        await queryRunner.query(`ALTER TABLE "user_app_access" DROP CONSTRAINT "FK_62948e1b2f80c832fa8e7654f58"`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" DROP CONSTRAINT "UQ_d78dcf5f4f77b5331f6f6b2f122"`);
        await queryRunner.query(`ALTER TABLE "user_app_access" DROP CONSTRAINT "UQ_38add16df5477da6c39baa5a477"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7421efc125d95e413657efa3c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_177183f29f438c488b5e8510cd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9368896d17c263897ea7c3ceb3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_be2775e6aec59d359203137b7a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3676155292d72c67cd4e090514"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62948e1b2f80c832fa8e7654f5"`);
        await queryRunner.query(`ALTER TABLE "sso_tokens" DROP COLUMN "user_id"`);
        await queryRunner.query(`ALTER TABLE "sso_tokens" ADD "user_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "user_type_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ALTER COLUMN "app_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ALTER COLUMN "department_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ALTER COLUMN "application_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_app_access" DROP COLUMN "granted_by"`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ADD "granted_by" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "branch_id"`);
        await queryRunner.query(`ALTER TABLE "client_organizations" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`DROP TABLE "branches"`);
        await queryRunner.query(`DROP TABLE "branch_default_apps"`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ADD CONSTRAINT "UQ_department_default_apps" UNIQUE ("department_id", "app_id")`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ADD CONSTRAINT "UQ_user_app_access" UNIQUE ("user_id", "application_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actor_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_id", "entity_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_sso_tokens_expires_at" ON "sso_tokens" ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_sso_tokens_user_id" ON "sso_tokens" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_users_status" ON "users" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_app_access_user_id" ON "user_app_access" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_organization_id" FOREIGN KEY ("organization_id") REFERENCES "client_organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_user_type" FOREIGN KEY ("user_type_id") REFERENCES "user_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ADD CONSTRAINT "FK_dda_application" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "department_default_apps" ADD CONSTRAINT "FK_dda_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ADD CONSTRAINT "FK_uaa_application" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_app_access" ADD CONSTRAINT "FK_uaa_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
