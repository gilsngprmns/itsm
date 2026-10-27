interface TicketChangedDetail {
  ticketId: string
}

const eventName = 'itsm:ticket-changed'
const channelName = 'itsm-ticket-changes'

export function announceTicketChanged(ticketId: string): void {
  const detail: TicketChangedDetail = { ticketId }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(channelName)
      channel.postMessage(detail)
      channel.close()
      return
    } catch {
      // Fall back to same-tab updates if cross-tab messaging is unavailable.
    }
  }

  window.dispatchEvent(
    new CustomEvent<TicketChangedDetail>(eventName, { detail }),
  )
}

export function onTicketChanged(
  callback: (detail: TicketChangedDetail) => void,
): () => void {
  const handleWindowEvent = (event: Event) => {
    const detail = (event as CustomEvent<TicketChangedDetail>).detail
    if (detail?.ticketId) callback(detail)
  }

  window.addEventListener(eventName, handleWindowEvent)

  if (typeof BroadcastChannel === 'undefined') {
    return () => window.removeEventListener(eventName, handleWindowEvent)
  }

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(channelName)
    channel.addEventListener(
      'message',
      (event: MessageEvent<TicketChangedDetail>) => {
        if (event.data?.ticketId) callback(event.data)
      },
    )
  } catch {
    channel = null
  }

  return () => {
    window.removeEventListener(eventName, handleWindowEvent)
    channel?.close()
  }
}
