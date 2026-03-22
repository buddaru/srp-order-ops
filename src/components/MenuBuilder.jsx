import { useState } from 'react'
import { fmt$ } from '../utils/helpers'
import {
  MENU, CATEGORIES, CUPCAKE_FLAVORS,
  CAKE_CATEGORIES, SIZES, CAKE_ADDONS, CHEESECAKE_ADDONS, LAYER_PRICE
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
  writingOnCake: '',
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
    if (addons.customLabel && addons.customPrice) total += parseFloat(addons.customPrice) || 0
  }
  if (item.category === 'Cheesecakes') {
    if (addons.printedImage) total += 25
    if (addons.customLabel && addons.customPrice) total += parseFloat(addons.customPrice) || 0
  }
  return total
}

function buildItemName(item, size, addons, flavor1, flavor2) {
  if (!item) return ''
  if (item.category === 'Cupcakes') {
    const f2 = flavor2 && flavor2 !== 'None' ? ` / ${flavor2}` : ''
    return `Cupcakes (1 Dozen) — ${flavor1}${f2}`
  }
  const sizeObj = SIZES.find(s => s.id === size) || SIZES[0]
  const sizeStr = sizeObj.id !== 'round' ? ` (${sizeObj.label})` : ''
  return `${item.name}${sizeStr}`
}

function buildAddonSummary(item, size, addons) {
  if (!item) return []
  const list = []
  const addonsToCheck = item.category === 'Cheesecakes' ? CHEESECAKE_ADDONS : CAKE_ADDONS
  addonsToCheck.forEach(a => {
    if (a.type === 'text') {
      if (addons.writingOnCake) list.push(`Writing: "${addons.writingOnCake}"`)
      return
    }
    if (!addons[a.id]) return
    if (a.type === 'toggle') list.push(a.label)
    if (a.type === 'toggle+note') {
      const note = addons[`${a.id}Note`]
      list.push(note ? `${a.label}: ${note}` : a.label)
    }
    if (a.type === 'toggle+price') list.push(`${a.label} (+$${addons[`${a.id}Price`] || a.priceOptions[0]})`)
    if (a.type === 'toggle+layer') list.push(`Extra Layer (+$${LAYER_PRICE[size] || 25})`)
  })
  if (addons.customLabel) list.push(`${addons.customLabel}${addons.customPrice ? ` (+$${addons.customPrice})` : ''}`)
  return list
}

