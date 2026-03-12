import { useState } from 'react'
import { fmtDate, fmtTime, orderTotal, fmt$, fakeTime } from '../utils/helpers'
import styles from './Drawer.module.css'

export default function Drawer({ order, onClose, onSmsLog, showToast }) {
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)

  if (!order) return null

  const total = orderTotal(order)

  const sendSms = () => {
    if (!msg.trim()) return
    const preview = msg.substring(0, 55) + (msg.length > 55 ? '…' : '')
    onSmsLog(order.id, `📱 SMS to ${order.phone || 'customer'}: "${preview}"`)
    showToast({ label: '📱 SMS sent', customer: order.customer, msg: msg.substring(0, 80) })
    setMsg('')
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className={styles.drawer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.name}>{order.customer}</div>
          <div className={styles.meta}>
            {order.id} · {fmtDate(order.pickupDate)} at {fmtTime(order.pickupTime)}
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>

      <div className={styles.body}>
        {/* Image */}
        {order.image && (
          <img src={order.image} alt="Order" className={styles.orderImg} />
        )}

        {/* Order Details — single pricing table, no duplication */}
        <span className={styles.sectionLabel}>Order details</span>
        <table className={styles.pricingTable}>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i}>
                <td>{item.qty}× {item.name}</td>
                <td>{fmt$((parseFloat(item.price) || 0) * (parseInt(item.qty) || 0))}</td>
              </tr>
            ))}
            {total > 0 && (
              <tr className={styles.totalRow}>
                <td>Order total</td>
                <td>{fmt$(total)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Notes */}
        {order.notes && (
          <div className={styles.notes}>📝 {order.notes}</div>
        )}

        {/* Notification log */}
        <span className={styles.sectionLabel}>Notification log</span>
        <div className={styles.notifLog}>
          {order.notifications.length === 0 ? (
            <div className={styles.emptyNotif}>No updates sent yet.</div>
          ) : (
            order.notifications.map((n, i) => (
              <div key={i} className={styles.notifItem}>
                <div className={styles.notifDot} />
                <div>
                  <div className={styles.notifText}>{n}</div>
                  <div className={styles.notifTime}>{fakeTime(i, order.notifications.length)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Contact */}
        <div className={styles.contactSection}>
          <span className={styles.sectionLabel}>Contact customer (SMS)</span>
          <div className={styles.contactTo}>
            {order.phone
              ? <>To: <strong>{order.phone}</strong></>
              : <em>No phone number on file</em>
            }
          </div>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Type your SMS message…"
            style={{ height: 80, marginTop: 6 }}
          />
          <button className={styles.sendBtn} onClick={sendSms}>Send SMS</button>
          {sent && <div className={styles.sentConfirm}>✓ SMS logged successfully</div>}
        </div>
      </div>
    </div>
  )
}
