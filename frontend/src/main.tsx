import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Import i18n configuration
import './i18n/config';

import App from './App';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import AboutUs from './pages/AboutUs';
import Contact from './pages/Contact';
import Blog from './pages/Blog';
import BlogPostDetail from './pages/BlogPostDetail';
import NotFound from './pages/NotFound';

// Admin pages are split off into separate chunks so public visitors don't pay
// to download them.
const AdminLayout = React.lazy(() => import('./pages/admin/AdminLayout'));
const AdminLogin = React.lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = React.lazy(() => import('./pages/admin/AdminProducts'));
const AdminProductEdit = React.lazy(() => import('./pages/admin/AdminProductEdit'));
const AdminProductCreate = React.lazy(() => import('./pages/admin/AdminProductCreate'));
const AdminImages = React.lazy(() => import('./pages/admin/AdminImages'));
const AdminBlog = React.lazy(() => import('./pages/admin/AdminBlog'));
const BlogForm = React.lazy(() => import('./pages/admin/BlogForm'));

import ProtectedRoute from './components/ProtectedRoute';
import { detectInitialLang } from './lib/detectInitialLang';

function PrefixWithLangRedirect() {
  const { pathname, search, hash } = useLocation();
  const lang = detectInitialLang();
  const target = `/${lang}${pathname === '/' ? '' : pathname}${search}${hash}`;
  return <Navigate to={target} replace />;
}

const adminFallback = null;
const lazy = (node: React.ReactNode) => <Suspense fallback={adminFallback}>{node}</Suspense>;

const router = createBrowserRouter([
  { path: '/', element: <PrefixWithLangRedirect /> },
  {
    path: '/:lang',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'home', element: <Navigate to=".." replace relative="path" /> },
      { path: 'shop', element: <Shop /> },
      { path: 'shop/:productId', element: <ProductDetails /> },
      { path: 'cart', element: <Cart /> },
      { path: 'blog', element: <Blog /> },
      { path: 'blog/:slug', element: <BlogPostDetail /> },
      { path: 'about-us', element: <AboutUs /> },
      { path: 'contact', element: <Contact /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/admin',
    element: lazy(<AdminLayout />),
    children: [
      { index: true, element: lazy(<AdminLogin />) },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard', element: lazy(<AdminDashboard />) },
          { path: 'dashboard/products', element: lazy(<AdminProducts />) },
          { path: 'dashboard/products/:productId/edit', element: lazy(<AdminProductEdit />) },
          { path: 'dashboard/products/create', element: lazy(<AdminProductCreate />) },
          { path: 'dashboard/images', element: lazy(<AdminImages />) },
          { path: 'dashboard/blog', element: lazy(<AdminBlog />) },
          { path: 'dashboard/blog/create', element: lazy(<BlogForm />) },
          { path: 'dashboard/blog/:id/edit', element: lazy(<BlogForm isEdit={true} />) },
        ],
      },
    ],
  },
]);


import { AuthProvider } from './context/AuthContext';
import { EnumProvider } from './context/EnumContext';

import './index.css';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <EnumProvider>
        <CartProvider>
          <ToastProvider>
            <HelmetProvider>
              <RouterProvider router={router} />
            </HelmetProvider>
          </ToastProvider>
        </CartProvider>
      </EnumProvider>
    </AuthProvider>
  </React.StrictMode>
);
