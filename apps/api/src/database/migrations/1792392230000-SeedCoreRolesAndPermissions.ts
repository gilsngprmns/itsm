import type { MigrationInterface, QueryRunner } from 'typeorm'

export class SeedCoreRolesAndPermissions1792392230000 implements MigrationInterface {
  name = 'SeedCoreRolesAndPermissions1792392230000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO public.roles (code, name, description)
      VALUES
        ('ADMIN', 'Administrator', 'Manages users, configuration, assets, and tickets'),
        ('AUDIT', 'Auditor', 'Reviews audit records and inventory compliance'),
        ('USER', 'End User', 'Creates tickets and views authorized assets')
      ON CONFLICT (code) DO NOTHING;

      INSERT INTO public.permissions (code, module, description)
      VALUES
        ('assets.assign', 'assets', 'Assign or transfer assets'),
        ('assets.create', 'assets', 'Register assets'),
        ('assets.maintenance', 'assets', 'Manage asset maintenance'),
        ('assets.read', 'assets', 'View authorized assets'),
        ('assets.retire', 'assets', 'Retire assets'),
        ('assets.update', 'assets', 'Update asset information'),
        ('audit.inventory', 'audit', 'Perform inventory audits'),
        ('audit.read', 'audit', 'Read audit logs'),
        ('reports.read', 'reports', 'View reports'),
        ('roles.manage', 'access', 'Manage roles and permissions'),
        ('settings.manage', 'settings', 'Manage application settings'),
        ('tickets.assign', 'tickets', 'Assign tickets to technicians'),
        ('tickets.comment', 'tickets', 'Comment on tickets'),
        ('tickets.create', 'tickets', 'Create service tickets'),
        ('tickets.manage_sla', 'tickets', 'Manage SLA policies'),
        ('tickets.read.all', 'tickets', 'View all tickets'),
        ('tickets.read.own', 'tickets', 'View own tickets'),
        ('tickets.update', 'tickets', 'Update ticket status and details'),
        ('users.create', 'users', 'Create user accounts'),
        ('users.deactivate', 'users', 'Deactivate user accounts'),
        ('users.read', 'users', 'View user accounts'),
        ('users.update', 'users', 'Update user accounts')
      ON CONFLICT (code) DO NOTHING;

      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM (VALUES
        ('ADMIN', 'assets.assign'),
        ('ADMIN', 'assets.create'),
        ('ADMIN', 'assets.maintenance'),
        ('ADMIN', 'assets.read'),
        ('ADMIN', 'assets.retire'),
        ('ADMIN', 'assets.update'),
        ('ADMIN', 'audit.inventory'),
        ('ADMIN', 'audit.read'),
        ('ADMIN', 'reports.read'),
        ('ADMIN', 'roles.manage'),
        ('ADMIN', 'settings.manage'),
        ('ADMIN', 'tickets.assign'),
        ('ADMIN', 'tickets.comment'),
        ('ADMIN', 'tickets.create'),
        ('ADMIN', 'tickets.manage_sla'),
        ('ADMIN', 'tickets.read.all'),
        ('ADMIN', 'tickets.read.own'),
        ('ADMIN', 'tickets.update'),
        ('ADMIN', 'users.create'),
        ('ADMIN', 'users.deactivate'),
        ('ADMIN', 'users.read'),
        ('ADMIN', 'users.update'),
        ('AUDIT', 'assets.read'),
        ('AUDIT', 'audit.inventory'),
        ('AUDIT', 'audit.read'),
        ('AUDIT', 'reports.read'),
        ('AUDIT', 'tickets.read.all'),
        ('IT_SUPPORT', 'assets.read'),
        ('IT_SUPPORT', 'tickets.comment'),
        ('IT_SUPPORT', 'tickets.read.all'),
        ('USER', 'assets.read'),
        ('USER', 'tickets.comment'),
        ('USER', 'tickets.create'),
        ('USER', 'tickets.read.own')
      ) AS seed(role_code, permission_code)
      JOIN public.roles r ON r.code = seed.role_code
      JOIN public.permissions p ON p.code = seed.permission_code
      ON CONFLICT DO NOTHING;
    `)
  }

  async down(): Promise<void> {
    throw new Error(
      'Core role and permission seed is intentionally non-reversible because accounts may depend on it',
    )
  }
}
