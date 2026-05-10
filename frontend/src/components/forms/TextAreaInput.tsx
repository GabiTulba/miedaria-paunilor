import React, { useState } from 'react';
import FormField from './FormField';

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
  maxLength?: number;
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
  maxLength,
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

  return (
    <FormField id={id} label={label} required={required} helpText={helpText} error={displayError}>
      {({ describedBy }) => (
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
          maxLength={maxLength}
          aria-invalid={displayError ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
    </FormField>
  );
};

export default TextAreaInput;
