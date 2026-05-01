import React, { useState } from 'react';

interface TextAreaInputProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  helpText?: string;
  validate?: (value: string) => string | undefined;
}

const TextAreaInput: React.FC<TextAreaInputProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  rows = 3,
  placeholder,
  helpText,
  validate,
}) => {
  const [blurError, setBlurError] = useState<string>();
  const displayError = error || blurError;

  const handleBlur = () => {
    if (validate) setBlurError(validate(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (blurError) setBlurError(undefined);
    onChange(e);
  };

  const helpTextId = helpText ? `${id}-help` : undefined;
  const errorId = displayError ? `${id}-error` : undefined;
  const describedBy = [helpTextId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}{required && <span className="required-indicator">*</span>}</label>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={displayError ? true : undefined}
        aria-describedby={describedBy}
      />
      {helpText && <p className="help-text" id={helpTextId}>{helpText}</p>}
      {displayError && <p className="error-message" id={errorId}>{displayError}</p>}
    </div>
  );
};

export default TextAreaInput;
