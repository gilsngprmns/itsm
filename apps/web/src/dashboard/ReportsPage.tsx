import { useCallback, useEffect, useState } from 'react'
import { ErrorBanner } from '../common/Feedback'
import { PageHeader } from '../common/PageHeader'
import { ApiRequestError, apiRequest } from '../lib/api'
import { onTicketChanged } from '../tickets/ticket-events'
import { CountList, DateFilter, Metric, PanelHeading } from './DashboardPage'
import type { TicketReport, AssetReport } from './report-types'
import { dateRangeDefaults, dateLabel } from './report-utils'

interface ReportsResult {
  period: { startDate: string; endDate: string }
  tickets: TicketReport
  assets: AssetReport
}

export function ReportsPage() {
  const defaults = dateRangeDefaults()
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [report, setReport] = useState<ReportsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ startDate, endDate })
    try {
      setReport(await apiRequest<ReportsResult>(`reports/overview?${params}`))
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError && cause.status === 403
          ? 'Your account does not have permission to view reports.'
          : 'Unable to load operational reports.',
      )
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
    }
  }, [load])

  useEffect(
    () =>
      onTicketChanged(() => {
        setLoading(true)
        void load()
      }),
    [load],
  )

  return (
    <main className="page management-page dashboard-page">
      <PageHeader title="Reports" />
      <DateFilter
        endDate={endDate}
        onEndDateChange={(value) => {
          setLoading(true)
          setEndDate(value)
        }}
        onStartDateChange={(value) => {
          setLoading(true)
          setStartDate(value)
        }}
        startDate={startDate}
      />
      {error && (
        <ErrorBanner className="dashboard-error">
          <span>{error}</span>
          <button onClick={() => void load()} type="button">
            Try again
          </button>
        </ErrorBanner>
      )}
      {loading && <p role="status">Loading reports…</p>}
      {!loading && report && (
        <>
          <p className="report-period">
            From {dateLabel(report.period.startDate)} to{' '}
            {dateLabel(report.period.endDate)}
          </p>
          <section className="metric-grid" aria-label="Report totals">
            <Metric
              label="Tickets created"
              value={report.tickets.totalCreated}
            />
            <Metric
              label="Tickets resolved"
              value={report.tickets.resolvedInPeriod}
            />
            <Metric label="Assets in inventory" value={report.assets.total} />
          </section>
          <div className="dashboard-columns">
            <section
              className="report-panel"
              aria-labelledby="report-ticket-status"
            >
              <PanelHeading id="report-ticket-status" title="Ticket status" />
              <CountList items={report.tickets.byStatus} />
            </section>
            <section
              className="report-panel"
              aria-labelledby="report-ticket-type"
            >
              <PanelHeading id="report-ticket-type" title="Ticket type" />
              <CountList items={report.tickets.byType} />
            </section>
            <section
              className="report-panel"
              aria-labelledby="report-ticket-priority"
            >
              <PanelHeading
                id="report-ticket-priority"
                title="Ticket priority"
              />
              <CountList items={report.tickets.byPriority} />
            </section>
            <section
              className="report-panel"
              aria-labelledby="report-ticket-category"
            >
              <PanelHeading
                id="report-ticket-category"
                title="Tickets by category"
              />
              <CountList items={report.tickets.byCategory} />
            </section>
            <section
              className="report-panel"
              aria-labelledby="report-asset-status"
            >
              <PanelHeading id="report-asset-status" title="Asset status" />
              <CountList items={report.assets.byStatus} />
            </section>
            <section
              className="report-panel"
              aria-labelledby="report-asset-category"
            >
              <PanelHeading
                id="report-asset-category"
                title="Assets by category"
              />
              <CountList items={report.assets.byCategory} />
            </section>
            {report.assets.byLocation && (
              <section
                className="report-panel"
                aria-labelledby="report-asset-location"
              >
                <PanelHeading
                  id="report-asset-location"
                  title="Assets by location"
                />
                <CountList items={report.assets.byLocation} />
              </section>
            )}
          </div>
          <section
            className="report-panel"
            aria-labelledby="report-ticket-trend"
          >
            <PanelHeading
              id="report-ticket-trend"
              title="Tickets created over time"
            />
            {report.tickets.trend.length === 0 ? (
              <p className="empty-state">
                No tickets were created in this period.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Tickets created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.tickets.trend.map((point) => (
                      <tr key={point.date}>
                        <td>{dateLabel(point.date)}</td>
                        <td>{point.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
