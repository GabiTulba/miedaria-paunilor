import SelectInput from './SelectInput';

interface BooleanSelectProps {
    id: string;
    name?: string;
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    trueLabel: string;
    falseLabel: string;
    required?: boolean;
    error?: string;
    helpText?: string;
}

// Typed boolean control; thin wrapper over SelectInput that emits a boolean
// directly, removing the `name === 'is_published'` string-coercion sniffing
// previously needed in BlogForm's generic change handler.
export default function BooleanSelect({
    id,
    name,
    label,
    value,
    onChange,
    trueLabel,
    falseLabel,
    required,
    error,
    helpText,
}: BooleanSelectProps) {
    return (
        <SelectInput
            id={id}
            name={name ?? id}
            label={label}
            value={value ? 'true' : 'false'}
            onChange={(e) => onChange(e.target.value === 'true')}
            options={[
                { value: 'true', label: trueLabel },
                { value: 'false', label: falseLabel },
            ]}
            required={required}
            error={error}
            helpText={helpText}
        />
    );
}
