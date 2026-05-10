import React, { useState } from 'react';
import FormField from './FormField';

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
  maxLength?: number;
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
  maxLength,
  validate,
}) => {
  const [blurError, setBlurError] = useState<string>();
  const displayError = error || blurError;

  const handleBlur = () => {
    if (validate) setBlurError(validate(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (blurError) setBlurError(undefined);
    onChange(e);
  };

  return (
    <FormField id={id} label={label} required={required} helpText={helpText} error={displayError}>
      {({ describedBy }) => (
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
          maxLength={maxLength}
          aria-invalid={displayError ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
    </FormField>
  );
};

export default TextInput;
