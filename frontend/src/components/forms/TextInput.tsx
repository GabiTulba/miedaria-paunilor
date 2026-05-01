import React, { useState } from 'react';

interface TextInputProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  helpText?: string;
  autoComplete?: string;
  validate?: (value: string) => string | undefined;
}

const TextInput: React.FC<TextInputProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  type = 'text',
  placeholder,
  helpText,
  autoComplete,
  validate,
}) => {
  const [blurError, setBlurError] = useState<string>();
  const displayError = error || blurError;

  const handleBlur = () => {
    if (validate) setBlurError(validate(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={displayError ? true : undefined}
        aria-describedby={describedBy}
      />
      {helpText && <p className="help-text" id={helpTextId}>{helpText}</p>}
      {displayError && <p className="error-message" id={errorId}>{displayError}</p>}
    </div>
  );
};

export default TextInput;
