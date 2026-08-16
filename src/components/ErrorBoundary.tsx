import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Backstop. The QR encoder throws synchronously, and without a boundary a
 * single bad input unmounts the whole root and leaves a blank document. Any
 * failure that gets past the local guards should still leave something on
 * screen to read and a way out.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unrecoverable render error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-[420px] border border-edge panel p-6">
          <h1 className="label mb-4 !text-bone">Something broke</h1>
          <p className="mb-5 text-[12px] leading-[1.6] text-ash">
            The interface hit an error it could not recover from. Your settings are not saved
            anywhere, so reloading starts fresh.
          </p>
          <p className="mb-6 font-mono text-[11px] leading-[1.5] text-ash break-words">
            {this.state.error.message}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
