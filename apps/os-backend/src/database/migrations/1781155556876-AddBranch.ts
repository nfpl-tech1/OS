import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBranch1781155556876 implements MigrationInterface {
    name = 'AddBranch1781155556876'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Branches Table
        await queryRunner.query(`CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "name" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "status" character varying NOT NULL DEFAULT 'active', CONSTRAINT "UQ_c2c16397fa98d34f8db37684c41" UNIQUE ("slug"), CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`);
        
        // Create Branch Default Apps Table
        await queryRunner.query(`CREATE TABLE "branch_default_apps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid, "app_id" uuid, CONSTRAINT "UQ_3dcb3af4e88d397de82687fd53f" UNIQUE ("branch_id", "app_id"), CONSTRAINT "PK_865bca70935ef40b07e40a59935" PRIMARY KEY ("id"))`);
        
        // Add branch_id to Users
        await queryRunner.query(`ALTER TABLE "users" ADD "branch_id" uuid`);

        // Add Foreign Keys
        await queryRunner.query(`ALTER TABLE "branch_default_apps" ADD CONSTRAINT "FK_f787b0e26f21e71bbc62496ae0e" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "branch_default_apps" ADD CONSTRAINT "FK_3be3ad7199647a0b6d43fe111c7" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_5a58f726a41264c8b3e86d4a1de" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

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
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_5a58f726a41264c8b3e86d4a1de"`);
        await queryRunner.query(`ALTER TABLE "branch_default_apps" DROP CONSTRAINT "FK_3be3ad7199647a0b6d43fe111c7"`);
        await queryRunner.query(`ALTER TABLE "branch_default_apps" DROP CONSTRAINT "FK_f787b0e26f21e71bbc62496ae0e"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "branch_id"`);
        await queryRunner.query(`DROP TABLE "branch_default_apps"`);
        await queryRunner.query(`DROP TABLE "branches"`);
    }

}
