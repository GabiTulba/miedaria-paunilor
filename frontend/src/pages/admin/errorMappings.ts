import { Product } from '../../types';

export const errorMapping: Record<string, keyof Product> = {
    InvalidProductId: "product_id",
    EmptyProductName: "product_name",
    EmptyProductDescription: "product_description",
    EmptyIngredients: "ingredients",
    InvalidAbv: "abv",
    InvalidBottleCount: "bottle_count",
    InvalidBottleSize: "bottle_size",
    InvalidPrice: "price",
    InvalidAbvPrecision: "abv",
    InvalidPricePrecision: "price",
};

export const errorMessageMapping: Record<string, string> = {
    InvalidProductId: "Product ID can only contain lowercase letters, dashes and underscores.",
    EmptyProductName: "Product name cannot be empty.",
    EmptyProductDescription: "Product description cannot be empty.",
    EmptyIngredients: "Ingredients cannot be empty.",
    InvalidAbv: "ABV must be between 0.0 and 99.9.",
    InvalidBottleCount: "Bottle count must be a non-negative integer.",
    InvalidBottleSize: "Bottle size must be a positive integer.",
    InvalidPrice: "Price must be between 0.00 and 999.99.",
    InvalidAbvPrecision: "ABV must have at most 1 decimal place.",
    InvalidPricePrecision: "Price must have at most 2 decimal places.",
};
