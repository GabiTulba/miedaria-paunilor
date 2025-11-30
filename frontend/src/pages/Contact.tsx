import './Contact.css';

function Contact() {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Handle form submission logic here
        alert('Thank you for your message!');
    };

    return (
        <div className="contact-page">
            <header className="contact-header">
                <h1>Get in Touch</h1>
                <p>We'd love to hear from you. Whether you have a question about our products, or anything else, our team is ready to answer all your questions.</p>
            </header>
            <div className="contact-content">
                <div className="contact-info">
                    <h3>Contact Information</h3>
                    <p>Fill up the form and our team will get back to you within 24 hours.</p>
                    <ul>
                        <li>
                            <i className="icon-phone"></i>
                            <span>+40 123 456 789</span>
                        </li>
                        <li>
                            <i className="icon-email"></i>
                            <span>contact@miedaria-paunilor.ro</span>
                        </li>
                        <li>
                            <i className="icon-location"></i>
                            <span>Str. Fagului, Nr. 1, Brașov, Romania</span>
                        </li>
                    </ul>
                </div>
                <div className="contact-form-container">
                    <form className="contact-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">Name</label>
                            <input type="text" id="name" name="name" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input type="email" id="email" name="email" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="message">Message</label>
                            <textarea id="message" name="message" rows={5} required></textarea>
                        </div>
                        <button type="submit" className="button">Send Message</button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Contact;
