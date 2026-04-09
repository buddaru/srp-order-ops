import { useState } from 'react'
import { fmtDate, fmtTime, fmtTimeRange, orderTotal, fmt$ } from '../utils/helpers'
import styles from './Drawer.module.css'

export default function Drawer({ order, onClose, onSmsLog, showToast }) {
  const [msg, setMsg]           = useState('')
  const [sent, setSent]         = useState(false)
  const [smsOpen, setSmsOpen]   = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

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

  // Show full notes — extract special request if formatted that way, otherwise show everything
  const notesText = (order.notes || '').trim()
  const specialMatch = notesText.match(/Special request:\s*(.+)/i)
  const specialRequest = specialMatch ? specialMatch[1].trim() : null
  // Show raw notes if they don't follow the special request format
  const rawNotes = !specialMatch && notesText ? notesText : null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.drawer}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.name}>{order.customer}</div>
            <div className={styles.pickupBadge}>{fmtDate(order.pickupDate)} · {fmtTimeRange(order)}</div>
            <div className={styles.meta}>{order.id}{order.bentoOrderId ? ` · #${order.bentoOrderId}` : ''}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {order.image && <img src={order.image} alt="Order" className={styles.orderImg} />}

          {/* Items — Option C layout */}
          <div className={styles.itemsList}>
            {order.items.map((item, i) => {
              const price = (parseFloat(item.price)||0) * (parseInt(item.qty)||0)
              // Cupcake names already embed flavors (e.g. "Cupcakes (1 Dozen) — Red Velvet / …")
              // Only show flavor1/flavor2 separately for items that don't embed them in the name
              const nameHasFlavors = item.name && item.name.includes('—')
              const flavors = nameHasFlavors ? '' : [item.flavor1, item.flavor2].filter(Boolean).join(' · ')
              const addonRaw = item.addonSummary
              const addon = Array.isArray(addonRaw) ? addonRaw.join(' · ') : (addonRaw || '')
              const flavorLine = [flavors, addon].filter(Boolean).join(' · ')
              return (
                <div key={i} className={styles.itemRow}>
                  <div className={styles.itemQty}>{item.qty}</div>
                  <div className={styles.itemDetail}>
                    <div className={styles.itemName}>{item.name}</div>
                    {flavorLine && <div className={styles.itemFlavor}>{flavorLine}</div>}
                    {item.writingText && <div className={styles.itemInscription}>"{item.writingText}"</div>}
                  </div>
                  {price > 0 && <div className={styles.itemPrice}>{fmt$(price)}</div>}
                </div>
              )
            })}
          </div>

          {/* Total */}
          {total > 0 && (
            <div className={styles.totalRow}>
              <span>Order total</span>
              <span>{fmt$(total)}</span>
            </div>
          )}

          {/* Notes */}
          {rawNotes && (
            <div className={styles.specialRequest}>
              <div className={styles.specialLabel}>Notes</div>
              {rawNotes}
            </div>
          )}
          {specialRequest && (
            <div className={styles.specialRequest}>
              <div className={styles.specialLabel}>Special request</div>
              {specialRequest}
            </div>
          )}

          {/* Created */}
          <div className={styles.createdRow}>
            <span className={styles.createdLabel}>Order created</span>
            <span className={styles.createdVal}>{createdLabel}</span>
          </div>

          {/* Notification log */}
          <button className={styles.notifToggle} onClick={() => setNotifOpen(o => !o)}>
            <span className={styles.sectionLabel}>Notification log</span>
            <span className={styles.notifChevron}>{notifOpen ? '▲' : '▼'}</span>
          </button>
          {notifOpen && (
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
          )}

          {/* SMS */}
          <button className={styles.notifToggle} onClick={() => setSmsOpen(o => !o)}>
            <span className={styles.sectionLabel}>Contact customer (SMS)</span>
            <span className={styles.notifChevron}>{smsOpen ? '▲' : '▼'}</span>
          </button>
          {smsOpen && (
            <div className={styles.contactSection}>
              <div className={styles.contactTo}>
                {order.phone ? <>To: <strong>{order.phone}</strong></> : <em>No phone number on file</em>}
              </div>
              <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Type your SMS message…" style={{height:80,marginTop:6}} />
              <button className={styles.sendBtn} onClick={sendSms}>Send SMS</button>
              {sent && <div className={styles.sentConfirm}>✓ SMS logged successfully</div>}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
