import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="page" role="alert">
          <h1>Something went wrong</h1>
          <p>Reload the page to continue.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      )
    }

    return this.props.children
  }
}
