import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="mx-auto max-w-xl rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8 text-center">
          <h2 className="text-lg font-semibold text-rose-100">Something went wrong</h2>
          <p className="mt-3 text-sm text-rose-100/70">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="mt-5 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Reload dashboard
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}
