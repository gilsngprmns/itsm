import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { CreateTicketDto } from '../src/modules/tickets/dto/create-ticket.dto'
import { UpdateTicketDto } from '../src/modules/tickets/dto/update-ticket.dto'

describe('ticket type validation', () => {
  it('requires a valid type when creating a ticket', async () => {
    const missing = Object.assign(new CreateTicketDto(), {
      subject: 'Access issue',
      description: 'Cannot sign in',
      categoryId: '6c0fbc2a-f9ba-46d5-bba6-cbff05a26e4b',
    })
    const valid = Object.assign(new CreateTicketDto(), missing, {
      type: 'INCIDENT',
    })
    const invalid = Object.assign(new CreateTicketDto(), missing, {
      type: 'OTHER',
    })

    expect(
      (await validate(missing)).some((error) => error.property === 'type'),
    ).toBe(true)
    expect(await validate(valid)).toHaveLength(0)
    expect(
      (await validate(invalid)).some((error) => error.property === 'type'),
    ).toBe(true)
  })

  it('rejects null or unknown types when reclassifying', async () => {
    const invalidValues = [null, 'OTHER']
    for (const type of invalidValues) {
      const dto = Object.assign(new UpdateTicketDto(), { type })
      expect(
        (await validate(dto)).some((error) => error.property === 'type'),
      ).toBe(true)
    }
  })
})
