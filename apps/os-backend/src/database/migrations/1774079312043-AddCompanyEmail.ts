import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompanyEmail1774079312043 implements MigrationInterface {
    name = 'AddCompanyEmail1774079312043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "company_email" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "company_email"`);
    }
}
