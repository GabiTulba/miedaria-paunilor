// Form-only shapes used by admin form pages.
import type { Product } from './models';
import type { LotNutrition } from './generated/LotNutrition';
import type { AcidityType } from './generated/AcidityType';
import type { BodyType } from './generated/BodyType';
import type { EffervescenceType } from './generated/EffervescenceType';
import type { MeadType } from './generated/MeadType';
import type { SweetnessType } from './generated/SweetnessType';
import type { TanninsType } from './generated/TanninsType';
import type { TurbidityType } from './generated/TurbidityType';

// Form state allows enum fields to be `''` while the user has not yet picked a
// value. Validation at submit ensures the wire payload matches `Product`.
export type ProductFormData = Omit<
    Product,
    'product_id' | 'updated_at' | 'deleted_at'
    | 'product_type' | 'sweetness' | 'turbidity' | 'effervescence'
    | 'acidity' | 'tannins' | 'body'
> & {
    product_id?: string;
    product_type: MeadType | '';
    sweetness: SweetnessType | '';
    turbidity: TurbidityType | '';
    effervescence: EffervescenceType | '';
    acidity: AcidityType | '';
    tannins: TanninsType | '';
    body: BodyType | '';
} & LotNutrition;

export type { NewBlogPost } from './generated/NewBlogPost';
export type { UpdateBlogPost } from './generated/UpdateBlogPost';
