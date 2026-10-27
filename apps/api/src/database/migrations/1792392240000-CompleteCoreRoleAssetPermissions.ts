import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CompleteCoreRoleAssetPermissions1792392240000 implements MigrationInterface {
  name = 'CompleteCoreRoleAssetPermissions1792392240000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM (VALUES
        ('ADMIN', 'assets.read.all'),
        ('ADMIN', 'assets.share'),
        ('AUDIT', 'assets.read.all')
      ) AS seed(role_code, permission_code)
      JOIN public.roles r ON r.code = seed.role_code
      JOIN public.permissions p ON p.code = seed.permission_code
      ON CONFLICT DO NOTHING;
    `)
  }

  async down(): Promise<void> {
    throw new Error(
      'Core role asset permissions are intentionally non-reversible because accounts may depend on them',
    )
  }
}
