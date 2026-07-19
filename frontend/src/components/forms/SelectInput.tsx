import React, { forwardRef } from 'react';
import FormField from './FormField';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  options: SelectOption[];
  error?: string;
  helpText?: string;
}

const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { id, label, options, error, helpText, required = false, ...rest },
  ref,
) {
  return (
    <FormField id={id} label={label} required={required} helpText={helpText} error={error}>
      {({ describedBy }) => (
        <select
          id={id}
          ref={ref}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
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
});

export default SelectInput;
