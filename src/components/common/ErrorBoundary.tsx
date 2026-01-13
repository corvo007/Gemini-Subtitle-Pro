import React, { type ErrorInfo, type ReactNode } from 'react';
import { Translation } from 'react-i18next';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { logger } from '@/services/utils/logger';

interface Props {
  children: ReactNode;
  variant?: 'default' | 'compact';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Uncaught error', error);
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleHardReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.variant === 'compact') {
        return (
          <Translation ns="app">
            {(t) => (
              <div className="h-full w-full min-h-[200px] flex flex-col items-center justify-center bg-slate-900/50 border border-red-500/20 rounded-xl p-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">
                  {t('errorBoundary.compactTitle', 'Component Error')}
                </h3>
                <p className="text-xs text-slate-400 mb-3 max-w-[250px]">
                  {this.state.error?.message || t('errorBoundary.unknownError')}
                </p>
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg font-medium transition-colors border border-slate-700"
                >
                  <RefreshCcw className="w-3 h-3 mr-1.5" />
                  {t('errorBoundary.retry')}
                </button>
              </div>
            )}
          </Translation>
        );
      }

      return (
        <Translation ns="app">
          {(t) => (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-lg w-full shadow-2xl text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">{t('errorBoundary.title')}</h1>
                <p className="text-slate-400 mb-6">{t('errorBoundary.description')}</p>

                {this.state.error && (
                  <div className="bg-slate-950 border border-slate-800 rounded p-4 mb-6 text-left overflow-auto max-h-40 custom-scrollbar">
                    <p className="text-red-400 font-mono text-xs break-all">
                      {this.state.error.toString()}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={this.handleRetry}
                    className="inline-flex items-center px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    {t('errorBoundary.retry')}
                  </button>

                  <button
                    onClick={this.handleHardReload}
                    className="inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    {t('errorBoundary.reload')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Translation>
      );
    }

    return this.props.children;
  }
}
