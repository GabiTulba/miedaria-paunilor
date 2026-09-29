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
import CheckoutSuccess from './pages/CheckoutSuccess';
import AboutUs from './pages/AboutUs';
import Contact from './pages/Contact';
import CookiePolicy from './pages/CookiePolicy';
import PrivacyPolicy from './pages/PrivacyPolicy';
import NewsletterConfirm from './pages/NewsletterConfirm';
import NewsletterUnsubscribe from './pages/NewsletterUnsubscribe';
import Blog from './pages/Blog';
import LotDetails from './pages/LotDetails';
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
const AdminBlogCreate = React.lazy(() => import('./pages/admin/AdminBlogCreate'));
const AdminBlogEdit = React.lazy(() => import('./pages/admin/AdminBlogEdit'));
const AdminOrders = React.lazy(() => import('./pages/admin/AdminOrders'));

// Account pages are only needed by customers who use them.
const AccountLogin = React.lazy(() => import('./pages/account/AccountLogin'));
const AccountEmailRequest = React.lazy(() => import('./pages/account/AccountEmailRequest'));
const AccountSetPassword = React.lazy(() => import('./pages/account/AccountSetPassword'));
const AccountEmailConfirm = React.lazy(() => import('./pages/account/AccountEmailConfirm'));
const AccountOrders = React.lazy(() => import('./pages/account/AccountOrders'));
const AccountOrderDetail = React.lazy(() => import('./pages/account/AccountOrderDetail'));
const AccountSettings = React.lazy(() => import('./pages/account/AccountSettings'));

import ProtectedRoute from './components/ProtectedRoute';
import ProtectedAccountRoute from './components/ProtectedAccountRoute';
import { detectInitialLang } from './lib/detectInitialLang';

function PrefixWithLangRedirect() {
  const { pathname, search, hash } = useLocation();
  const lang = detectInitialLang();
  const target = `/${lang}${pathname === '/' ? '' : pathname}${search}${hash}`;
  return <Navigate to={target} replace />;
}

// Bare /lot/{n} (as printed in bottle QR codes) defaults to Romanian,
// mirroring the nginx redirect; kept here for dev-server parity.
function LotRoRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`/ro${pathname}${search}${hash}`} replace />;
}

const lazy = (node: React.ReactNode) => <Suspense fallback={null}>{node}</Suspense>;

const router = createBrowserRouter([
  { path: '/', element: <PrefixWithLangRedirect /> },
  { path: '/lot/:lotNumber', element: <LotRoRedirect /> },
  {
    path: '/:lang',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'home', element: <Navigate to=".." replace relative="path" /> },
      { path: 'shop', element: <Shop /> },
      { path: 'shop/:productId', element: <ProductDetails /> },
      { path: 'lot/:lotNumber', element: <LotDetails /> },
      { path: 'cart', element: <Cart /> },
      { path: 'checkout/success', element: <CheckoutSuccess /> },
      { path: 'blog', element: <Blog /> },
      { path: 'blog/:slug', element: <BlogPostDetail /> },
      { path: 'about-us', element: <AboutUs /> },
      { path: 'contact', element: <Contact /> },
      { path: 'cookie-policy', element: <CookiePolicy /> },
      { path: 'privacy-policy', element: <PrivacyPolicy /> },
      { path: 'newsletter/confirm', element: <NewsletterConfirm /> },
      { path: 'newsletter/unsubscribe', element: <NewsletterUnsubscribe /> },
      { path: 'account/login', element: lazy(<AccountLogin />) },
      { path: 'account/register', element: lazy(<AccountEmailRequest kind="register" />) },
      { path: 'account/forgot-password', element: lazy(<AccountEmailRequest kind="forgotPassword" />) },
      { path: 'account/set-password', element: lazy(<AccountSetPassword />) },
      { path: 'account/email/confirm', element: lazy(<AccountEmailConfirm />) },
      {
        element: <ProtectedAccountRoute />,
        children: [
          { path: 'account', element: lazy(<AccountOrders />) },
          { path: 'account/orders/:orderId', element: lazy(<AccountOrderDetail />) },
          { path: 'account/settings', element: lazy(<AccountSettings />) },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/admin',
    // The session probe (/api/admin/me) only runs on admin pages, not for
    // every shop visitor.
    element: lazy(<AuthProvider><AdminLayout /></AuthProvider>),
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
          { path: 'dashboard/blog/create', element: lazy(<AdminBlogCreate />) },
          { path: 'dashboard/blog/:id/edit', element: lazy(<AdminBlogEdit />) },
          { path: 'dashboard/orders', element: lazy(<AdminOrders />) },
        ],
      },
    ],
  },
]);


import { AuthProvider } from './context/AuthContext';
import { EnumProvider } from './context/EnumContext';

import './index.css';
import { CartProvider } from './context/CartContext';
import { AccountProvider } from './context/AccountContext';
import { ToastProvider } from './context/ToastContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <EnumProvider>
      <AccountProvider>
        <CartProvider>
          <ToastProvider>
            <HelmetProvider>
              <RouterProvider router={router} />
            </HelmetProvider>
          </ToastProvider>
        </CartProvider>
      </AccountProvider>
    </EnumProvider>
  </React.StrictMode>
);
