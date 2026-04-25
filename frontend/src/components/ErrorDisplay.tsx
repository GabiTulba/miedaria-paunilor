interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

function ErrorDisplay({ error, onRetry, retryLabel = 'Retry', className }: ErrorDisplayProps) {
  return (
    <div className={`error-state${className ? ` ${className}` : ''}`} role="alert">
      <div className="error-icon warning-icon"></div>
      <p className="error-message">{error}</p>
      {onRetry && (
        <button onClick={onRetry} className="button button-secondary">
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export default ErrorDisplay;