export default function MenuBuilder({ cartItems, onChange }) {
  const [activeCat, setActiveCat]   = useState('Cakes')
  const [selectedItem, setSelectedItem] = useState(null)
  const [size, setSize]             = useState('round')
  const [addons, setAddons]         = useState(blankAddonState())
  const [flavor1, setFlavor1]       = useState(CUPCAKE_FLAVORS[0])
  const [flavor2, setFlavor2]       = useState('None')
  const [editIdx, setEditIdx]       = useState(null)

  const catItems = MENU.filter(m => m.category === activeCat)
  const isCake = selectedItem && CAKE_CATEGORIES.includes(selectedItem.category)
  const isCheese = selectedItem?.category === 'Cheesecakes'
  const isCupcake = selectedItem?.category === 'Cupcakes'
  const hasAddons = isCake || isCheese

  const livePrice = selectedItem
    ? calcItemPrice(selectedItem, size, addons)
    : 0

  const setAddon = (key, val) => setAddons(p => ({ ...p, [key]: val }))

  const selectItem = (item) => {
    setSelectedItem(item)
    setSize('round')
    setAddons(blankAddonState())
    setFlavor1(CUPCAKE_FLAVORS[0])
    setFlavor2('None')
  }

  const handleAddToCart = () => {
    if (!selectedItem) return
    const price = calcItemPrice(selectedItem, size, addons)
    const name  = buildItemName(selectedItem, size, addons, flavor1, flavor2)
    const addonSummary = buildAddonSummary(selectedItem, size, addons)
    const newItem = {
      name,
      price,
      qty: 1,
      category: selectedItem.category,
      size,
      addonSummary,
      flavor1: isCupcake ? flavor1 : undefined,
      flavor2: isCupcake ? flavor2 : undefined,
      writingText: addons.writingOnCake || undefined,
    }
    if (editIdx !== null) {
      const next = [...cartItems]
      next[editIdx] = newItem
      onChange(next)
      setEditIdx(null)
    } else {
      onChange([...cartItems, newItem])
    }
    setSelectedItem(null)
    setAddons(blankAddonState())
  }

  const removeFromCart = (idx) => onChange(cartItems.filter((_, i) => i !== idx))

  const startEdit = (idx) => {
    setEditIdx(idx)
    const ci = cartItems[idx]
    const menuItem = MENU.find(m => m.name === ci.name.split(' — ')[0].split(' (')[0]) ||
                     MENU.find(m => ci.name.includes(m.name))
    if (menuItem) {
      setActiveCat(menuItem.category)
      setSelectedItem(menuItem)
      setSize(ci.size || 'round')
    }
  }

  const cartTotal = cartItems.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.qty) || 1), 0)

  const activeAddons = isCake ? CAKE_ADDONS : isCheese ? CHEESECAKE_ADDONS : []

  return (
    <div className={styles.wrap}>

      {/* ── Split panel ── */}
      <div className={styles.panel}>

        {/* LEFT — category + items */}
        <div className={styles.left}>
          <div className={styles.catList}>
            {CATEGORIES.map(c => (
              <button
                key={c}
                className={`${styles.catBtn} ${activeCat === c ? styles.catActive : ''}`}
                onClick={() => { setActiveCat(c); setSelectedItem(null) }}
              >{c}</button>
            ))}
          </div>
          <div className={styles.itemList}>
            {catItems.map(item => (
              <div
                key={item.name}
                className={`${styles.itemRow} ${selectedItem?.name === item.name ? styles.itemSelected : ''}`}
                onClick={() => selectItem(item)}
              >
                <div>
                  <div className={styles.itemName}>{item.name}</div>
                </div>
                <div className={styles.itemPrice}>{fmt$(item.price)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — customizations */}
        <div className={styles.right}>
          {!selectedItem ? (
            <div className={styles.rightEmpty}>
              <div className={styles.rightEmptyIcon}>←</div>
              <div className={styles.rightEmptyText}>Select an item to customize</div>
            </div>
          ) : (
            <>
              <div className={styles.rightHeader}>
                <div className={styles.rightItemName}>{selectedItem.name}</div>
                <div className={styles.rightBasePrice}>Base: {fmt$(selectedItem.price)}</div>
              </div>

              <div className={styles.addonScroll}>

                {/* SIZE — cakes only */}
                {isCake && (
                  <div className={styles.addonSection}>
                    <div className={styles.addonSectionLabel}>Size</div>
                    <div className={styles.sizeRow}>
                      {SIZES.map(s => (
                        <button
                          key={s.id}
                          className={`${styles.sizeBtn} ${size === s.id ? styles.sizeBtnActive : ''}`}
                          onClick={() => setSize(s.id)}
                        >
                          <div className={styles.sizeBtnLabel}>{s.label}</div>
                          <div className={styles.sizeBtnPrice}>{fmt$(s.mod(selectedItem.price))}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* CUPCAKE FLAVORS */}
                {isCupcake && (
                  <div className={styles.addonSection}>
                    <div className={styles.addonSectionLabel}>Flavors</div>
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

                {/* ADD-ONS */}
                {hasAddons && (
                  <div className={styles.addonSection}>
                    <div className={styles.addonSectionLabel}>Add-ons</div>
                    {activeAddons.map(a => {
                      const isOn = !!addons[a.id]
                      if (a.type === 'text') {
                        return (
                          <div key={a.id} className={styles.addonTextRow}>
                            <div className={styles.addonTextLabel}>{a.label} <span className={styles.free}>Free</span></div>
                            <input
                              type="text"
                              className={styles.addonTextInput}
                              placeholder={a.placeholder}
                              value={addons.writingOnCake}
                              onChange={e => setAddon('writingOnCake', e.target.value)}
                            />
                          </div>
                        )
                      }
                      return (
                        <div key={a.id} className={`${styles.addonRow} ${isOn ? styles.addonRowOn : ''}`}>
                          <div className={styles.addonInfo}>
                            <div className={styles.addonLabel}>{a.label}</div>
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
                          <button
                            className={`${styles.toggle} ${isOn ? styles.toggleOn : ''}`}
                            onClick={() => setAddon(a.id, !isOn)}
                          >
                            <span className={styles.toggleThumb} />
                          </button>

                          {/* Expanded fields when toggled on */}
                          {isOn && a.type === 'toggle+note' && (
                            <input
                              type="text"
                              className={styles.addonNoteInput}
                              placeholder={a.notePlaceholder}
                              value={addons[`${a.id}Note`] || ''}
                              onChange={e => setAddon(`${a.id}Note`, e.target.value)}
                            />
                          )}
                          {isOn && a.type === 'toggle+price' && (
                            <div className={styles.priceOptions}>
                              {a.priceOptions.map(p => (
                                <button
                                  key={p}
                                  className={`${styles.priceOptionBtn} ${(addons[`${a.id}Price`] || a.priceOptions[0]) === p ? styles.priceOptionActive : ''}`}
                                  onClick={() => setAddon(`${a.id}Price`, p)}
                                >${p}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* CUSTOM ADD-ON — all except cookies/pound/delectables */}
                {(hasAddons || isCupcake) && (
                  <div className={styles.addonSection}>
                    <div className={styles.addonSectionLabel}>Custom add-on</div>
                    <div className={styles.customRow}>
                      <input
                        type="text"
                        className={styles.customLabelInput}
                        placeholder="Description"
                        value={addons.customLabel}
                        onChange={e => setAddon('customLabel', e.target.value)}
                      />
                      <div className={styles.customPriceWrap}>
                        <span className={styles.dollarSign}>$</span>
                        <input
                          type="number"
                          className={styles.customPriceInput}
                          placeholder="0"
                          min="0"
                          value={addons.customPrice}
                          onChange={e => setAddon('customPrice', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Add to cart footer */}
              <div className={styles.rightFooter}>
                <div className={styles.liveTotal}>{fmt$(livePrice)}</div>
                <button className={styles.addToCartBtn} onClick={handleAddToCart}>
                  {editIdx !== null ? 'Update item' : '+ Add to order'}
                </button>
              </div>
            </>
          )}
        </div>
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
                <div className={styles.cartActions}>
                  <button className={styles.cartEdit} onClick={() => startEdit(idx)}>Edit</button>
                  <button className={styles.cartRemove} onClick={() => removeFromCart(idx)}>×</button>
                </div>
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
        <div className={styles.emptyCart}>No items added yet</div>
      )}
    </div>
  )
}
