import type { MigrationInterface, QueryRunner } from 'typeorm'

export class ExpandAssetTagLength1792392250000 implements MigrationInterface {
  name = 'ExpandAssetTagLength1792392250000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP VIEW public.v_ticket_overview')
    await queryRunner.query('DROP VIEW public.v_asset_inventory')
    await queryRunner.query(
      `ALTER TABLE public.assets
       ALTER COLUMN asset_tag TYPE varchar(100)`,
    )
    await createAssetViews(queryRunner)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT EXISTS (
         SELECT 1 FROM public.assets WHERE length(asset_tag) > 60
       ) AS contains_long_asset_tags`,
    )) as Array<{ contains_long_asset_tags: boolean }>
    if (rows[0]?.contains_long_asset_tags) {
      throw new Error(
        'Cannot shrink asset_tag to varchar(60) while longer asset tags exist',
      )
    }
    await queryRunner.query('DROP VIEW public.v_ticket_overview')
    await queryRunner.query('DROP VIEW public.v_asset_inventory')
    await queryRunner.query(
      `ALTER TABLE public.assets
       ALTER COLUMN asset_tag TYPE varchar(60)`,
    )
    await createAssetViews(queryRunner)
  }
}

async function createAssetViews(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    CREATE VIEW public.v_asset_inventory AS
    SELECT a.id AS asset_id,
           a.asset_tag,
           a.name AS asset_name,
           c.name AS category_name,
           a.manufacturer,
           a.model,
           a.serial_number,
           a.status,
           a.condition,
           l.name AS location_name,
           u.id AS assigned_user_id,
           u.full_name AS assigned_user_name,
           a.warranty_end,
           a.created_at,
           a.updated_at
    FROM public.assets a
    JOIN public.asset_categories c ON c.id = a.category_id
    LEFT JOIN public.locations l ON l.id = a.location_id
    LEFT JOIN public.asset_assignments aa
      ON aa.asset_id = a.id AND aa.returned_at IS NULL
    LEFT JOIN public.users u ON u.id = aa.user_id
    WHERE a.deleted_at IS NULL
  `)
  await queryRunner.query(`
    CREATE VIEW public.v_ticket_overview AS
    SELECT t.id,
           t.ticket_number,
           t.subject,
           t.priority,
           t.status,
           t.created_at,
           t.updated_at,
           requester.full_name AS requester_name,
           technician.full_name AS assigned_technician,
           tc.name AS category_name,
           a.asset_tag,
           a.name AS asset_name,
           t.response_due_at,
           t.resolution_due_at
    FROM public.tickets t
    JOIN public.users requester ON requester.id = t.requester_id
    LEFT JOIN public.users technician ON technician.id = t.assigned_to
    LEFT JOIN public.ticket_categories tc ON tc.id = t.category_id
    LEFT JOIN public.assets a ON a.id = t.asset_id
    WHERE t.deleted_at IS NULL
  `)
}
