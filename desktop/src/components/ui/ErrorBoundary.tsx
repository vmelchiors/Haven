import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    componentStack: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Haven React ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack || null });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-haven-darkest p-6 text-slate-200">
          <div className="max-w-2xl w-full bg-haven-surface p-6 rounded-2xl border border-haven-border shadow-2xl flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-haven-rose flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Algo deu errado</h2>
              <p className="text-xs text-slate-400 mt-1">
                Ocorreu uma falha na renderização da interface.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-haven-darker p-3 rounded-lg border border-haven-border font-mono text-[11px] text-haven-rose text-left overflow-auto max-h-48 whitespace-pre-wrap">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
                {this.state.componentStack && `\n\nComponent Stack:\n${this.state.componentStack}`}
              </div>
            )}

            <Button
              variant="primary"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="gap-2 w-full"
            >
              <RefreshCw className="w-4 h-4" />
              Limpar Cache e Recarregar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
