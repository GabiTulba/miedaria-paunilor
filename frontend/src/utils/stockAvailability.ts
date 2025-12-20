/**
 * Stock availability utility functions
 * 
 * Unified logic for determining stock status across the application
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

/**
 * Get stock status for admin pages
 * Uses consistent thresholds: <24 = low stock
 */
export function getAdminStockStatus(bottleCount: number, t?: (key: string) => string): StockStatus {
  const translate = t || ((key: string) => key);
  
  if (bottleCount === 0) {
    return {
      status: 'out_of_stock',
      label: translate('common.outOfStock'),
      description: translate('common.unavailable'),
      cssClass: 'status-error'
    };
  }
  
  if (bottleCount < 24) {
    return {
      status: 'low_stock',
      label: translate('common.lowStock'),
      description: `${bottleCount} ${translate('common.bottles')} ${translate('common.available')}`,
      cssClass: 'status-warning'
    };
  }
  
  return {
    status: 'in_stock',
    label: translate('common.inStock'),
    description: `${bottleCount} ${translate('common.bottles')} ${translate('common.available')}`,
    cssClass: 'status-success'
  };
}

/**
 * Get stock status for shop pages
 * Uses consistent thresholds: <24 = low stock
 */
export function getShopStockStatus(bottleCount: number, t?: (key: string) => string): StockStatus {
  const translate = t || ((key: string) => key);
  
  if (bottleCount === 0) {
    return {
      status: 'out_of_stock',
      label: translate('common.outOfStock'),
      description: translate('common.outOfStock'),
      cssClass: 'out-of-stock'
    };
  }
  
  if (bottleCount < 24) {
    return {
      status: 'low_stock',
      label: translate('common.lowStock'),
      description: `${translate('common.lowStock')}: ${bottleCount}`,
      cssClass: 'low-stock'
    };
  }
  
  return {
    status: 'in_stock',
    label: translate('common.inStock'),
    description: translate('common.inStock'),
    cssClass: 'in-stock'
  };
}

/**
 * Get stock status for product details page
 * Uses consistent thresholds: <24 = low stock
 */
export function getProductDetailsStockStatus(bottleCount: number, t?: (key: string) => string): StockStatus {
  const translate = t || ((key: string) => key);
  
  if (bottleCount === 0) {
    return {
      status: 'out_of_stock',
      label: translate('common.outOfStock'),
      description: translate('common.outOfStock'),
      cssClass: 'out-of-stock-details'
    };
  }
  
  if (bottleCount < 24) {
    return {
      status: 'low_stock',
      label: translate('common.lowStock'),
      description: `${translate('common.lowStock')}: ${bottleCount}`,
      cssClass: 'low-stock-details'
    };
  }
  
  return {
    status: 'in_stock',
    label: translate('common.inStock'),
    description: translate('common.inStock'),
    cssClass: 'in-stock-details'
  };
}

/**
 * Check if product is in stock (for add to cart buttons)
 */
export function isInStock(bottleCount: number): boolean {
  return bottleCount > 0;
}

/**
 * Get maximum quantity that can be added to cart
 */
export function getMaxCartQuantity(bottleCount: number): number {
  return Math.min(bottleCount, 99); // Limit to 99 per order
}