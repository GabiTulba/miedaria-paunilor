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
}) => {
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
      />
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default NumberInput;
