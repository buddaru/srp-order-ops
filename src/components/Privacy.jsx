import styles from './Legal.module.css'

export default function Privacy() {
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1>Privacy Policy</h1>
        <p className={styles.meta}>Last updated: March 12, 2026</p>

        <h2>About Sweet Red Peach</h2>
        <p>Sweet Red Peach is a bakery business located in Carson, California. This privacy policy explains how we collect, use, and protect customer information in connection with our order management and SMS notification services.</p>

        <h2>Information We Collect</h2>
        <p>When you place an order with Sweet Red Peach, we may collect the following:</p>
        <ul>
          <li>Full name</li>
          <li>Phone number</li>
          <li>Email address</li>
          <li>Order details and pickup date</li>
          <li>SMS consent status</li>
        </ul>

        <h2>How We Use Your Information</h2>
        <p>We use your information solely to fulfill your order and send order status updates:</p>
        <ul>
          <li>To process and manage your bakery order</li>
          <li>To send transactional SMS notifications about your order, including confirmation and pickup readiness</li>
          <li>To maintain records for operational and bookkeeping purposes</li>
        </ul>

        <h2>SMS Communications</h2>
        <p>We send SMS messages only to customers who have provided verbal consent at the time of ordering. Message frequency varies based on order status. Standard message and data rates may apply. You may opt out at any time by replying STOP to any message. For help, reply HELP.</p>

        <h2>Data Sharing</h2>
        <p>We do not sell, trade, or share your personal information with third parties for marketing purposes. Your information is used exclusively for order fulfillment and communication. We use Twilio to deliver SMS messages and Supabase to securely store order data.</p>

        <h2>Data Retention</h2>
        <p>We retain order information for bookkeeping and operational purposes. You may request deletion of your information by contacting us directly.</p>

        <h2>Contact Us</h2>
        <p>If you have questions about this privacy policy or your data, please contact Sweet Red Peach directly through our Google Business page or by calling us.</p>
      </div>
    </div>
  )
}
