/**
 * Stock availability utility functions
 *
 * Thresholds (consistent across all pages):
 * - Out of Stock: bottle_count === 0
 * - Low Stock: bottle_count < 24
 * - In Stock: bottle_count >= 24
 */

export interface StockStatus {
  status: 'out_of_stock' | 'low_stock' | 'in_stock';
  label: string;
  description: string;
  cssClass: string;
}

export type StockVariant = 'admin' | 'shop' | 'product-details';

const CSS_CLASSES: Record<StockVariant, Record<'out_of_stock' | 'low_stock' | 'in_stock', string>> = {
  admin: { out_of_stock: 'status-error', low_stock: 'status-warning', in_stock: 'status-success' },
  shop: { out_of_stock: 'out-of-stock', low_stock: 'low-stock', in_stock: 'in-stock' },
  'product-details': { out_of_stock: 'out-of-stock-details', low_stock: 'low-stock-details', in_stock: 'in-stock-details' },
};

export function getStockStatus(bottleCount: number, variant: StockVariant, t?: (key: string) => string): StockStatus {
  const translate = t || ((key: string) => key);
  const classes = CSS_CLASSES[variant];
  const isAdmin = variant === 'admin';

  if (bottleCount === 0) {
    return {
      status: 'out_of_stock',
      label: translate('common.outOfStock'),
      description: isAdmin ? translate('common.unavailable') : translate('common.outOfStock'),
      cssClass: classes.out_of_stock,
    };
  }

  if (bottleCount < 24) {
    return {
      status: 'low_stock',
      label: translate('common.lowStock'),
      description: isAdmin
        ? `${bottleCount} ${translate('common.bottles')} ${translate('common.available')}`
        : `${translate('common.lowStock')}: ${bottleCount}`,
      cssClass: classes.low_stock,
    };
  }

  return {
    status: 'in_stock',
    label: translate('common.inStock'),
    description: isAdmin
      ? `${bottleCount} ${translate('common.bottles')} ${translate('common.available')}`
      : translate('common.inStock'),
    cssClass: classes.in_stock,
  };
}

export function isInStock(bottleCount: number): boolean {
  return bottleCount > 0;
}

export function getMaxCartQuantity(bottleCount: number): number {
  return Math.min(bottleCount, 99);
}
