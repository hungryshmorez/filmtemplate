// ErrorBoundary.tsx — last-resort guard so a render/runtime throw shows a
// recoverable panel instead of a blank screen. Local-first data in Dexie is
// untouched, so "Reload" almost always recovers.
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; the panel below is the user-facing recovery.
    console.error("Show-Writer Studio crashed:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-6 text-center text-neutral-200">
        <div className="max-w-md space-y-3">
          <h1 className="text-lg font-semibold text-amber-300">Something broke on screen</h1>
          <p className="text-[13px] leading-relaxed text-neutral-400">
            The app hit an unexpected error while rendering. Your work is saved locally in this browser and
            wasn&apos;t touched — reloading should bring it right back.
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-900/60 p-2.5 text-left font-mono text-[11px] leading-relaxed text-neutral-500">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-amber-500 px-4 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-400"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
