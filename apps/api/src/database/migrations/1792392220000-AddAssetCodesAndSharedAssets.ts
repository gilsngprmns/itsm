import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAssetCodesAndSharedAssets1792392220000 implements MigrationInterface {
  name = 'AddAssetCodesAndSharedAssets1792392220000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS public.asset_code_seq;
      ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS asset_code varchar(40);
      ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;
      UPDATE public.assets
      SET asset_code = 'AST-' || nextval('public.asset_code_seq')::text
      WHERE asset_code IS NULL;
      ALTER TABLE public.assets ALTER COLUMN asset_code
        SET DEFAULT ('AST-' || nextval('public.asset_code_seq')::text);
      ALTER TABLE public.assets ALTER COLUMN asset_code SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_asset_code
        ON public.assets (asset_code);

      INSERT INTO public.permissions (code, module, description)
      VALUES
        ('assets.read.all', 'assets', 'Read all assets and asset history'),
        ('assets.share', 'assets', 'Mark assets as shared for ticket requests')
      ON CONFLICT (code) DO NOTHING;
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
      WHERE r.code IN ('ADMIN', 'AUDIT') AND p.code = 'assets.read.all'
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
      WHERE r.code = 'ADMIN' AND p.code = 'assets.share'
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
      WHERE r.code = 'IT_SUPPORT' AND p.code = 'assets.read.all'
      ON CONFLICT DO NOTHING;
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM public.role_permissions WHERE permission_id IN (
        SELECT id FROM public.permissions WHERE code IN ('assets.read.all', 'assets.share')
      );
      DELETE FROM public.permissions WHERE code IN ('assets.read.all', 'assets.share');
      DROP INDEX IF EXISTS public.idx_assets_asset_code;
      ALTER TABLE public.assets DROP COLUMN IF EXISTS is_shared;
      ALTER TABLE public.assets DROP COLUMN IF EXISTS asset_code;
      DROP SEQUENCE IF EXISTS public.asset_code_seq;
    `)
  }
}
