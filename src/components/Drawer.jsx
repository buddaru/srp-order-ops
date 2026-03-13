import { useState } from 'react'
import { fmtDate, fmtTime, orderTotal, fmt$ } from '../utils/helpers'
import styles from './Drawer.module.css'

export default function Drawer({ order, onClose, onSmsLog, showToast }) {
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)

  if (!order) return null

  const fmtNotifTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) + ' · ' +
      d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })
  }
  const total = orderTotal(order)

  const sendSms = async () => {
    if (!msg.trim()) return
    const text = msg.trim()
    const preview = text.substring(0, 55) + (text.length > 55 ? '…' : '')
    setMsg('')
    setSent(true)
    setTimeout(() => setSent(false), 3000)
    onSmsLog(order.id, `📱 SMS to ${order.phone || 'customer'}: "${preview}"`)
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: order.phone, message: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast({ label: '⚠️ SMS failed', customer: order.customer, msg: data.error || 'Could not send SMS.' })
      } else {
        showToast({ label: '📱 SMS sent!', customer: order.customer, msg: text.substring(0, 80) })
      }
    } catch {
      showToast({ label: '⚠️ SMS error', customer: order.customer, msg: 'Network error — SMS not sent.' })
    }
  }

  const createdLabel = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true })
    : '—'

  return (
    <div className={styles.drawer}>
      <div className={styles.header}>
        <div>
          <div className={styles.name}>{order.customer}</div>
          <div className={styles.meta}>{order.id} · {fmtDate(order.pickupDate)} at {fmtTime(order.pickupTime)}</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>
      <div className={styles.body}>
        {order.image && <img src={order.image} alt="Order" className={styles.orderImg} />}

        <span className={styles.sectionLabel}>Order details</span>
        <table className={styles.pricingTable}>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i}>
                <td>{item.qty}× {item.name}</td>
                <td>{fmt$((parseFloat(item.price)||0)*(parseInt(item.qty)||0))}</td>
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

        {order.notes && <div className={styles.notes}>📝 {order.notes}</div>}

        <div className={styles.createdRow}>
          <span className={styles.createdLabel}>Order created</span>
          <span className={styles.createdVal}>{createdLabel}</span>
        </div>

        <span className={styles.sectionLabel}>Notification log</span>
        <div className={styles.notifLog}>
          {order.notifications.length === 0
            ? <div className={styles.emptyNotif}>No updates sent yet.</div>
            : order.notifications.map((n, i) => {
                const text = typeof n === 'object' ? n.text : n
                const ts   = typeof n === 'object' ? n.ts : null
                return (
                  <div key={i} className={styles.notifItem}>
                    <div className={styles.notifDot} />
                    <div>
                      <div className={styles.notifText}>{text}</div>
                      {ts && <div className={styles.notifTime}>{fmtNotifTime(ts)}</div>}
                    </div>
                  </div>
                )
              })
          }
        </div>

        <div className={styles.contactSection}>
          <span className={styles.sectionLabel}>Contact customer (SMS)</span>
          <div className={styles.contactTo}>
            {order.phone ? <>To: <strong>{order.phone}</strong></> : <em>No phone number on file</em>}
          </div>
          <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Type your SMS message…" style={{height:80,marginTop:6}} />
          <button className={styles.sendBtn} onClick={sendSms}>Send SMS</button>
          {sent && <div className={styles.sentConfirm}>✓ SMS logged successfully</div>}
        </div>
      </div>
    </div>
  )
}
