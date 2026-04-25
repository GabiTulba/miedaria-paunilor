import React from 'react';

interface NumberInputProps {
  id: string;
  name: string;
  label: string;
  value: number | string; // Can be string for empty input
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  step?: string;
  min?: string;
  max?: string;
  helpText?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  step,
  min,
  max,
  helpText,
}) => {
  const helpTextId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpTextId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input
        type="number"
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        step={step}
        min={min}
        max={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {helpText && <p className="help-text" id={helpTextId}>{helpText}</p>}
      {error && <p className="error-message" id={errorId}>{error}</p>}
    </div>
  );
};

export default NumberInput;
