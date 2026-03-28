import { useState } from 'react'
import { fmt$ } from '../utils/helpers'
import {
  MENU, CATEGORIES, CUPCAKE_FLAVORS,
  CAKE_CATEGORIES, CUSTOM_ONLY_CATEGORIES,
  SIZES, CAKE_ADDONS, LAYER_PRICE
} from '../data/menuData'
import styles from './MenuBuilder.module.css'

const ALL_CATEGORIES = [...CATEGORIES, 'Custom Item']

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

export default function MenuBuilder({ cartItems, onChange }) {
  const [activeCat, setActiveCat]       = useState('Cakes')
  const [selectedItem, setSelectedItem] = useState(null)
  const [size, setSize]                 = useState('round')
  const [addons, setAddons]             = useState(blankAddonState())
  const [flavor1, setFlavor1]           = useState(CUPCAKE_FLAVORS[0])
  const [flavor2, setFlavor2]           = useState('None')
  const [addonsOpen, setAddonsOpen]     = useState(false)
  const [editIdx, setEditIdx]           = useState(null)
  const [customName, setCustomName]     = useState('')
  const [customItemPrice, setCustomItemPrice] = useState('')

  const isCustomCat = activeCat === 'Custom Item'

  const catItems    = MENU.filter(m => m.category === activeCat)
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
    setSize('round')
    setAddons(blankAddonState())
    setFlavor1(CUPCAKE_FLAVORS[0])
    setFlavor2('None')
    setAddonsOpen(false)
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
    setEditIdx(idx)
    const ci = cartItems[idx]
    const menuItem = MENU.find(m => ci.name.startsWith(m.name) || ci.name.includes(m.name))
    if (menuItem) {
      setActiveCat(menuItem.category)
      setSelectedItem(menuItem)
      setSize(ci.size || 'round')
    }
  }

  const cartTotal = cartItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0)

  const handleAddCustomItem = () => {
    if (!customName.trim()) return
    const price = parseFloat(customItemPrice) || 0
    const newItem = {
      name: customName.trim(),
      price,
      qty: 1,
      category: 'Custom',
      addonSummary: [],
    }
    if (editIdx !== null) {
      const next = [...cartItems]; next[editIdx] = newItem; onChange(next); setEditIdx(null)
    } else {
      onChange([...cartItems, newItem])
    }
    setCustomName('')
    setCustomItemPrice('')
  }

  return (
    <div className={styles.wrap}>

      {/* ── Builder ── */}
      <div className={styles.builder}>

        {/* Category tabs */}
        <div className={styles.catTabs}>
          {ALL_CATEGORIES.map(c => (
            <button
              key={c}
              className={`${styles.catTab} ${activeCat === c ? styles.catTabActive : ''} ${c === 'Custom Item' ? styles.catTabCustom : ''}`}
              onClick={() => { setActiveCat(c); setSelectedItem(null); setAddonsOpen(false) }}
            >{c}</button>
          ))}
        </div>

        {/* Custom item form */}
        {isCustomCat && (
          <div className={styles.customItemForm}>
            <div className={styles.customItemTitle}>Add a custom line item</div>
            <div className={styles.customItemFields}>
              <input
                type="text"
                className={styles.customItemName}
                placeholder="Item name (e.g. Delivery fee, Rush order, Special decoration)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
              <div className={styles.customItemPriceWrap}>
                <span className={styles.customItemDollar}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={styles.customItemPriceInput}
                  placeholder="0.00"
                  value={customItemPrice}
                  onChange={e => setCustomItemPrice(e.target.value)}
                />
              </div>
            </div>
            <button
              className={styles.saveItemBtn}
              onClick={handleAddCustomItem}
              disabled={!customName.trim()}
            >
              + Add to order
            </button>
          </div>
        )}

        {/* Item chips — standard categories only */}
        {!isCustomCat && (
          <div className={styles.itemGrid}>
            {catItems.map(item => (
              <div
                key={item.name}
                className={`${styles.itemChip} ${selectedItem?.name === item.name ? styles.itemChipSelected : ''}`}
                onClick={() => selectItem(item)}
              >
                <div className={styles.itemChipName}>{item.name}</div>
                <div className={styles.itemChipPrice}>{fmt$(item.price)}</div>
              </div>
            ))}
          </div>
        )}

        {!isCustomCat && selectedItem && (
          <div className={styles.customZone}>

            {/* Header with live price */}
            <div className={styles.selectedHeader}>
              <div className={styles.selectedName}>{selectedItem.name}</div>
              <div className={styles.livePrice}>{fmt$(livePrice)}</div>
            </div>

            {/* Size — cake categories only */}
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

            {/* Cupcake flavors */}
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

            {/* Full add-ons accordion — cake categories */}
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
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{transform: addonsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0}}>
                      <polyline points="6 9 12 15 18 9"/>
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

                    {/* Custom add-on inside panel */}
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

            {/* Custom-only add-on for non-cake categories */}
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

            {/* Save item button */}
            <div className={styles.saveItemRow}>
              <button className={styles.saveItemBtn} onClick={handleAddToCart}>
                {editIdx !== null ? '✓ Update item' : '✓ Save item to order'}
              </button>
            </div>

          </div>
        )}
      </div>

      {/* ── Cart ── */}
      {cartItems.length > 0 && (
        <div className={styles.cart}>
          <div className={styles.cartLabel}>Order items</div>
          {cartItems.map((ci, idx) => (
            <div key={idx} className={styles.cartRow}>
              <div className={styles.cartInfo}>
                <div className={styles.cartName}>{ci.name}</div>
                {ci.addonSummary?.length > 0 && (
                  <div className={styles.cartAddons}>{ci.addonSummary.join(' · ')}</div>
                )}
              </div>
              <div className={styles.cartRight}>
                <div className={styles.cartPrice}>{fmt$(ci.price)}</div>
                <button className={styles.cartEdit} onClick={() => startEdit(idx)}>Edit</button>
                <button className={styles.cartRemove} onClick={() => removeFromCart(idx)}>×</button>
              </div>
            </div>
          ))}
          <div className={styles.cartTotal}>
            <span>Order total</span>
            <span className={styles.cartTotalAmt}>{fmt$(cartTotal)}</span>
          </div>
        </div>
      )}

      {cartItems.length === 0 && !selectedItem && (
        <div className={styles.emptyCart}>Select a category and item above to begin</div>
      )}
    </div>
  )
}
