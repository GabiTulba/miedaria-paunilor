import React from 'react';
import FormField from './FormField';

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
  return (
    <FormField id={id} label={label} required={required} helpText={helpText} error={error}>
      {({ describedBy }) => (
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
      )}
    </FormField>
  );
};

export default SelectInput;
