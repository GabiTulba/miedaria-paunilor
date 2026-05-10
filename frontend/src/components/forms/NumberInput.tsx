import React, { useState } from 'react';
import FormField from './FormField';

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

  return (
    <FormField id={id} label={label} required={required} helpText={helpText} error={displayError}>
      {({ describedBy }) => (
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
      )}
    </FormField>
  );
};

export default NumberInput;
