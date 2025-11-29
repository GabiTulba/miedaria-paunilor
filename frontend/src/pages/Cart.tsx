import { useContext } from 'react';
import { CartContext, CartItem } from '../context/CartContext';

function Cart() {
    const { cartItems, removeFromCart, clearCart } = useContext(CartContext);

    const getTotalPrice = () => {
        return cartItems.reduce((total, item) => total + parseFloat(item.price) * item.quantity, 0).toFixed(2);
    };

    return (
        <div>
            <h2>Cart</h2>
            {cartItems.length === 0 ? (
                <p>Your cart is empty.</p>
            ) : (
                <>
                    <ul>
                        {cartItems.map((item: CartItem) => (
                            <li key={item.product_id}>
                                <span>{item.product_name}</span>
                                <span> x {item.quantity}</span>
                                <span> - {(parseFloat(item.price) * item.quantity).toFixed(2)} €</span>
                                <button onClick={() => removeFromCart(item.product_id)}>Remove</button>
                            </li>
                        ))}
                    </ul>
                    <h3>Total: {getTotalPrice()} €</h3>
                    <button onClick={clearCart}>Clear Cart</button>
                </>
            )}
        </div>
    );
}

export default Cart;
