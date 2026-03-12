import { fmt$ } from '../utils/helpers'
import styles from './ItemsEditor.module.css'

export default function ItemsEditor({ items, onChange, error }) {
  const update = (idx, field, val) => {
    const next = items.map((item, i) =>
      i === idx ? { ...item, [field]: val } : item
    )
    onChange(next)
  }

  const add    = () => onChange([...items, { name: '', price: '', qty: 1 }])
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx))

  const total = items.reduce(
    (s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.qty) || 0), 0
  )

  return (
    <div>
      <div className={styles.colHeaders}>
        <span>Item</span>
        <span>Price/ea</span>
        <span>Qty</span>
        <span>Total</span>
        <span />
      </div>
      <div className={styles.list}>
        {items.map((item, i) => {
          const lineTotal = (parseFloat(item.price) || 0) * (parseInt(item.qty) || 0)
          return (
            <div key={i} className={styles.row}>
              <input
                type="text"
                value={item.name}
                placeholder="Item name"
                onChange={(e) => update(i, 'name', e.target.value)}
              />
              <input
                type="number"
                value={item.price}
                placeholder="0.00"
                min="0"
                step="0.01"
                onChange={(e) => update(i, 'price', e.target.value)}
                className={styles.numInput}
              />
              <input
                type="number"
                value={item.qty}
                min="1"
                onChange={(e) => update(i, 'qty', e.target.value)}
                className={styles.numInput}
              />
              <div className={styles.lineTotal}>{fmt$(lineTotal)}</div>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => remove(i)}
              >×</button>
            </div>
          )
        })}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {total > 0 && (
        <div className={styles.orderTotal}>Order total: {fmt$(total)}</div>
      )}
      <button type="button" className={styles.addBtn} onClick={add}>
        + Add item
      </button>
    </div>
  )
}
