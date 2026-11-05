import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CompleteTicketAttachmentPermissions1792392260000
  implements MigrationInterface
{
  name = 'CompleteTicketAttachmentPermissions1792392260000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO public.permissions (code, module, description)
      VALUES
        ('tickets.attachments.view', 'tickets', 'View ticket attachments'),
        ('tickets.attachments.upload', 'tickets', 'Upload ticket attachments'),
        ('tickets.attachments.delete', 'tickets', 'Delete ticket attachments')
      ON CONFLICT (code) DO NOTHING;

      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM (VALUES
        ('ADMIN', 'tickets.attachments.view'),
        ('ADMIN', 'tickets.attachments.upload'),
        ('ADMIN', 'tickets.attachments.delete'),
        ('IT_SUPPORT', 'tickets.attachments.view'),
        ('IT_SUPPORT', 'tickets.attachments.upload'),
        ('IT_SUPPORT', 'tickets.attachments.delete'),
        ('USER', 'tickets.attachments.view'),
        ('USER', 'tickets.attachments.upload'),
        ('USER', 'tickets.attachments.delete')
      ) AS seed(role_code, permission_code)
      JOIN public.roles r ON r.code = seed.role_code
      JOIN public.permissions p ON p.code = seed.permission_code
      ON CONFLICT DO NOTHING;
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM public.role_permissions
      WHERE permission_id IN (
        SELECT id FROM public.permissions
        WHERE code IN (
          'tickets.attachments.view',
          'tickets.attachments.upload',
          'tickets.attachments.delete'
        )
      );

      DELETE FROM public.permissions
      WHERE code IN (
        'tickets.attachments.view',
        'tickets.attachments.upload',
        'tickets.attachments.delete'
      );
    `)
  }
}
