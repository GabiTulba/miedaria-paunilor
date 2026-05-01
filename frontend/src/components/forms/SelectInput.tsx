import React from 'react';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectInputProps {
  id: string;
  name: string;
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
  helpText?: string;
}

const SelectInput: React.FC<SelectInputProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  options,
  error,
  required = false,
  disabled = false,
  helpText,
}) => {
  const helpTextId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpTextId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}{required && <span className="required-indicator">*</span>}</label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helpText && <p className="help-text" id={helpTextId}>{helpText}</p>}
      {error && <p className="error-message" id={errorId}>{error}</p>}
    </div>
  );
};

export default SelectInput;
