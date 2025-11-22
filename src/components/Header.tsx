import Image from 'next/image';
import Link from 'next/link';

const Header = () => {
  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <Image
              src="https://placehold.co/100x40/000000/FFFFFF/png?text=Logo"
              alt="Miedăria Păunilor Logo"
              width={100}
              height={40}
            />
          </Link>
        </div>
        <nav>
          <ul className="flex space-x-4">
            <li><Link href="/" className="text-gray-600 hover:text-gray-900">Home</Link></li>
            <li><Link href="/shop" className="text-gray-600 hover:text-gray-900">Our Meads</Link></li>
            <li><a href="#" className="text-gray-600 hover:text-gray-900">About Us</a></li>
            <li><a href="#" className="text-gray-600 hover:text-gray-900">Contact</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;