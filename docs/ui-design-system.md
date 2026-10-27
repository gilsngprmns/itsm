# UI design system

The web app uses a small CSS-token system in `apps/web/src/index.css` and
shared component styles in `apps/web/src/App.css`. Keep page-specific rules
limited to layout or behavior that is unique to that workflow.

## Foundations

| Token                                        | Use                                                       |
| -------------------------------------------- | --------------------------------------------------------- |
| `--color-canvas`                             | Main application background                               |
| `--color-surface`                            | Cards, forms, and table surfaces                          |
| `--color-ink` / `--color-muted`              | Primary and secondary text                                |
| `--color-line`                               | Borders and separators                                    |
| `--color-primary` / `--color-primary-strong` | Primary actions and navigation                            |
| `--color-accent`                             | Active navigation and restrained emphasis                 |
| `--color-status-*`                           | Semantic success, info, warning, danger, and neutral text |
| `--radius-control`                           | Buttons and form controls                                 |
| `--radius-panel`                             | Panels, tables, and grouped content                       |
| `--shadow-panel`                             | Subtle elevation for key panels                           |

Typography uses the system UI stack. Maintain readable body copy, compact
metadata, and clear page/section heading hierarchy instead of introducing
page-specific font families or arbitrary color palettes.

## Shared patterns

- `PageHeader` standardizes page titles, descriptions, and actions.
- `StatusBadge` provides text labels and a semantic marker; status must not rely
  on color alone.
- `EmptyState` and `ErrorBanner` provide shared feedback semantics.
- `.data-table`, `.table-scroll`, `.form-grid`, `.button-link`, and
  `.button-primary` are the existing cross-page style primitives.
- Preserve permission checks in the UI and API; hiding an action is not a
  substitute for server authorization.

## Responsive and accessibility behavior

- The authenticated shell switches to an off-canvas navigation below 760px.
  Closed navigation is removed from visual and keyboard navigation. An open
  menu traps keyboard focus, Escape closes it, and focus returns to the toggle.
- Data tables may use a constrained horizontal scroll container; avoid causing
  horizontal overflow on the whole page.
- Keep visible `:focus-visible` styling, semantic headings, labeled fields,
  and announced loading/error/success states.
- Respect `prefers-reduced-motion`.
- Validate login and authenticated workflows at desktop and narrow viewport
  widths when browser access and an authorized test account are available.
