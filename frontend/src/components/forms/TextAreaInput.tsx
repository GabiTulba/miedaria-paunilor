import React from 'react';

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
}) => {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
      />
      {helpText && <p className="help-text">{helpText}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default TextAreaInput;
