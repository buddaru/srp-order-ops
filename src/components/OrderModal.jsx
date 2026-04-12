import { useState, useEffect } from 'react'
import { toDS, toTS, today, mkInitials } from '../utils/helpers'
import MenuBuilder from './MenuBuilder'
import ImageUpload from './ImageUpload'
import styles from './OrderModal.module.css'

const DEFAULT_TIME = toTS(13, 0)

export default function OrderModal({ mode, order, onSave, onClose, onDelete, isAdmin }) {
  const isEdit = mode === 'edit'

  const [customer, setCustomer] = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [pickupDate, setDate]   = useState(toDS(today))
  const [pickupTime, setTime]   = useState(DEFAULT_TIME)
  const [items, setItems]       = useState([])
  const [notes, setNotes]       = useState('')
  const [image, setImage]       = useState(null)
  const [errors, setErrors]     = useState({})

  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }

  useEffect(() => {
    if (isEdit && order) {
      setCustomer(order.customer || '')
      setPhone(order.phone || '')
      setEmail(order.email || '')
      setDate(order.pickupDate || toDS(today))
      setTime(order.pickupTime || DEFAULT_TIME)
      setItems((order.items || []).map(i => ({ ...i })))
      setNotes(order.notes || '')
      setImage(order.image || null)
    }
  }, [isEdit, order])

  const validate = () => {
    const e = {}
    if (!customer.trim()) e.customer = 'Name is required'
    if (!phone.trim())    e.phone    = 'Phone number is required'
    if (items.length === 0) e.items = 'At least one item is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSave({
      customer: customer.trim(),
      initials: mkInitials(customer.trim()),
      phone, email, pickupDate, pickupTime,
      items: items.map(i => ({
        name: i.name,
        price: i.price,
        qty: i.qty || 1,
        addonSummary: i.addonSummary,
        flavor1: i.flavor1,
        flavor2: i.flavor2,
        writingText: i.writingText,
      })),
      notes, image,
    })
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>{isEdit ? `Edit ${order.id}` : 'New Order'}</div>
            {isEdit && <div className={styles.subtitle}>{order.customer}</div>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          {/* Customer info */}
          <div className={styles.sectionTitle}>Customer</div>
          <div className={styles.fieldRow}>
            <div>
              <label className={styles.label}>Name <span className={styles.req}>*</span></label>
              <input type="text" value={customer} onChange={e=>{setCustomer(e.target.value);setErrors(p=>({...p,customer:''}))}} placeholder="Full name" className={errors.customer?'invalid':''} />
              {errors.customer && <div className={styles.errMsg}>{errors.customer}</div>}
            </div>
            <div>
              <label className={styles.label}>Phone <span className={styles.req}>*</span></label>
              <input type="tel" value={phone} onChange={e=>{setPhone(formatPhone(e.target.value));setErrors(p=>({...p,phone:''}))}} placeholder="(310) 000-0000" className={errors.phone?'invalid':''} />
              {errors.phone && <div className={styles.errMsg}>{errors.phone}</div>}
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div>
              <label className={styles.label}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="customer@email.com" />
            </div>
            <div />
          </div>

          <div className={styles.fieldRow}>
            <div>
              <label className={styles.label}>Pickup date <span className={styles.req}>*</span></label>
              <input type="date" value={pickupDate} onChange={e=>setDate(e.target.value)} />
            </div>
            <div>
              <label className={styles.label}>Pickup time</label>
              <input type="time" value={pickupTime} onChange={e=>setTime(e.target.value)} />
            </div>
          </div>

          {/* Menu builder */}
          <div className={styles.sectionTitle} style={{marginTop: 4}}>Items <span className={styles.req}>*</span></div>
          {errors.items && <div className={styles.errMsg} style={{marginBottom: 8}}>{errors.items}</div>}
          <MenuBuilder
            cartItems={items}
            onChange={next => { setItems(next); setErrors(p => ({...p, items: ''})) }}
          />

          {/* Notes + image */}
          <div className={styles.fieldGroup} style={{marginTop: 16}}>
            <label className={styles.label}>Notes</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions, delivery details, etc." />
          </div>
          <div className={styles.fieldGroup} style={{marginBottom: 0}}>
            <label className={styles.label}>Order image (optional)</label>
            <ImageUpload value={image} onChange={setImage} />
          </div>
        </div>

        <div className={styles.footer}>
          {isEdit && isAdmin && (
            <button className={styles.deleteBtn} onClick={() => { onDelete(order.id); onClose() }}>Delete order</button>
          )}
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSubmit}>{isEdit ? 'Save changes' : 'Create order'}</button>
        </div>
      </div>
    </div>
  )
}
