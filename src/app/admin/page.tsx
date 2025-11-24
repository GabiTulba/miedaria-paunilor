"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminPage() {
  const [username, setUsername] = useState('Loading...');
  const router = useRouter();

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const response = await fetch('/api/admin/user');
        if (response.ok) {
          const data = await response.json();
          setUsername(data.username);
        } else {
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Failed to fetch username:', error);
        router.push('/admin/login');
      }
    };
    fetchUsername();
  }, []);

  const handleLogout = async () => {
    // Call the logout API
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
      });

      if (response.ok) {
        // Clear any client-side tokens/cookies if necessary
        document.cookie = 'admin-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        router.push('/admin/login');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Admin Panel</h1>
        <p className="text-center text-gray-700 mb-4">Logged in as: {username}</p>
        <nav className="flex flex-col space-y-4">
          <Link href="/admin/products" className="w-full bg-blue-500 text-white py-2 px-4 rounded-md text-center hover:bg-blue-600 transition duration-200">
            Product Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition duration-200"
          >
            Disconnect
          </button>
        </nav>
      </div>
    </div>
  );
}
