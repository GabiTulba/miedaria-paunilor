import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import './Cart.css';

function Cart() {
    const { cartItems, removeFromCart, updateQuantity, clearCart } = useContext(CartContext);

    const getTotalPrice = () => {
        return cartItems.reduce((total, item) => total + parseFloat(item.price) * item.quantity, 0).toFixed(2);
    };

    return (
        <div className="cart-page">
            <header className="cart-header">
                <h1>Your Shopping Cart</h1>
            </header>

            {cartItems.length === 0 ? (
                <div className="empty-cart">
                    <p>Your cart is empty.</p>
                    <Link to="/shop" className="button">Continue Shopping</Link>
                </div>
            ) : (
                <div className="cart-content">
                    <div className="cart-items-list">
                        {cartItems.map(item => (
                            <div key={item.product_id} className="cart-item">
                                <div className="cart-item-details">
                                    <h3>{item.product_name}</h3>
                                    <p className="cart-item-price">{item.price} €</p>
                                    <div className="quantity-selector-cart">
                                        <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>-</button>
                                        <span>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>+</button>
                                    </div>
                                    <p className="cart-item-subtotal">
                                        Subtotal: {(parseFloat(item.price) * item.quantity).toFixed(2)} €
                                    </p>
                                </div>
                                <button className="remove-item-btn" onClick={() => removeFromCart(item.product_id)}>
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>

                    <aside className="cart-summary">
                        <h3>Order Summary</h3>
                        <div className="summary-total">
                            <span>Total</span>
                            <span>{getTotalPrice()} €</span>
                        </div>
                        <button className="button checkout-btn">Proceed to Checkout</button>
                        <button className="button-secondary clear-cart-btn" onClick={clearCart}>
                            Clear Cart
                        </button>
                    </aside>
                </div>
            )}
        </div>
    );
}

export default Cart;
