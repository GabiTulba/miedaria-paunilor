import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Image, ProductFormData } from '../../../types';
import SelectInput from '../../../components/forms/SelectInput';

interface ImageSectionProps {
    availableImages: Image[];
}

function ImageSection({ availableImages }: ImageSectionProps) {
    const { t } = useTranslation();
    const { register, formState: { errors } } = useFormContext<ProductFormData>();

    return (
        <div className="form-section">
            <h2 className="section-title">{t('admin.productForm.image')}</h2>
            <div className="section-content">
                <SelectInput
                    id="image_id"
                    label={t('admin.productForm.selectImage')}
                    options={[
                        { value: '', label: t('admin.productForm.noImage') },
                        ...availableImages.map((image) => ({
                            value: image.id,
                            label: `${image.file_name} (ID: ${image.id.substring(0, 8)}...)`,
                        })),
                    ]}
                    error={errors.image_id?.message}
                    helpText={t('admin.productForm.selectImage')}
                    {...register('image_id')}
                />
                {availableImages.length === 0 && (
                    <div className="form-alert">
                        <span className="alert-icon warning-icon"></span>
                        <div className="alert-content">
                            <p>{t('admin.productForm.noImage')}</p>
                            <a href="/admin/dashboard/images" className="alert-link">{t('navigation.images')}</a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ImageSection;
