export interface Product {
  product_id: string;
  product_name: string;
  product_description: string;
  ingredients: string;
  abv: string; // Decimal is a string on the frontend
  bottle_count: number;
  bottle_size: number;
  price: string; // Decimal is a string on the frontend
  image_url: string; // New field for product image
}
