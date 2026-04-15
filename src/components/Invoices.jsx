import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { PURCHASE_UNITS } from '../utils/costCalculator'
import styles from './Invoices.module.css'

const DRAFT_KEY = 'cadro_receipt_draft'

// ── Icons ───────────────────────────────────────────────────
const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)
const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const CheckCircleIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)
const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)

// ── Helpers ──────────────────────────────────────────────────
// Try to extract package size and unit from product name or qty_unit
// e.g. "50 lb Bag" → { size: 50, unit: 'lb' }
// e.g. "C&H Powdered Sugar 50lb" → { size: 50, unit: 'lb' }
function parsePackageInfo(item) {
  const UNIT_ALIASES = {
    lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
    oz: 'oz', ounce: 'oz', ounces: 'oz',
    g: 'g', gram: 'g', grams: 'g',
    kg: 'kg', kilogram: 'kg',
    gal: 'l', gallon: 'l', gallons: 'l',
    qt: 'l', quart: 'l',
    l: 'l', liter: 'l', litre: 'l',
    cup: 'cup', cups: 'cup',
    fl_oz: 'fl oz', 'fl oz': 'fl oz',
  }

  const sources = [item.invoice_name || '', item.qty_unit || '']
  for (const src of sources) {
    // Detect #10 can (standard commercial can)
    if (/(?:#|no\.?\s*)10\s*can/i.test(src)) {
      return { size: '', unit: '#10can' }
    }
    const m = src.match(/(\d+\.?\d*)\s*(lb|lbs|oz|g|kg|gallon|gal|qt|quart|liter|litre|l|cup|cups|fl\s*oz|pound|ounce)/i)
    if (m) {
      const size = parseFloat(m[1])
      const unit = UNIT_ALIASES[m[2].toLowerCase().replace(/\s+/g, '_')] || m[2].toLowerCase()
      if (size > 0) return { size: String(size), unit }
    }
  }
  return { size: '', unit: null }
}

// Standard can sizes
const CAN_INFO = {
  '#10can': { oz: 104, cups: 13, label: '#10 can' },
}

// Confidence badge
function ConfBadge({ level }) {
  const map = {
    high:   { label: 'High match',   cls: styles.confHigh },
    medium: { label: 'Likely match', cls: styles.confMed  },
    low:    { label: 'Low match',    cls: styles.confLow  },
    none:   { label: 'No match',     cls: styles.confNone },
  }
  const { label, cls } = map[level] || map.none
  return <span className={`${styles.confBadge} ${cls}`}>{label}</span>
}

// ── Review Item Row ──────────────────────────────────────────
function ReviewRow({ item, index, ingredients, onChange, rowRef }) {
  const resolvedIngId = item.override_ingredient_id || item.matched_id
  const resolvedIng   = ingredients.find(i => i.id === resolvedIngId)

  const effectiveUnit = item.unit_override
    || resolvedIng?.purchase_unit
    || item.parsed_unit
    || 'lb'

  const qtyOrdered    = parseFloat(item.qty_ordered)
  const unitsPerPkg   = parseFloat(item.units_per_pkg)
  const totalPaid     = parseFloat(item.total_price)
  const totalIngUnits = (qtyOrdered > 0 && unitsPerPkg > 0) ? qtyOrdered * unitsPerPkg : 0
  const pricePerUnit  = (totalIngUnits > 0 && totalPaid > 0) ? totalPaid / totalIngUnits : null

  // Supply item (non-ingredient) price
  const supplyQty          = parseFloat(item.supply_qty)
  const supplyPricePerUnit = (supplyQty > 0 && totalPaid > 0) ? totalPaid / supplyQty : null

  // For #10 can: show $/oz and $/cup conversions
  const canInfo     = CAN_INFO[effectiveUnit] || null
  const pricePerOz  = (canInfo && pricePerUnit) ? pricePerUnit / canInfo.oz  : null
  const pricePerCup = (canInfo && pricePerUnit) ? pricePerUnit / canInfo.cups : null

  const priceDelta = (() => {
    if (!pricePerUnit || !resolvedIng?.purchase_price) return null
    const prev = parseFloat(resolvedIng.purchase_price)
    if (!prev || prev <= 0) return null
    const pct = ((pricePerUnit - prev) / prev) * 100
    if (Math.abs(pct) < 3) return null
    return pct
  })()

  const rowConfClass = item.confidence === 'medium' ? styles.reviewRowMedium
    : item.confidence === 'low' ? styles.reviewRowLow : ''

  const pkgSizeParsed = item.pkg_size_parsed && item.units_per_pkg
  const isSupply      = !resolvedIngId && item.track_supply

  return (
    <div
      ref={rowRef}
      id={`review-row-${index}`}
      className={`${styles.reviewRow} ${!item.enabled ? styles.reviewRowSkipped : rowConfClass}`}
    >
      {/* Header */}
      <div className={styles.reviewRowHeader}>
        <label className={styles.reviewCheckLabel}>
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={e => onChange(index, { enabled: e.target.checked })}
            className={styles.reviewCheck}
          />
          <div className={styles.reviewInvoiceName}>{item.invoice_name}</div>
        </label>
        <div className={styles.reviewHeaderRight}>
          <span className={styles.reviewTotal}>${item.total_price?.toFixed(2)}</span>
          <ConfBadge level={item.confidence} />
        </div>
      </div>

      {item.enabled && (
        <div className={styles.reviewFields}>

          {/* Maps to ingredient */}
          <div className={styles.reviewFieldGroup}>
            <label className={styles.reviewLabel}>Maps to ingredient</label>
            <select
              className={styles.reviewSelect}
              value={item.override_ingredient_id || item.matched_id || ''}
              onChange={e => {
                const ing = ingredients.find(i => i.id === e.target.value)
                onChange(index, {
                  override_ingredient_id:   e.target.value || null,
                  override_ingredient_name: ing?.name || null,
                  override_ingredient_unit: ing?.purchase_unit || null,
                  unit_override:            ing?.purchase_unit || null,
                  track_supply:             false,
                })
              }}
            >
              <option value="">— No ingredient match —</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>{ing.name}</option>
              ))}
            </select>
          </div>

          {/* ── INGREDIENT MODE ── */}
          {resolvedIngId && (
            <>
              {/* 2-column: Qty + Size */}
              <div className={styles.reviewFieldRow2}>
                <div className={styles.reviewFieldGroup}>
                  <label className={styles.reviewLabel}>
                    Packages ordered
                    {item.qty_parsed && item.qty_ordered
                      ? <span className={styles.parsedTag}>from invoice</span>
                      : null}
                  </label>
                  <input
                    type="number" min="0" step="1"
                    className={`${styles.reviewInput} ${!item.qty_ordered ? styles.inputEmpty : ''}`}
                    placeholder="e.g. 2"
                    value={item.qty_ordered || ''}
                    onChange={e => onChange(index, { qty_ordered: e.target.value, qty_parsed: false })}
                  />
                </div>

                <div className={styles.reviewFieldGroup}>
                  <label className={styles.reviewLabel}>
                    {effectiveUnit === '#10can' ? 'Cans per package' : 'Size per package'}
                    {pkgSizeParsed ? <span className={styles.parsedTag}>from invoice</span> : null}
                  </label>
                  <div className={styles.sizeUnitRow}>
                    <input
                      type="number" min="0" step="any"
                      className={`${styles.reviewInput} ${styles.sizeInput} ${!item.units_per_pkg ? styles.inputEmpty : ''}`}
                      placeholder={effectiveUnit === '#10can' ? 'e.g. 6' : '50'}
                      value={item.units_per_pkg || ''}
                      onChange={e => onChange(index, { units_per_pkg: e.target.value, pkg_size_parsed: false })}
                    />
                    <select
                      className={styles.unitSelect}
                      value={effectiveUnit}
                      onChange={e => onChange(index, { unit_override: e.target.value })}
                    >
                      {PURCHASE_UNITS.map(u => (
                        <option key={u.value} value={u.value}>{u.value}</option>
                      ))}
                      <option value="#10can">#10 can</option>
                      <option value="can">can</option>
                      <option value="each">each</option>
                    </select>
                  </div>
                  {effectiveUnit === '#10can' && (
                    <div className={styles.canInfo}>1 #10 can ≈ 104 oz · 13 cups</div>
                  )}
                </div>
              </div>

              {/* Price result — the hero */}
              {pricePerUnit ? (
                <div className={styles.priceResult}>
                  <div className={styles.priceResultTop}>
                    <span className={styles.priceResultValue}>
                      ${pricePerUnit.toFixed(2)}
                      <span className={styles.priceResultUnit}> / {effectiveUnit}</span>
                    </span>
                    {priceDelta !== null && (
                      <span className={priceDelta > 0 ? styles.deltaUp : styles.deltaDown}>
                        {priceDelta > 0 ? '↑' : '↓'} {Math.abs(priceDelta).toFixed(0)}% vs last receipt
                      </span>
                    )}
                  </div>
                  <div className={styles.priceResultSub}>
                    {effectiveUnit === '#10can'
                      ? `${qtyOrdered} pkg × ${unitsPerPkg} cans = ${totalIngUnits} #10 cans total`
                      : `${qtyOrdered} pkg × ${unitsPerPkg} ${effectiveUnit} = ${totalIngUnits} ${effectiveUnit} total`
                    }
                    {' · '}Total paid: ${totalPaid.toFixed(2)}
                  </div>
                  {pricePerOz && (
                    <div className={styles.priceResultConvert}>
                      = ${pricePerOz.toFixed(3)} / oz · ${pricePerCup.toFixed(2)} / cup
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.missingHint}>
                  Fill in packages ordered and size per package to see your cost per {effectiveUnit}
                </div>
              )}
            </>
          )}

          {/* ── NO MATCH: offer supply tracking ── */}
          {!resolvedIngId && (
            <>
              <label className={styles.supplyToggle}>
                <input
                  type="checkbox"
                  checked={!!item.track_supply}
                  onChange={e => onChange(index, {
                    track_supply: e.target.checked,
                    supply_name:  item.supply_name || item.invoice_name,
                    supply_unit:  item.supply_unit || 'each',
                    supply_qty:   item.supply_qty  || (item.qty ? String(item.qty) : ''),
                  })}
                  className={styles.reviewCheck}
                />
                <span>Track price for this item over time</span>
              </label>

              {isSupply && (
                <div className={styles.supplyFields}>
                  <div className={styles.reviewFieldGroup}>
                    <label className={styles.reviewLabel}>Item name</label>
                    <input
                      type="text"
                      className={styles.reviewInput}
                      value={item.supply_name || ''}
                      onChange={e => onChange(index, { supply_name: e.target.value })}
                    />
                  </div>
                  <div className={styles.reviewFieldRow2}>
                    <div className={styles.reviewFieldGroup}>
                      <label className={styles.reviewLabel}>Qty ordered</label>
                      <input
                        type="number" min="0" step="1"
                        className={`${styles.reviewInput} ${!item.supply_qty ? styles.inputEmpty : ''}`}
                        placeholder="e.g. 2"
                        value={item.supply_qty || ''}
                        onChange={e => onChange(index, { supply_qty: e.target.value })}
                      />
                    </div>
                    <div className={styles.reviewFieldGroup}>
                      <label className={styles.reviewLabel}>Unit</label>
                      <select
                        className={styles.reviewSelect}
                        value={item.supply_unit || 'each'}
                        onChange={e => onChange(index, { supply_unit: e.target.value })}
                      >
                        {['each','case','box','bag','roll','pack','pair','set','gallon','lb'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {supplyPricePerUnit ? (
                    <div className={styles.priceResult}>
                      <div className={styles.priceResultTop}>
                        <span className={styles.priceResultValue}>
                          ${supplyPricePerUnit.toFixed(2)}
                          <span className={styles.priceResultUnit}> / {item.supply_unit || 'each'}</span>
                        </span>
                      </div>
                      <div className={styles.priceResultSub}>
                        Total paid: ${totalPaid.toFixed(2)}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.missingHint}>Fill in qty ordered to see price per {item.supply_unit || 'each'}</div>
                  )}
                </div>
              )}
            </>
          )}

          {item.match_note && (
            <div className={styles.reviewNote}>{item.match_note}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Receipt List Card ────────────────────────────────────────
function ReceiptCard({ inv, onClick }) {
  const date = inv.order_date
    ? new Date(inv.order_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const matchCount = (inv.matches || []).filter(m => m.ingredient_id).length

  return (
    <div className={styles.invoiceCard} onClick={onClick}>
      <div className={styles.invoiceCardLeft}>
        <div className={styles.invoiceDate}>{date}</div>
        <div className={styles.invoiceSupplier}>{inv.supplier || 'Unknown Supplier'}</div>
        {inv.invoice_number && <div className={styles.invoiceNum}>#{inv.invoice_number}</div>}
      </div>
      <div className={styles.invoiceCardRight}>
        {inv.total_amount && <div className={styles.invoiceTotal}>${parseFloat(inv.total_amount).toFixed(2)}</div>}
        <div className={styles.invoiceMeta}>{inv.item_count || 0} items</div>
        {matchCount > 0 && <div className={styles.invoicePricesUpdated}>{matchCount} prices updated</div>}
      </div>
    </div>
  )
}

// ── Receipt Detail Modal ─────────────────────────────────────
function ReceiptDetail({ inv, onClose }) {
  const date = inv.order_date
    ? new Date(inv.order_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(inv.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.detailModal}>
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.detailTitle}>{inv.supplier || 'Receipt'}</div>
            <div className={styles.detailSub}>{date}{inv.invoice_number ? ` · #${inv.invoice_number}` : ''}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.detailBody}>
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              Price Updates ({(inv.matches || []).filter(m => m.ingredient_id).length})
            </div>
            {(inv.matches || []).filter(m => m.ingredient_id).length === 0 ? (
              <p className={styles.detailEmpty}>No price updates were applied from this receipt.</p>
            ) : (
              <table className={styles.detailTable}>
                <thead><tr><th>Ingredient</th><th>Receipt Item</th><th>New Price</th></tr></thead>
                <tbody>
                  {(inv.matches || []).filter(m => m.ingredient_id).map((m, i) => (
                    <tr key={i}>
                      <td className={styles.detailIngName}>{m.ingredient_name}</td>
                      <td className={styles.detailInvName}>{m.invoice_item_name}</td>
                      <td className={styles.detailPrice}>${parseFloat(m.new_price).toFixed(2)}/{m.purchase_unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {(inv.line_items || []).length > 0 && (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>All Line Items ({inv.line_items.length})</div>
              <table className={styles.detailTable}>
                <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                <tbody>
                  {inv.line_items.map((li, i) => (
                    <tr key={i}>
                      <td>{li.invoice_name}</td>
                      <td>{li.qty} {li.qty_unit}</td>
                      <td>${li.unit_price?.toFixed(2)}</td>
                      <td>${li.total_price?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────
export default function Invoices() {
  const [view,        setView]        = useState('list')
  const [invoices,    setInvoices]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [ingredients, setIngredients] = useState([])
  const [dragOver,    setDragOver]    = useState(false)
  const [fileName,    setFileName]    = useState('')
  const [parseResult, setParseResult] = useState(null)
  const [reviewItems, setReviewItems] = useState([])
  const [applying,    setApplying]    = useState(false)
  const [successInfo, setSuccessInfo] = useState(null)
  const [selectedInv, setSelectedInv] = useState(null)
  const [error,       setError]       = useState('')
  const [draftSaved,  setDraftSaved]  = useState(false)
  const fileRef     = useRef()
  const rowRefs     = useRef([])
  const skipSaveRef = useRef(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: invData }, { data: ingData }] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('ingredients').select('id, name, purchase_unit, purchase_price').order('name'),
    ])
    setInvoices(invData || [])
    setIngredients(ingData || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Draft restore ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft.reviewItems?.length && draft.parseResult) {
          skipSaveRef.current = true
          setParseResult(draft.parseResult)
          setReviewItems(draft.reviewItems)
          setFileName(draft.fileName || '')
          setView('review')
        }
      }
    } catch (_) {}
  }, [])

  // ── Auto-save draft ──
  useEffect(() => {
    if (view !== 'review' || !parseResult || reviewItems.length === 0) return
    if (skipSaveRef.current) { skipSaveRef.current = false; return }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ reviewItems, parseResult, fileName }))
      setDraftSaved(true)
      const t = setTimeout(() => setDraftSaved(false), 2000)
      return () => clearTimeout(t)
    } catch (_) {}
  }, [reviewItems]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch (_) {} }

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') { setError('Please upload a PDF file.'); return }
    setError('')
    setFileName(file.name)
    setView('processing')
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/parse-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_base64: base64, ingredients }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parsing failed')
      setParseResult(data)

      const items = (data.line_items || []).map(item => {
        // Find matched ingredient for unit default
        const matchedIng = ingredients.find(ing =>
          ing.name?.toLowerCase() === item.matched_ingredient?.toLowerCase()
        )
        // Try to parse package size + unit from product name
        const { size: parsedSize, unit: parsedUnit } = parsePackageInfo(item)

        const hasMatch = item.confidence !== 'none'
        return {
          ...item,
          enabled:                  hasMatch,
          // Qty ordered = number of cases/packages from invoice
          qty_ordered:              item.qty && parseFloat(item.qty) > 0 ? String(item.qty) : '',
          qty_parsed:               !!(item.qty && parseFloat(item.qty) > 0),
          // Package size parsed from product name
          units_per_pkg:            parsedSize,
          pkg_size_parsed:          !!parsedSize,
          // Unit: ingredient's stored unit > parsed from name
          unit_override:            matchedIng?.purchase_unit || parsedUnit || null,
          parsed_unit:              parsedUnit,
          // Keep total_price from invoice
          override_ingredient_id:   null,
          override_ingredient_name: null,
          override_ingredient_unit: null,
          // Default: track non-matched items as supply items
          track_supply:             !hasMatch,
          supply_name:              !hasMatch ? (item.invoice_name || '') : '',
          supply_unit:              !hasMatch ? 'each' : '',
          supply_qty:               !hasMatch && item.qty ? String(item.qty) : '',
        }
      })
      skipSaveRef.current = false
      setReviewItems(items)
      setView('review')
    } catch (err) {
      setError(err.message)
      setView('upload')
    }
  }

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }

  const updateReviewItem = (index, updates) =>
    setReviewItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item))

  const scrollToFirstEmpty = () => {
    const idx = reviewItems.findIndex(item => {
      const ingId = item.override_ingredient_id || item.matched_id
      return item.enabled && ingId && (!item.qty_ordered || !item.units_per_pkg)
    })
    if (idx >= 0 && rowRefs.current[idx]) {
      rowRefs.current[idx].scrollIntoView({ behavior: 'smooth', block: 'center' })
      rowRefs.current[idx].classList.add(styles.reviewRowHighlight)
      setTimeout(() => rowRefs.current[idx]?.classList.remove(styles.reviewRowHighlight), 1500)
    }
  }

  const handleApply = async () => {
    setApplying(true)
    setError('')

    const confirmed = reviewItems
      .filter(item => {
        const ingId = item.override_ingredient_id || item.matched_id
        const qo = parseFloat(item.qty_ordered)
        const up = parseFloat(item.units_per_pkg)
        return item.enabled && ingId && qo > 0 && up > 0
      })
      .map(item => {
        const ingId   = item.override_ingredient_id || item.matched_id
        const ingName = item.override_ingredient_name || item.matched_ingredient
        const ingUnit = item.unit_override || item.override_ingredient_unit || item.matched_unit
        const totalIngUnits = parseFloat(item.qty_ordered) * parseFloat(item.units_per_pkg)
        const price   = parseFloat(item.total_price) / totalIngUnits
        return {
          ingredient_id:     ingId,
          ingredient_name:   ingName,
          new_price:         parseFloat(price.toFixed(6)),
          purchase_unit:     ingUnit,
          invoice_item_name: item.invoice_name,
        }
      })

    // Collect supply items (non-ingredient tracked items)
    const supplyItems = reviewItems
      .filter(item => item.enabled && item.track_supply && parseFloat(item.supply_qty) > 0 && item.supply_name)
      .map(item => ({
        item_name:      item.supply_name,
        total_paid:     parseFloat(item.total_price),
        qty:            parseFloat(item.supply_qty),
        unit:           item.supply_unit || 'each',
        price_per_unit: parseFloat(item.total_price) / parseFloat(item.supply_qty),
        invoice_name:   item.invoice_name,
      }))

    try {
      const res = await fetch('/api/apply-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number:    parseResult.invoice_number,
          supplier:          parseResult.supplier,
          order_date:        parseResult.order_date,
          delivery_date:     parseResult.delivery_date,
          total_amount:      parseResult.total_amount,
          line_items:        parseResult.line_items,
          confirmed_matches: confirmed,
          supply_items:      supplyItems,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Apply failed')
      clearDraft()
      setSuccessInfo({ count: data.updated_count + (data.supply_count || 0), supplier: parseResult.supplier })
      setView('success')
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  const resetUpload = () => {
    clearDraft()
    setView('upload')
    setFileName('')
    setParseResult(null)
    setReviewItems([])
    setError('')
  }

  // Ready = ingredient items fully filled, or supply items with qty+name
  const enabledWithQty = reviewItems.filter(item => {
    const ingId = item.override_ingredient_id || item.matched_id
    if (item.enabled && ingId)
      return parseFloat(item.qty_ordered) > 0 && parseFloat(item.units_per_pkg) > 0
    if (item.enabled && item.track_supply)
      return parseFloat(item.supply_qty) > 0 && !!item.supply_name
    return false
  }).length

  const enabledCount = reviewItems.filter(item => {
    const ingId = item.override_ingredient_id || item.matched_id
    return item.enabled && (ingId || item.track_supply)
  }).length

  const needsQtyCount = enabledCount - enabledWithQty

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        {(view === 'upload' || view === 'review') && (
          <button className={styles.backBtn} onClick={() => view === 'review' ? resetUpload() : setView('list')}>
            <BackIcon /> Back
          </button>
        )}
        {view === 'list' && (
          <>
            <div>
              <h1 className={styles.pageTitle}>Receipts</h1>
              <p className={styles.pageSubtitle}>Upload supplier receipts to track ingredient price history</p>
            </div>
            <button className={styles.uploadBtn} onClick={() => setView('upload')}>
              <UploadIcon /> Upload Receipt
            </button>
          </>
        )}
        {view === 'upload' && (
          <div>
            <h1 className={styles.pageTitle}>Upload Receipt</h1>
            <p className={styles.pageSubtitle}>PDF receipts from any supplier</p>
          </div>
        )}
        {view === 'review' && (
          <div>
            <h1 className={styles.pageTitle}>Review Matches</h1>
            <p className={styles.pageSubtitle}>
              {parseResult?.supplier || 'Receipt'} · {parseResult?.order_date || ''} · {reviewItems.length} items found
            </p>
          </div>
        )}
      </div>

      {/* LIST */}
      {view === 'list' && (
        <div className={styles.listWrap}>
          {loading ? (
            <div className={styles.loadingMsg}>Loading receipts…</div>
          ) : invoices.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><FileIcon /></div>
              <div className={styles.emptyTitle}>No receipts yet</div>
              <div className={styles.emptyMsg}>Upload your first supplier receipt to start tracking ingredient price history.</div>
              <button className={styles.uploadBtn} style={{ marginTop: 16 }} onClick={() => setView('upload')}>
                <UploadIcon /> Upload Receipt
              </button>
            </div>
          ) : (
            invoices.map(inv => (
              <ReceiptCard key={inv.id} inv={inv} onClick={() => { setSelectedInv(inv); setView('detail') }} />
            ))
          )}
        </div>
      )}

      {/* UPLOAD */}
      {view === 'upload' && (
        <div className={styles.uploadWrap}>
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])} />
            <div className={styles.dropIcon}><UploadIcon /></div>
            <div className={styles.dropTitle}>Drop your receipt PDF here</div>
            <div className={styles.dropSub}>or click to browse files</div>
            <div className={styles.dropNote}>Works with RD Delivery, Sysco, and other supplier receipts</div>
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>
      )}

      {/* PROCESSING */}
      {view === 'processing' && (
        <div className={styles.processingWrap}>
          <div className={styles.processingSpinner} />
          <div className={styles.processingTitle}>Analyzing receipt…</div>
          <div className={styles.processingFile}>{fileName}</div>
          <div className={styles.processingSub}>AI is extracting line items and matching to your ingredients</div>
        </div>
      )}

      {/* REVIEW */}
      {view === 'review' && (
        <div className={styles.reviewWrap}>
          {error && <div className={styles.errorMsg} style={{ margin: '0 0 16px' }}>{error}</div>}

          {draftSaved && (
            <div className={styles.draftBanner}>
              <svg width="8" height="8" viewBox="0 0 8 8" style={{ marginRight: 5 }}><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
              Draft auto-saved
            </div>
          )}

          <div className={styles.reviewSummary}>
            <span>{reviewItems.filter(i => i.enabled).length} of {reviewItems.length} items selected</span>
            <span>·</span>
            <span>{enabledWithQty} ready to apply</span>
            {needsQtyCount > 0 && (
              <>
                <span>·</span>
                <button className={styles.reviewNeedsQtyBtn} onClick={scrollToFirstEmpty}>
                  {needsQtyCount} need info — fill in ↓
                </button>
              </>
            )}
          </div>

          <div className={styles.reviewHelp}>
            Enter how many packages you ordered and the size of each package — Cadro will calculate your per-unit cost automatically.
          </div>

          <div className={styles.reviewList}>
            {reviewItems.map((item, i) => (
              <ReviewRow
                key={i}
                item={item}
                index={i}
                ingredients={ingredients}
                onChange={updateReviewItem}
                rowRef={el => rowRefs.current[i] = el}
              />
            ))}
          </div>

          <div className={styles.reviewActions}>
            <button className={styles.cancelBtn} onClick={resetUpload}>Cancel</button>
            <button
              className={styles.applyBtn}
              onClick={handleApply}
              disabled={applying || enabledWithQty === 0}
            >
              {applying ? 'Applying…' : `Apply ${enabledWithQty} Price Update${enabledWithQty !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS */}
      {view === 'success' && successInfo && (
        <div className={styles.successWrap}>
          <div className={styles.successIcon}><CheckCircleIcon /></div>
          <div className={styles.successTitle}>{successInfo.count} ingredient price{successInfo.count !== 1 ? 's' : ''} updated</div>
          {successInfo.supplier && <div className={styles.successSub}>From {successInfo.supplier} receipt</div>}
          <div className={styles.successNote}>Price history has been recorded. You can view past prices from the Ingredients tab.</div>
          <div className={styles.successActions}>
            <button className={styles.cancelBtn} onClick={() => { setView('list'); setSuccessInfo(null) }}>View Receipts</button>
            <button className={styles.applyBtn} onClick={() => {
              setView('upload'); setSuccessInfo(null); setFileName(''); setParseResult(null); setReviewItems([])
            }}>Upload Another</button>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {view === 'detail' && selectedInv && (
        <ReceiptDetail inv={selectedInv} onClose={() => { setSelectedInv(null); setView('list') }} />
      )}
    </div>
  )
}
