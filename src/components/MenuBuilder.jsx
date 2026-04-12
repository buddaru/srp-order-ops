import { useState } from 'react'
import { fmt$ } from '../utils/helpers'
import {
  MENU, CATEGORIES, CUPCAKE_FLAVORS,
  CAKE_CATEGORIES, CUSTOM_ONLY_CATEGORIES,
  SIZES, CAKE_ADDONS, LAYER_PRICE
} from '../data/menuData'
import styles from './MenuBuilder.module.css'

const blankAddonState = () => ({
  frostingColor: false, frostingColorNote: '',
  cakeColor: false, cakeColorNote: '',
  coveredRosettes: false,
  buttercreamRoses: false,
  fancyPiping: false,
  fancySprinkles: false, fancySprinklesPrice: 10,
  fruitOnTop: false, fruitOnTopPrice: 10,
  fruitJamFilling: false, fruitJamFillingPrice: 10,
  additionalLayer: false,
  printedImage: false,
  customLabel: '', customPrice: '',
  writingText: '',
})

function calcItemPrice(item, size, addons) {
  if (!item) return 0
  const sizeObj = SIZES.find(s => s.id === size) || SIZES[0]
  let total = sizeObj.mod(item.price)
  if (CAKE_CATEGORIES.includes(item.category)) {
    CAKE_ADDONS.forEach(a => {
      if (!addons[a.id]) return
      if (a.type === 'toggle') total += a.price
      if (a.type === 'toggle+note') total += a.price
      if (a.type === 'toggle+price') total += addons[`${a.id}Price`] || a.priceOptions[0]
      if (a.type === 'toggle+layer') total += LAYER_PRICE[size] || 25
    })
  }
  if (addons.customLabel && addons.customPrice) total += parseFloat(addons.customPrice) || 0
  return total
}

function buildItemName(item, size, flavor1, flavor2) {
  if (!item) return ''
  if (item.category === 'Cupcakes') {
    const f2 = flavor2 && flavor2 !== 'None' ? ` / ${flavor2}` : ''
    return `Cupcakes (1 Dozen) — ${flavor1}${f2}`
  }
  const sizeObj = SIZES.find(s => s.id === size) || SIZES[0]
  const sizeStr = sizeObj.id !== 'round' ? ` (${sizeObj.label})` : ''
  return `${item.name}${sizeStr}`
}

function buildAddonSummary(item, addons) {
  if (!item) return []
  const list = []
  if (CAKE_CATEGORIES.includes(item.category)) {
    CAKE_ADDONS.forEach(a => {
      if (!addons[a.id]) return
      if (a.type === 'toggle') list.push(a.label)
      if (a.type === 'toggle+note') {
        const note = addons[`${a.id}Note`]
        list.push(note ? `${a.label}: ${note}` : a.label)
      }
      if (a.type === 'toggle+price') list.push(`${a.label} (+$${addons[`${a.id}Price`] || a.priceOptions[0]})`)
      if (a.type === 'toggle+layer') list.push(`Extra Layer`)
    })
  }
  if (addons.customLabel) list.push(`${addons.customLabel}${addons.customPrice ? ` (+$${addons.customPrice})` : ''}`)
  return list
}

const itemKey = (item) => `${item.category}::${item.name}`

