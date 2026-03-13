import { useState, useEffect } from 'react'
import { toDS, toTS, today, mkInitials } from '../utils/helpers'
import ItemsEditor from './ItemsEditor'
import ImageUpload from './ImageUpload'
import styles from './OrderModal.module.css'

const DEFAULT_TIME = toTS(13, 0) // 1:00 PM

export default function OrderModal({ mode, order, onSave, onClose, onDelete }) {
  const isEdit = mode === 'edit'

  const [customer, setCustomer] = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [pickupDate, setDate]   = useState(toDS(today))
  const [pickupTime, setTime]   = useState(DEFAULT_TIME)
  const [items, setItems]       = useState([{ name: '', price: '', qty: 1 }])
  const [notes, setNotes]       = useState('')
  const [image, setImage]       = useState(null)
  const [errors, setErrors]     = useState({})

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

  const handleDelete = () => {
    if (window.confirm('Delete this order? This cannot be undone.')) {
      onDelete(order.id)
      onClose()
    }
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSave({ customer: customer.trim(), initials: mkInitials(customer.trim()), phone, email, pickupDate, pickupTime, items: items.filter(i => i.name.trim()), notes, image })
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
          <div className={styles.fieldRow}>
            <div>
              <label className={styles.label}>Customer name <span className={styles.req}>*</span></label>
              <input type="text" value={customer} onChange={e=>{setCustomer(e.target.value);setErrors(p=>({...p,customer:''}))}} placeholder="Full name" className={errors.customer?'invalid':''} />
              {errors.customer && <div className={styles.errMsg}>{errors.customer}</div>}
            </div>
            <div>
              <label className={styles.label}>Phone <span className={styles.req}>*</span></label>
              <input type="tel" value={phone} onChange={e=>{setPhone(e.target.value);setErrors(p=>({...p,phone:''}))}} placeholder="(310) 000-0000" className={errors.phone?'invalid':''} />
              {errors.phone && <div className={styles.errMsg}>{errors.phone}</div>}
            </div>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="customer@email.com" />
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
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Items <span className={styles.req}>*</span></label>
            <ItemsEditor items={items} onChange={next=>{setItems(next);setErrors(p=>({...p,items:''}))}} error={errors.items} />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Notes</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions, decorations, etc." />
          </div>
          <div className={styles.fieldGroup} style={{marginBottom:0}}>
            <label className={styles.label}>Order image (optional)</label>
            <ImageUpload value={image} onChange={setImage} />
          </div>
        </div>
        <div className={styles.footer}>
          {isEdit && <button className={styles.deleteBtn} onClick={handleDelete}>Delete order</button>}
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSubmit}>{isEdit ? 'Save changes' : 'Create order'}</button>
        </div>
      </div>
    </div>
  )
}
