import { useState, useEffect } from 'react'
import { toDS, toTS, today, mkInitials } from '../utils/helpers'
import ItemsEditor from './ItemsEditor'
import ImageUpload from './ImageUpload'
import styles from './OrderModal.module.css'

const BLANK_ITEM = { name: '', price: '', qty: 1 }

export default function OrderModal({ mode, order, onSave, onClose }) {
  const isEdit = mode === 'edit'

  const [customer, setCustomer]   = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [pickupDate, setDate]     = useState(toDS(today))
  const [pickupTime, setTime]     = useState(toTS(12, 0))
  const [items, setItems]         = useState([{ ...BLANK_ITEM }])
  const [notes, setNotes]         = useState('')
  const [image, setImage]         = useState(null)
  const [errors, setErrors]       = useState({})

  // Populate form when editing
  useEffect(() => {
    if (isEdit && order) {
      setCustomer(order.customer)
      setPhone(order.phone || '')
      setEmail(order.email || '')
      setDate(order.pickupDate)
      setTime(order.pickupTime)
      setItems(order.items.map(i => ({ ...i })))
      setNotes(order.notes || '')
      setImage(order.image || null)
    }
  }, [isEdit, order])

  const validate = () => {
    const e = {}
    if (!customer.trim()) e.customer = 'Name is required'
    if (!phone.trim())    e.phone    = 'Phone number is required'
    if (!items.some(i => i.name.trim())) e.items = 'At least one item is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSave({
      customer: customer.trim(),
      initials: mkInitials(customer.trim()),
      phone,
      email,
      pickupDate,
      pickupTime,
      items: items.filter(i => i.name.trim()),
      notes,
      image,
    })
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              {isEdit ? `Edit ${order.id}` : 'New Order'}
            </div>
            {isEdit && <div className={styles.subtitle}>{order.customer}</div>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Name + Phone */}
          <div className={styles.fieldRow}>
            <div>
              <label className={styles.label}>Customer name <span className={styles.req}>*</span></label>
              <input
                type="text"
                value={customer}
                onChange={e => { setCustomer(e.target.value); setErrors(prev => ({ ...prev, customer: '' })) }}
                placeholder="Full name"
                className={errors.customer ? 'invalid' : ''}
              />
              {errors.customer && <div className={styles.errMsg}>{errors.customer}</div>}
            </div>
            <div>
              <label className={styles.label}>Phone <span className={styles.req}>*</span></label>
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: '' })) }}
                placeholder="(310) 000-0000"
                className={errors.phone ? 'invalid' : ''}
              />
              {errors.phone && <div className={styles.errMsg}>{errors.phone}</div>}
            </div>
          </div>

          {/* Email */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="customer@email.com"
            />
          </div>

          {/* Date + Time */}
          <div className={styles.fieldRow}>
            <div>
              <label className={styles.label}>Pickup date <span className={styles.req}>*</span></label>
              <input
                type="date"
                value={pickupDate}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.label}>Pickup time <span className={styles.req}>*</span></label>
              <input
                type="time"
                value={pickupTime}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Items */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Items <span className={styles.req}>*</span></label>
            <ItemsEditor
              items={items}
              onChange={(next) => { setItems(next); setErrors(prev => ({ ...prev, items: '' })) }}
              error={errors.items}
            />
          </div>

          {/* Notes */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special instructions, decorations, etc."
            />
          </div>

          {/* Image */}
          <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
            <label className={styles.label}>Order image (optional)</label>
            <ImageUpload value={image} onChange={setImage} />
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSubmit}>
            {isEdit ? 'Save changes' : 'Create order'}
          </button>
        </div>
      </div>
    </div>
  )
}