export default function MenuBuilder({ cartItems, onChange }) {
  const [selectedItem, setSelectedItem] = useState(null)
  const [size, setSize]                 = useState('round')
  const [addons, setAddons]             = useState(blankAddonState())
  const [flavor1, setFlavor1]           = useState(CUPCAKE_FLAVORS[0])
  const [flavor2, setFlavor2]           = useState('None')
  const [addonsOpen, setAddonsOpen]     = useState(false)
  const [editIdx, setEditIdx]           = useState(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName]     = useState('')
  const [customItemPrice, setCustomItemPrice] = useState('')

  const isCake      = selectedItem && CAKE_CATEGORIES.includes(selectedItem.category)
  const isCupcake   = selectedItem?.category === 'Cupcakes'
  const isCustomOnly = selectedItem && CUSTOM_ONLY_CATEGORIES.includes(selectedItem.category)
  const showFullAddons = isCake
  const showCustomOnly = isCustomOnly || isCupcake

  const activeAddonCount = CAKE_ADDONS.filter(a => addons[a.id]).length
  const livePrice = selectedItem ? calcItemPrice(selectedItem, size, addons) : 0

  const setAddon = (key, val) => setAddons(p => ({ ...p, [key]: val }))

  const selectItem = (item) => {
    setSelectedItem(item)
    setShowCustomForm(false)
    setSize('round')
    setAddons(blankAddonState())
    setFlavor1(CUPCAKE_FLAVORS[0])
    setFlavor2('None')
    setAddonsOpen(false)
  }

  const handleSelectChange = (e) => {
    const val = e.target.value
    if (!val) {
      setSelectedItem(null)
      setShowCustomForm(false)
      return
    }
    if (val === '__custom__') {
      setSelectedItem(null)
      setShowCustomForm(true)
      return
    }
    const [cat, ...rest] = val.split('::')
    const name = rest.join('::')
    const item = MENU.find(m => m.category === cat && m.name === name)
    if (item) selectItem(item)
  }

  const handleAddToCart = () => {
    if (!selectedItem) return
    const price = calcItemPrice(selectedItem, size, addons)
    const name  = buildItemName(selectedItem, size, flavor1, flavor2)
    const addonSummary = buildAddonSummary(selectedItem, addons)
    const newItem = {
      name, price, qty: 1,
      category: selectedItem.category,
      size, addonSummary,
      flavor1: isCupcake ? flavor1 : undefined,
      flavor2: isCupcake ? flavor2 : undefined,
      writingText: addons.writingText || '',
      _addons: { ...addons },
      _itemKey: itemKey(selectedItem),
    }
    if (editIdx !== null) {
      const next = [...cartItems]; next[editIdx] = newItem; onChange(next); setEditIdx(null)
    } else {
      onChange([...cartItems, newItem])
    }
    setSelectedItem(null)
    setAddons(blankAddonState())
    setAddonsOpen(false)
  }

  const removeFromCart = (idx) => onChange(cartItems.filter((_, i) => i !== idx))

  const startEdit = (idx) => {
    const ci = cartItems[idx]
    if (!ci) return
    setEditIdx(idx)

    if (ci.category === 'Custom') {
      setSelectedItem(null)
      setShowCustomForm(true)
      setCustomName(ci.name || '')
      setCustomItemPrice(String(ci.price || ''))
      return
    }

    const menuItem = MENU.find(m =>
      (ci._itemKey && ci._itemKey === itemKey(m)) ||
      (ci.name && ci.name.startsWith(m.name)) ||
      (ci.name && ci.name.includes(m.name))
    )

    if (menuItem) {
      setSelectedItem(menuItem)
      setShowCustomForm(false)
      setSize(ci.size || 'round')
      if (ci._addons) {
        setAddons({ ...blankAddonState(), ...ci._addons })
        if (Object.values(ci._addons).some(v => v === true)) setAddonsOpen(true)
      }
      if (menuItem.category === 'Cupcakes') {
        if (ci.flavor1) setFlavor1(ci.flavor1)
        if (ci.flavor2) setFlavor2(ci.flavor2 || 'None')
      }
    } else {
      setSelectedItem(null)
      setShowCustomForm(true)
      setCustomName(ci.name || '')
      setCustomItemPrice(String(ci.price || ''))
    }
  }

  const cartTotal = cartItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0)

  const handleAddCustomItem = () => {
    if (!customName.trim()) return
    const price = parseFloat(customItemPrice) || 0
    const newItem = { name: customName.trim(), price, qty: 1, category: 'Custom', addonSummary: [] }
    if (editIdx !== null) {
      const next = [...cartItems]; next[editIdx] = newItem; onChange(next); setEditIdx(null)
    } else {
      onChange([...cartItems, newItem])
    }
    setCustomName('')
    setCustomItemPrice('')
    setShowCustomForm(false)
  }

  const menuByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = MENU.filter(m => m.category === cat)
    return acc
  }, {})

  const selectValue = selectedItem ? itemKey(selectedItem) : showCustomForm ? '__custom__' : ''

  return (
    <div className={styles.wrap}>
      <div className={styles.builder}>

        {/* Grouped dropdown */}
        <div className={styles.dropdownWrap}>
          <select
            className={styles.itemSelect}
            value={selectValue}
            onChange={handleSelectChange}
          >
            <option value="">Select an item...</option>
            {CATEGORIES.map(cat => (
              <optgroup key={cat} label={cat}>
                {menuByCategory[cat]?.map(item => (
                  <option key={itemKey(item)} value={itemKey(item)}>
                    {item.name} — {fmt$(item.price)}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Other">
              <option value="__custom__">+ Add custom item...</option>
            </optgroup>
          </select>
        </div>

        {/* Custom item form */}
        {showCustomForm && (
          <div className={styles.customItemForm} style={{ marginTop: 12 }}>
            <div className={styles.customItemFields}>
              <input
                type="text"
                className={styles.customItemName}
                placeholder="Item name (e.g. Delivery fee, Rush order)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
              <div className={styles.customItemPriceWrap}>
                <span className={styles.customItemDollar}>$</span>
                <input
                  type="number" min="0" step="0.01"
                  className={styles.customItemPriceInput}
                  placeholder="0.00"
                  value={customItemPrice}
                  onChange={e => setCustomItemPrice(e.target.value)}
                />
              </div>
              <button
                className={styles.saveItemBtn}
                style={{ padding: '7px 14px', fontSize: 12 }}
                onClick={handleAddCustomItem}
                disabled={!customName.trim()}
              >
                + Add
              </button>
            </div>
          </div>
        )}

        {/* Customization zone */}
        {selectedItem && (
          <div className={styles.customZone}>
            <div className={styles.selectedHeader}>
              <div className={styles.selectedName}>{selectedItem.name}</div>
              <div className={styles.livePrice}>{fmt$(livePrice)}</div>
            </div>

            {isCake && (
              <div className={styles.sizeSection}>
                <div className={styles.zoneSectionLabel}>Size</div>
                <div className={styles.sizeRow}>
                  {SIZES.map(s => (
                    <div
                      key={s.id}
                      className={`${styles.sizeBtn} ${size === s.id ? styles.sizeBtnActive : ''}`}
                      onClick={() => setSize(s.id)}
                    >
                      <div className={styles.sizeBtnLabel}>{s.label}</div>
                      <div className={styles.sizeBtnPrice}>{fmt$(s.mod(selectedItem.price))}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isCupcake && (
              <div className={styles.sizeSection}>
                <div className={styles.zoneSectionLabel}>Flavors</div>
                <div className={styles.flavorRow}>
                  <div>
                    <div className={styles.flavorLabel}>Flavor 1 <span className={styles.req}>*</span></div>
                    <select value={flavor1} onChange={e => setFlavor1(e.target.value)} className={styles.flavorSelect}>
                      {CUPCAKE_FLAVORS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className={styles.flavorLabel}>Flavor 2 (optional)</div>
                    <select value={flavor2} onChange={e => setFlavor2(e.target.value)} className={styles.flavorSelect}>
                      <option>None</option>
                      {CUPCAKE_FLAVORS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Writing on cake — shown before add-ons */}
            {isCake && (
              <div className={styles.customOnlyRow}>
                <div className={styles.customOnlyLabel}>Writing on cake <span style={{ fontWeight: 400, fontStyle: 'italic' }}>(optional)</span></div>
                <input
                  type="text"
                  className={styles.customLabelInput}
                  style={{ width: '100%' }}
                  placeholder="e.g. Happy Birthday Kelly!"
                  value={addons.writingText || ''}
                  onChange={e => setAddon('writingText', e.target.value)}
                />
              </div>
            )}

            {showFullAddons && (
              <div className={styles.accordionWrap}>
                <div
                  className={`${styles.accordionToggle} ${addonsOpen ? styles.accordionToggleOpen : ''}`}
                  onClick={() => setAddonsOpen(v => !v)}
                >
                  <div className={styles.accordionLeft}>
                    <span className={styles.accordionLabel}>Add-ons</span>
                    {activeAddonCount > 0 && (
                      <span className={styles.addonBadge}>{activeAddonCount} selected</span>
                    )}
                  </div>
                  <div className={styles.accordionRight}>
                    <span className={styles.accordionHint}>{addonsOpen ? 'Collapse' : 'Expand'}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: addonsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {addonsOpen && (
                  <div className={styles.accordionPanel}>
                    {CAKE_ADDONS.map(a => {
                      const isOn = !!addons[a.id]
                      return (
                        <div
                          key={a.id}
                          className={`${styles.addonRow} ${isOn ? styles.addonRowOn : ''}`}
                          onClick={() => setAddon(a.id, !isOn)}
                        >
                          <div className={styles.addonInfo}>
                            <div className={styles.addonName}>{a.label}</div>
                            {a.type === 'toggle+layer'
                              ? <div className={styles.addonPrice}>+{fmt$(LAYER_PRICE[size] || 25)}</div>
                              : a.type === 'toggle+price'
                              ? <div className={styles.addonPrice}>+${addons[`${a.id}Price`] || a.priceOptions[0]}</div>
                              : a.price > 0
                              ? <div className={styles.addonPrice}>+{fmt$(a.price)}</div>
                              : null
                            }
                            {a.note && <div className={styles.addonNote}>{a.note}</div>}
                          </div>
                          <button className={`${styles.toggle} ${isOn ? styles.toggleOn : ''}`} onClick={e => { e.stopPropagation(); setAddon(a.id, !isOn) }}>
                            <span className={styles.toggleThumb} />
                          </button>
                          {isOn && a.type === 'toggle+note' && (
                            <input
                              className={styles.addonSubInput}
                              placeholder={a.notePlaceholder}
                              value={addons[`${a.id}Note`] || ''}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setAddon(`${a.id}Note`, e.target.value)}
                            />
                          )}
                          {isOn && a.type === 'toggle+price' && (
                            <div className={styles.priceOptions} onClick={e => e.stopPropagation()}>
                              {a.priceOptions.map(p => (
                                <button
                                  key={p}
                                  className={`${styles.priceOpt} ${(addons[`${a.id}Price`] || a.priceOptions[0]) === p ? styles.priceOptActive : ''}`}
                                  onClick={() => setAddon(`${a.id}Price`, p)}
                                >${p}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div className={styles.customAddonRow} onClick={e => e.stopPropagation()}>
                      <input
                        className={styles.customLabelInput}
                        placeholder="Custom add-on description"
                        value={addons.customLabel}
                        onChange={e => setAddon('customLabel', e.target.value)}
                      />
                      <div className={styles.customPriceWrap}>
                        <span>$</span>
                        <input
                          type="number" min="0"
                          className={styles.customPriceInput}
                          placeholder="0"
                          value={addons.customPrice}
                          onChange={e => setAddon('customPrice', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showCustomOnly && (
              <div className={styles.customOnlyRow}>
                <div className={styles.customOnlyLabel}>Custom add-on (optional)</div>
                <div className={styles.customOnlyFields}>
                  <input
                    className={styles.customLabelInput}
                    placeholder="Description"
                    value={addons.customLabel}
                    onChange={e => setAddon('customLabel', e.target.value)}
                  />
                  <div className={styles.customPriceWrap}>
                    <span>$</span>
                    <input
                      type="number" min="0"
                      className={styles.customPriceInput}
                      placeholder="0"
                      value={addons.customPrice}
                      onChange={e => setAddon('customPrice', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className={styles.saveItemRow}>
              <button className={styles.saveItemBtn} onClick={handleAddToCart}>
                {editIdx !== null ? '✓ Update item' : '✓ Save item to order'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cart */}
      {cartItems.length > 0 && (
        <div className={styles.cart}>
          <div className={styles.cartLabel}>Order items</div>
          {cartItems.map((ci, idx) => {
            const addonRaw = ci.addonSummary
            const addonStr = Array.isArray(addonRaw) ? addonRaw.join(' · ') : (addonRaw || '')
            return (
              <div key={idx} className={styles.cartRow}>
                <div className={styles.cartInfo}>
                  <div className={styles.cartName}>{ci.name}</div>
                  {addonStr && <div className={styles.cartAddons}>{addonStr}</div>}
                  {ci.writingText && (
                    <div className={styles.cartWriting}>✏ "{ci.writingText}"</div>
                  )}
                </div>
                <div className={styles.cartRight}>
                  <div className={styles.cartPrice}>{fmt$(ci.price)}</div>
                  <button className={styles.cartEdit} onClick={() => startEdit(idx)}>Edit</button>
                  <button className={styles.cartRemove} onClick={() => removeFromCart(idx)}>×</button>
                </div>
              </div>
            )
          })}
          <div className={styles.cartTotal}>
            <span>Order total</span>
            <span className={styles.cartTotalAmt}>{fmt$(cartTotal)}</span>
          </div>
        </div>
      )}

      {cartItems.length === 0 && !selectedItem && !showCustomForm && (
        <div className={styles.emptyCart}>Select an item above to begin</div>
      )}
    </div>
  )
}
