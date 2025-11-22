import ProductList from "@/components/ProductList";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <ProductList limit={4} />
      <div className="text-center mb-16">
        <Link href="/shop" className="bg-yellow-500 text-white px-6 py-3 rounded-md hover:bg-yellow-600">
          See more
        </Link>
      </div>
    </>
  );
}
