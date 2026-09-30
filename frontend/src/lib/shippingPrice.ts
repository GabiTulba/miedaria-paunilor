import type { LocalizedShippingRate } from '../types/generated/LocalizedShippingRate';

/// What the customer pays for `rate` on `productsTotal` worth of products,
/// both in the currency the site shows.
export function shippingPrice(rate: LocalizedShippingRate, productsTotal: number): number {
    return rate.free_from !== null && productsTotal >= rate.free_from ? 0 : rate.price;
}
