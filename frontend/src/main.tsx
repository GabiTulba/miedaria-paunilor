import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// Import i18n configuration
import './i18n/config';

import App from './App';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import AboutUs from './pages/AboutUs';
import Contact from './pages/Contact';
import AdminLayout from './pages/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductEdit from './pages/admin/AdminProductEdit';
import AdminProductCreate from './pages/admin/AdminProductCreate';
import AdminImages from './pages/admin/AdminImages';
import AdminBlog from './pages/admin/AdminBlog';
import BlogForm from './pages/admin/BlogForm';
import Blog from './pages/Blog';
import BlogPostDetail from './pages/BlogPostDetail';

import ProtectedRoute from './components/ProtectedRoute';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <Home /> },
      { path: 'shop', element: <Shop /> },
      { path: 'shop/:productId', element: <ProductDetails /> },
      { path: 'cart', element: <Cart /> },
      { path: 'blog', element: <Blog /> },
      { path: 'blog/:slug', element: <BlogPostDetail /> },
      { path: 'about-us', element: <AboutUs /> },
      { path: 'contact', element: <Contact /> },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminLogin /> },
          {
            element: <ProtectedRoute />,
            children: [
              { path: 'dashboard', element: <AdminDashboard /> },
              { path: 'dashboard/products', element: <AdminProducts /> },
              { path: 'dashboard/products/:productId/edit', element: <AdminProductEdit /> },
              { path: 'dashboard/products/create', element: <AdminProductCreate /> },
              { path: 'dashboard/images', element: <AdminImages /> }, // New route for image upload
              { path: 'dashboard/blog', element: <AdminBlog /> },
              { path: 'dashboard/blog/create', element: <BlogForm /> },
              { path: 'dashboard/blog/:id/edit', element: <BlogForm isEdit={true} /> },
            ],
          },
        ],
      },
    ],
  },
]);

// ... rest of the file


import { AuthProvider } from './context/AuthContext';
import { EnumProvider } from './context/EnumContext';

// ... (rest of the imports)

// ... (router definition)

import './index.css';
import { CartProvider } from './context/CartContext';
// ... other imports

// ... router definition

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <EnumProvider>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </EnumProvider>
    </AuthProvider>
  </React.StrictMode>
);