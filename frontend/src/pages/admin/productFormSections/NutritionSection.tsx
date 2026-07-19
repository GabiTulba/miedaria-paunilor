import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProductFormData } from '../../../types';
import type { LotNutrition } from '../../../types/generated/LotNutrition';
import NumberInput from '../../../components/forms/NumberInput';
import { numericOptions, validateNonNegative } from '../../../lib/validators';

// EU nutrition declaration inputs, per 100 ml. Energy allows one decimal
// (DECIMAL(6,1) in the DB); gram fields allow two (DECIMAL(5,2)).
// energy_kj has no input: it is derived from kcal at submit time (see
// normalizeProductPayload in lib/api.ts).
const NUTRITION_FIELDS: { name: keyof LotNutrition; labelKey: string; step: string }[] = [
    { name: 'energy_kcal', labelKey: 'energyKcal', step: '0.1' },
    { name: 'fat', labelKey: 'fat', step: '0.01' },
    { name: 'saturates', labelKey: 'saturates', step: '0.01' },
    { name: 'carbohydrates', labelKey: 'carbohydrates', step: '0.01' },
    { name: 'sugars', labelKey: 'sugars', step: '0.01' },
    { name: 'protein', labelKey: 'protein', step: '0.01' },
    { name: 'salt', labelKey: 'salt', step: '0.01' },
];

function NutritionSection() {
    const { t } = useTranslation();
    const { register, formState: { errors } } = useFormContext<ProductFormData>();

    return (
        <div className="form-section">
            <h2 className="section-title">{t('admin.productForm.nutrition')}</h2>
            <div className="section-content">
                <p className="help-text">{t('admin.productForm.nutritionHelp')}</p>
                {[0, 2, 4, 6].map((rowStart) => (
                    <div className="form-row" key={rowStart}>
                        {NUTRITION_FIELDS.slice(rowStart, rowStart + 2).map(({ name, labelKey, step }) => (
                            <NumberInput
                                key={name}
                                id={name}
                                label={t(`admin.productForm.${labelKey}`)}
                                required
                                step={step}
                                min="0"
                                error={errors[name]?.message}
                                {...register(name, numericOptions((v) => validateNonNegative(v, t(`admin.productForm.${labelKey}`))))}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default NutritionSection;
