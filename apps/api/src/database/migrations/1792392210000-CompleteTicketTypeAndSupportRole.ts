import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CompleteTicketTypeAndSupportRole1792392210000 implements MigrationInterface {
  name = 'CompleteTicketTypeAndSupportRole1792392210000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.tickets
        ADD COLUMN IF NOT EXISTS type varchar(30) NOT NULL DEFAULT 'INCIDENT';
      DO $migration$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'tickets_type_check'
            AND conrelid = 'public.tickets'::regclass
        ) THEN
          ALTER TABLE public.tickets ADD CONSTRAINT tickets_type_check
            CHECK (type IN ('INCIDENT', 'SERVICE_REQUEST'));
        END IF;
      END
      $migration$;
      CREATE INDEX IF NOT EXISTS idx_tickets_type_created
        ON public.tickets (type, created_at DESC);
      CREATE TABLE IF NOT EXISTS public.ticket_type_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
        previous_type varchar(30) NOT NULL,
        new_type varchar(30) NOT NULL,
        changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
        changed_at timestamptz NOT NULL DEFAULT now(),
        CHECK (previous_type IN ('INCIDENT', 'SERVICE_REQUEST')),
        CHECK (new_type IN ('INCIDENT', 'SERVICE_REQUEST'))
      );
      CREATE INDEX IF NOT EXISTS idx_ticket_type_history_ticket
        ON public.ticket_type_history (ticket_id, changed_at DESC);

      INSERT INTO public.roles (code, name, description)
      VALUES ('IT_SUPPORT', 'IT support', 'IT support staff')
      ON CONFLICT (code) DO NOTHING;

      INSERT INTO public.permissions (code, module, description)
      VALUES
        ('tickets.update.assigned', 'tickets', 'Update tickets assigned to the current support user'),
        ('tickets.self_assign', 'tickets', 'Assign an unassigned ticket to the current support user'),
        ('users.directory.read', 'users', 'Read active user names for ticket display')
      ON CONFLICT (code) DO NOTHING;

      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM public.roles r
      CROSS JOIN public.permissions p
      WHERE r.code = 'IT_SUPPORT'
        AND p.code IN ('tickets.read.all', 'tickets.comment', 'assets.read',
                       'tickets.update.assigned', 'tickets.self_assign',
                       'users.directory.read')
      ON CONFLICT DO NOTHING;

    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM public.role_permissions
      WHERE permission_id IN (
        SELECT id FROM public.permissions
        WHERE code IN ('tickets.update.assigned', 'tickets.self_assign',
                       'users.directory.read')
      );
      DELETE FROM public.user_roles
      WHERE role_id IN (SELECT id FROM public.roles WHERE code = 'IT_SUPPORT');
      DELETE FROM public.roles WHERE code = 'IT_SUPPORT';
      DELETE FROM public.permissions
      WHERE code IN ('tickets.update.assigned', 'tickets.self_assign',
                     'users.directory.read');
      DROP TABLE IF EXISTS public.ticket_type_history;
      DROP INDEX IF EXISTS public.idx_tickets_type_created;
      ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_type_check;
      ALTER TABLE public.tickets DROP COLUMN IF EXISTS type;
    `)
  }
}
