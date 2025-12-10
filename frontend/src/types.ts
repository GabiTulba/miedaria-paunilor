export interface Image {
  id: string; // UUID as string
  file_name: string;
  storage_path: string;
  created_at: string; // NaiveDateTime as string
  file_size: number;
}

export interface Product {
  product_id: string;
  product_name: string;
  product_description: string;
  ingredients: string;
  product_type: string;
  sweetness: string;

  turbidity: string;
  effervescence: string;
  acidity: string;
  tanins: string;
  body: string;
  abv: number; // Decimal as number
  bottle_count: number;
  bottle_size: number;
  price: number; // Decimal as number
  image_id: string; // Reference to Image.id
}

export interface ProductWithImage {
  product: Product;
  image: Image | null;
}