import styles from './Legal.module.css'

export default function Terms() {
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1>Terms & Conditions</h1>
        <p className={styles.meta}>Last updated: March 12, 2026</p>

        <h2>SMS Messaging Program</h2>
        <p>Sweet Red Peach operates an SMS notification program to send customers transactional order updates. By providing your phone number and consenting to receive messages, you agree to the following terms.</p>

        <h2>Program Description</h2>
        <p>Sweet Red Peach sends SMS messages to notify customers of order status updates, including order confirmation and pickup readiness notifications. This is a transactional messaging program — we do not send promotional or marketing messages.</p>

        <h2>Message Frequency</h2>
        <p>Message frequency varies based on order activity. You will typically receive one to two messages per order — one when your order is confirmed and one when it is ready for pickup.</p>

        <h2>Message and Data Rates</h2>
        <p>Standard message and data rates may apply depending on your mobile carrier and plan. Sweet Red Peach is not responsible for any charges incurred from receiving SMS messages.</p>

        <h2>How to Opt Out</h2>
        <p>You may opt out of SMS notifications at any time by replying STOP to any message from Sweet Red Peach. After opting out, you will no longer receive SMS notifications for future orders. To re-enroll, reply START or provide verbal consent when placing your next order.</p>

        <h2>How to Get Help</h2>
        <p>For help with SMS messages, reply HELP to any message or contact Sweet Red Peach directly through our Google Business page.</p>

        <h2>Supported Carriers</h2>
        <p>SMS notifications are available on all major US carriers. Carrier support may vary.</p>

        <h2>Privacy</h2>
        <p>Your information is handled in accordance with our <a href="/privacy">Privacy Policy</a>. We do not share your phone number with third parties for marketing purposes.</p>

        <h2>Contact</h2>
        <p>For questions about these terms, please contact Sweet Red Peach through our Google Business page or by calling us directly.</p>
      </div>
    </div>
  )
}
