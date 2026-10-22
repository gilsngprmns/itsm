import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTicketLocationAndResolutionSummary1792392200000 implements MigrationInterface {
  name = 'AddTicketLocationAndResolutionSummary1792392200000'

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = (await queryRunner.query(
      `SELECT to_regclass('public.tickets') AS tickets,
              to_regclass('public.locations') AS locations,
              pg_get_serial_sequence('public.tickets', 'ticket_number') AS ticket_number_sequence,
              (SELECT is_identity FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'tickets'
                 AND column_name = 'ticket_number') AS ticket_number_is_identity`,
    )) as Array<{
      tickets: string | null
      locations: string | null
      ticket_number_sequence: string | null
      ticket_number_is_identity: 'YES' | 'NO' | null
    }>
    if (!schema[0]?.tickets || !schema[0].locations) {
      throw new Error(
        'Ticket migration requires the existing tickets and locations tables',
      )
    }
    if (
      schema[0].ticket_number_sequence !== 'public.tickets_ticket_number_seq' ||
      schema[0].ticket_number_is_identity !== 'YES'
    ) {
      throw new Error(
        'Ticket migration requires the existing ticket number identity sequence',
      )
    }

    await queryRunner.query(
      `ALTER TABLE public.tickets
         ADD COLUMN IF NOT EXISTS location_id uuid,
         ADD COLUMN IF NOT EXISTS resolution_summary text`,
    )
    await queryRunner.query(`
      DO $migration$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'tickets_location_id_fkey'
            AND conrelid = 'public.tickets'::regclass
        ) THEN
          ALTER TABLE public.tickets
            ADD CONSTRAINT tickets_location_id_fkey
            FOREIGN KEY (location_id) REFERENCES public.locations(id)
            ON DELETE RESTRICT;
        END IF;
      END
      $migration$;
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tickets_location
       ON public.tickets (location_id)`,
    )

    await queryRunner.query(
      `LOCK TABLE public.tickets IN ACCESS EXCLUSIVE MODE`,
    )
    await queryRunner.query(
      `SELECT setval('public.tickets_ticket_number_seq'::regclass,
         GREATEST(COALESCE((SELECT MAX(ticket_number) FROM public.tickets), 0), 1),
         COALESCE((SELECT MAX(ticket_number) FROM public.tickets), 0) > 0)`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS public.idx_tickets_location`)
    await queryRunner.query(
      `ALTER TABLE public.tickets
       DROP CONSTRAINT IF EXISTS tickets_location_id_fkey,
       DROP COLUMN IF EXISTS location_id,
       DROP COLUMN IF EXISTS resolution_summary`,
    )
  }
}
