import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { PURCHASE_UNITS } from '../utils/costCalculator'
import styles from './Invoices.module.css'

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

// Confidence badge
function ConfBadge({ level }) {
  const map = {
    high:   { label: 'High match',   cls: styles.confHigh   },
    medium: { label: 'Likely match', cls: styles.confMed    },
    low:    { label: 'Low match',    cls: styles.confLow    },
    none:   { label: 'No match',     cls: styles.confNone   },
  }
  const { label, cls } = map[level] || map.none
  return <span className={`${styles.confBadge} ${cls}`}>{label}</span>
}

// ── Review Item Row ──────────────────────────────────────────
function ReviewRow({ item, index, ingredients, onChange }) {
  const [expanded, setExpanded] = useState(item.enabled && item.confidence !== 'none')
  const isFood = item.confidence !== 'none'

  const perUnit = (() => {
    const p = parseFloat(item.total_price)
    const q = parseFloat(item.total_qty)
    if (p > 0 && q > 0) return (p / q).toFixed(4)
    return null
  })()

  return (
    <div className={`${styles.reviewRow} ${!item.enabled ? styles.reviewRowSkipped : ''}`}>
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
          <div className={styles.reviewFieldGroup}>
            <label className={styles.reviewLabel}>Maps to ingredient</label>
            <select
              className={styles.reviewSelect}
              value={item.override_ingredient_id || item.matched_id || ''}
              onChange={e => {
                const ing = ingredients.find(i => i.id === e.target.value)
                onChange(index, {
                  override_ingredient_id: e.target.value || null,
                  override_ingredient_name: ing?.name || null,
                  override_ingredient_unit: ing?.purchase_unit || null,
                })
              }}
            >
              <option value="">— Skip this item —</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>{ing.name}</option>
              ))}
            </select>
          </div>

          {(item.override_ingredient_id || item.matched_id) && (
            <>
              <div className={styles.reviewFieldRow}>
                <div className={styles.reviewFieldGroup}>
                  <label className={styles.reviewLabel}>Total paid (from invoice)</label>
                  <div className={styles.reviewPriceWrap}>
                    <span className={styles.reviewDollar}>$</span>
                    <input
                      type="number" min="0" step="0.01"
                      className={styles.reviewInput}
                      value={item.total_price || ''}
                      onChange={e => onChange(index, { total_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className={styles.reviewFieldGroup}>
                  <label className={styles.reviewLabel}>
                    Total {item.override_ingredient_unit || item.matched_unit || 'units'} received
                  </label>
                  <input
                    type="number" min="0" step="any"
                    className={styles.reviewInput}
                    placeholder="e.g. 50"
                    value={item.total_qty || ''}
                    onChange={e => onChange(index, { total_qty: e.target.value })}
                  />
                </div>
              </div>
              {perUnit && (
                <div className={styles.reviewPerUnit}>
                  = <strong>${perUnit}</strong> per {item.override_ingredient_unit || item.matched_unit || 'unit'}
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

// ── Invoice List Card ────────────────────────────────────────
function InvoiceCard({ inv, onClick }) {
  const date = inv.order_date
    ? new Date(inv.order_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const matchCount = (inv.matches || []).filter(m => m.ingredient_id).length

  return (
    <div className={styles.invoiceCard} onClick={onClick}>
      <div className={styles.invoiceCardLeft}>
        <div className={styles.invoiceDate}>{date}</div>
        <div className={styles.invoiceSupplier}>{inv.supplier || 'Unknown Supplier'}</div>
        {inv.invoice_number && (
          <div className={styles.invoiceNum}>#{inv.invoice_number}</div>
        )}
      </div>
      <div className={styles.invoiceCardRight}>
        {inv.total_amount && (
          <div className={styles.invoiceTotal}>${parseFloat(inv.total_amount).toFixed(2)}</div>
        )}
        <div className={styles.invoiceMeta}>{inv.item_count || 0} items</div>
        {matchCount > 0 && (
          <div className={styles.invoicePricesUpdated}>{matchCount} prices updated</div>
        )}
      </div>
    </div>
  )
}

// ── Invoice Detail Modal ─────────────────────────────────────
function InvoiceDetail({ inv, onClose }) {
  const date = inv.order_date
    ? new Date(inv.order_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(inv.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.detailModal}>
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.detailTitle}>{inv.supplier || 'Invoice'}</div>
            <div className={styles.detailSub}>{date}{inv.invoice_number ? ` · #${inv.invoice_number}` : ''}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.detailBody}>
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>Price Updates ({(inv.matches || []).filter(m => m.ingredient_id).length})</div>
            {(inv.matches || []).filter(m => m.ingredient_id).length === 0 ? (
              <p className={styles.detailEmpty}>No price updates were applied from this invoice.</p>
            ) : (
              <table className={styles.detailTable}>
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Invoice Item</th>
                    <th>New Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.matches || []).filter(m => m.ingredient_id).map((m, i) => (
                    <tr key={i}>
                      <td className={styles.detailIngName}>{m.ingredient_name}</td>
                      <td className={styles.detailInvName}>{m.invoice_item_name}</td>
                      <td className={styles.detailPrice}>${parseFloat(m.new_price).toFixed(4)}/{m.purchase_unit}</td>
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
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
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
  const [view,           setView]           = useState('list') // list | upload | processing | review | success | detail
  const [invoices,       setInvoices]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [ingredients,    setIngredients]    = useState([])
  const [dragOver,       setDragOver]       = useState(false)
  const [fileName,       setFileName]       = useState('')
  const [parseResult,    setParseResult]    = useState(null)
  const [reviewItems,    setReviewItems]    = useState([])
  const [applying,       setApplying]       = useState(false)
  const [successInfo,    setSuccessInfo]    = useState(null)
  const [selectedInv,    setSelectedInv]    = useState(null)
  const [error,          setError]          = useState('')
  const fileRef = useRef()

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

  // Convert file to base64
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }
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

      // Build reviewItems — default enable food items, skip non-food
      const items = (data.line_items || []).map(item => ({
        ...item,
        enabled:                    item.confidence !== 'none',
        total_qty:                  '',
        override_ingredient_id:     null,
        override_ingredient_name:   null,
        override_ingredient_unit:   null,
      }))
      setReviewItems(items)
      setView('review')
    } catch (err) {
      setError(err.message)
      setView('upload')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const updateReviewItem = (index, updates) => {
    setReviewItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item))
  }

  const handleApply = async () => {
    setApplying(true)
    setError('')

    // Build confirmed matches — only enabled items with a matched ingredient and a qty
    const confirmed = reviewItems
      .filter(item => {
        const ingId = item.override_ingredient_id || item.matched_id
        return item.enabled && ingId && item.total_qty && parseFloat(item.total_qty) > 0
      })
      .map(item => {
        const ingId   = item.override_ingredient_id || item.matched_id
        const ingName = item.override_ingredient_name || item.matched_ingredient
        const ingUnit = item.override_ingredient_unit || item.matched_unit
        const price   = parseFloat(item.total_price) / parseFloat(item.total_qty)
        return {
          ingredient_id:   ingId,
          ingredient_name: ingName,
          new_price:       parseFloat(price.toFixed(6)),
          purchase_unit:   ingUnit,
          invoice_item_name: item.invoice_name,
        }
      })

    try {
      const res = await fetch('/api/apply-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: parseResult.invoice_number,
          supplier:       parseResult.supplier,
          order_date:     parseResult.order_date,
          delivery_date:  parseResult.delivery_date,
          total_amount:   parseResult.total_amount,
          line_items:     parseResult.line_items,
          confirmed_matches: confirmed,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Apply failed')

      setSuccessInfo({ count: data.updated_count, supplier: parseResult.supplier })
      setView('success')
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  const resetUpload = () => {
    setView('upload')
    setFileName('')
    setParseResult(null)
    setReviewItems([])
    setError('')
  }

  const enabledWithQty = reviewItems.filter(item => {
    const ingId = item.override_ingredient_id || item.matched_id
    return item.enabled && ingId && item.total_qty && parseFloat(item.total_qty) > 0
  }).length

  const enabledCount = reviewItems.filter(item => {
    const ingId = item.override_ingredient_id || item.matched_id
    return item.enabled && ingId
  }).length

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
              <h1 className={styles.pageTitle}>Invoices</h1>
              <p className={styles.pageSubtitle}>Upload supplier invoices to track ingredient price history</p>
            </div>
            <button className={styles.uploadBtn} onClick={() => setView('upload')}>
              <UploadIcon /> Upload Invoice
            </button>
          </>
        )}
        {view === 'upload' && (
          <div>
            <h1 className={styles.pageTitle}>Upload Invoice</h1>
            <p className={styles.pageSubtitle}>PDF invoices from any supplier</p>
          </div>
        )}
        {view === 'review' && (
          <div>
            <h1 className={styles.pageTitle}>Review Matches</h1>
            <p className={styles.pageSubtitle}>
              {parseResult?.supplier || 'Invoice'} · {parseResult?.order_date || ''} · {reviewItems.length} items found
            </p>
          </div>
        )}
      </div>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className={styles.listWrap}>
          {loading ? (
            <div className={styles.loadingMsg}>Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><FileIcon /></div>
              <div className={styles.emptyTitle}>No invoices yet</div>
              <div className={styles.emptyMsg}>Upload your first supplier invoice to start tracking ingredient price history.</div>
              <button className={styles.uploadBtn} style={{ marginTop: 16 }} onClick={() => setView('upload')}>
                <UploadIcon /> Upload Invoice
              </button>
            </div>
          ) : (
            invoices.map(inv => (
              <InvoiceCard key={inv.id} inv={inv} onClick={() => { setSelectedInv(inv); setView('detail') }} />
            ))
          )}
        </div>
      )}

      {/* ── UPLOAD VIEW ── */}
      {view === 'upload' && (
        <div className={styles.uploadWrap}>
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
            <div className={styles.dropIcon}><UploadIcon /></div>
            <div className={styles.dropTitle}>Drop your invoice PDF here</div>
            <div className={styles.dropSub}>or click to browse files</div>
            <div className={styles.dropNote}>Works with RD Delivery, Sysco, and other supplier invoices</div>
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>
      )}

      {/* ── PROCESSING VIEW ── */}
      {view === 'processing' && (
        <div className={styles.processingWrap}>
          <div className={styles.processingSpinner} />
          <div className={styles.processingTitle}>Analyzing invoice…</div>
          <div className={styles.processingFile}>{fileName}</div>
          <div className={styles.processingSub}>AI is extracting line items and matching to your ingredients</div>
        </div>
      )}

      {/* ── REVIEW VIEW ── */}
      {view === 'review' && (
        <div className={styles.reviewWrap}>
          {error && <div className={styles.errorMsg} style={{ margin: '0 0 16px' }}>{error}</div>}

          <div className={styles.reviewSummary}>
            <span>{reviewItems.filter(i => i.enabled).length} of {reviewItems.length} items selected</span>
            <span>·</span>
            <span>{enabledWithQty} ready to apply</span>
            {enabledCount > enabledWithQty && (
              <>
                <span>·</span>
                <span className={styles.reviewNeedsQty}>{enabledCount - enabledWithQty} need quantity filled in</span>
              </>
            )}
          </div>

          <div className={styles.reviewHelp}>
            For each matched ingredient, enter the total quantity you received in the ingredient's storage unit (oz, lb, cup, etc.) so we can calculate the correct price per unit.
          </div>

          <div className={styles.reviewList}>
            {reviewItems.map((item, i) => (
              <ReviewRow
                key={i}
                item={item}
                index={i}
                ingredients={ingredients}
                onChange={updateReviewItem}
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

      {/* ── SUCCESS VIEW ── */}
      {view === 'success' && successInfo && (
        <div className={styles.successWrap}>
          <div className={styles.successIcon}><CheckCircleIcon /></div>
          <div className={styles.successTitle}>{successInfo.count} ingredient price{successInfo.count !== 1 ? 's' : ''} updated</div>
          {successInfo.supplier && (
            <div className={styles.successSub}>From {successInfo.supplier} invoice</div>
          )}
          <div className={styles.successNote}>
            Price history has been recorded. You can view past prices from the Ingredients tab.
          </div>
          <div className={styles.successActions}>
            <button className={styles.cancelBtn} onClick={() => { setView('list'); setSuccessInfo(null) }}>View Invoices</button>
            <button className={styles.applyBtn} onClick={() => { setView('upload'); setSuccessInfo(null); setFileName(''); setParseResult(null); setReviewItems([]) }}>Upload Another</button>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {view === 'detail' && selectedInv && (
        <InvoiceDetail inv={selectedInv} onClose={() => { setSelectedInv(null); setView('list') }} />
      )}
    </div>
  )
}
