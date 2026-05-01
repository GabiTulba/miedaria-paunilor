import React, { useState } from 'react';

interface NumberInputProps {
  id: string;
  name: string;
  label: string;
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  step?: string;
  min?: string;
  max?: string;
  helpText?: string;
  validate?: (value: string) => string | undefined;
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
  validate,
}) => {
  const [blurError, setBlurError] = useState<string>();
  const displayError = error || blurError;

  const handleBlur = () => {
    if (validate) setBlurError(validate(String(value)));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (blurError) setBlurError(undefined);
    onChange(e);
  };

  const helpTextId = helpText ? `${id}-help` : undefined;
  const errorId = displayError ? `${id}-error` : undefined;
  const describedBy = [helpTextId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}{required && <span className="required-indicator">*</span>}</label>
      <input
        type="number"
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        step={step}
        min={min}
        max={max}
        aria-invalid={displayError ? true : undefined}
        aria-describedby={describedBy}
      />
      {helpText && <p className="help-text" id={helpTextId}>{helpText}</p>}
      {displayError && <p className="error-message" id={errorId}>{displayError}</p>}
    </div>
  );
};

export default NumberInput;
