import { Component, ErrorInfo, ReactNode } from 'react';
import i18n from '../i18n/config';
import ErrorDisplay from './ErrorDisplay';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <ErrorDisplay
          error={i18n.t('errors.generic')}
          onRetry={() => window.location.reload()}
          retryLabel={i18n.t('common.retry')}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
