import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProductFormData } from '../../../types';
import EnumSelect, { EnumKind } from '../../../components/forms/EnumSelect';

// Field name → enum kind; rendered in pairs per form-row.
const CHARACTERISTIC_FIELDS: { name: keyof ProductFormData & string; kind: EnumKind; labelKey: string }[] = [
    { name: 'product_type', kind: 'mead_type', labelKey: 'productType' },
    { name: 'sweetness', kind: 'sweetness', labelKey: 'sweetness' },
    { name: 'turbidity', kind: 'turbidity', labelKey: 'turbidity' },
    { name: 'effervescence', kind: 'effervescence', labelKey: 'effervescence' },
    { name: 'acidity', kind: 'acidity', labelKey: 'acidity' },
    { name: 'tannins', kind: 'tannins', labelKey: 'tannins' },
    { name: 'body', kind: 'body', labelKey: 'body' },
];

function CharacteristicsSection() {
    const { t } = useTranslation();
    const { register, formState: { errors } } = useFormContext<ProductFormData>();

    return (
        <div className="form-section">
            <h2 className="section-title">{t('admin.productForm.characteristics')}</h2>
            <div className="section-content">
                {[0, 2, 4, 6].map((rowStart) => (
                    <div className="form-row" key={rowStart}>
                        {CHARACTERISTIC_FIELDS.slice(rowStart, rowStart + 2).map(({ name, kind, labelKey }) => (
                            <EnumSelect
                                key={name}
                                id={name}
                                label={t(`admin.productForm.${labelKey}`)}
                                kind={kind}
                                placeholder={t(`admin.productForm.${labelKey}`)}
                                required
                                error={errors[name]?.message as string | undefined}
                                {...register(name)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CharacteristicsSection;
