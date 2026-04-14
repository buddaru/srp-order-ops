import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Reports.module.css'

// ── Icons ──
const TrendUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)
const AlertIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

function marginColor(pct) {
  if (pct == null) return 'var(--text-muted)'
  if (pct >= 65)  return '#2a7a2e'
  if (pct >= 45)  return '#c47b1a'
  return '#c0392b'
}

function marginLabel(pct) {
  if (pct == null) return null
  if (pct >= 65)  return 'healthy'
  if (pct >= 45)  return 'watch'
  return 'low'
}

// ── COGS & Margin Analysis tab ──
function CogsTab() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [sort,    setSort]    = useState('margin_asc')

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // Fetch menu items
      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('id, name, category, price, active')
        .order('name')

      if (!menuItems?.length) { setItems([]); setLoading(false); return }

      // Fetch recipe links for all menu items
      const { data: links } = await supabase
        .from('menu_item_recipes')
        .select('menu_item_id, portions, recipe:recipes(id, name, cost_per_serving, cached_cost, yield_qty, yield_unit)')

      const linksByItem = {}
      for (const l of (links || [])) {
        if (!linksByItem[l.menu_item_id]) linksByItem[l.menu_item_id] = []
        linksByItem[l.menu_item_id].push(l)
      }

      const rows = menuItems.map(item => {
        const itemLinks = linksByItem[item.id] || []
        const price = parseFloat(item.price) || 0
        let totalCost = null
        let missingCost = false

        if (itemLinks.length > 0) {
          let sum = 0
          for (const l of itemLinks) {
            const cps = l.recipe?.cost_per_serving
            if (cps == null) { missingCost = true; break }
            sum += parseFloat(cps) * (parseFloat(l.portions) || 1)
          }
          if (!missingCost) totalCost = sum
        }

        const margin = (totalCost != null && price > 0)
          ? ((price - totalCost) / price) * 100
          : null

        return {
          id:          item.id,
          name:        item.name,
          category:    item.category || 'Uncategorized',
          price,
          cost:        totalCost,
          margin,
          active:      item.active,
          missingCost,
          linkedCount: itemLinks.length,
        }
      })

      setItems(rows)
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...items].sort((a, b) => {
    if (sort === 'margin_asc') {
      if (a.margin == null && b.margin == null) return 0
      if (a.margin == null) return 1
      if (b.margin == null) return -1
      return a.margin - b.margin
    }
    if (sort === 'margin_desc') {
      if (a.margin == null && b.margin == null) return 0
      if (a.margin == null) return 1
      if (b.margin == null) return -1
      return b.margin - a.margin
    }
    if (sort === 'price_desc') return b.price - a.price
    if (sort === 'az') return a.name.localeCompare(b.name)
    return 0
  })

  // Summary stats
  const withMargin  = items.filter(i => i.margin != null)
  const avgMargin   = withMargin.length
    ? withMargin.reduce((s, i) => s + i.margin, 0) / withMargin.length
    : null
  const lowCount    = withMargin.filter(i => i.margin < 45).length
  const noDataCount = items.filter(i => i.margin == null).length

  // Group by category
  const categories = [...new Set(sorted.map(i => i.category))]

  if (loading) {
    return (
      <div className={styles.tabContent}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="skeletonRow">
            <div className="skeletonLine" style={{ width: `${40 + (i * 11) % 40}%` }} />
            <div style={{ flex: 1 }} />
            <div className="skeletonLine" style={{ width: 90 }} />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📊</div>
          <div className={styles.emptyTitle}>No menu items found</div>
          <div className={styles.emptySub}>
            Add items in <strong>Menu & Pricing</strong>, link them to recipes, and set ingredient prices to see your margins here.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.tabContent}>
      {/* Summary cards */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Menu Items</div>
          <div className={styles.summaryVal}>{items.length}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Avg Margin</div>
          <div className={styles.summaryVal} style={{ color: avgMargin != null ? marginColor(avgMargin) : undefined }}>
            {avgMargin != null ? `${avgMargin.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Low Margin Items</div>
          <div className={styles.summaryVal} style={{ color: lowCount > 0 ? '#c0392b' : 'var(--text)' }}>
            {lowCount}
          </div>
        </div>
        {noDataCount > 0 && (
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Missing Cost Data</div>
            <div className={styles.summaryVal} style={{ color: '#c47b1a' }}>{noDataCount}</div>
          </div>
        )}
      </div>

      {noDataCount > 0 && (
        <div className={styles.noticeBanner}>
          <AlertIcon />
          <span>
            {noDataCount} item{noDataCount !== 1 ? 's' : ''} are missing cost data. Link recipes to those items and ensure all ingredients are priced to see full margins.
          </span>
        </div>
      )}

      {/* Sort control */}
      <div className={styles.tableControls}>
        <label className={styles.sortLabel}>Sort by</label>
        <select className={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="margin_asc">Margin — Low to High</option>
          <option value="margin_desc">Margin — High to Low</option>
          <option value="price_desc">Price — High to Low</option>
          <option value="az">Name A → Z</option>
        </select>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thName}>Item</th>
              <th className={styles.thNum}>Sale Price</th>
              <th className={styles.thNum}>COGS</th>
              <th className={styles.thNum}>Gross Profit</th>
              <th className={styles.thNum}>Margin</th>
              <th className={styles.thStatus}>Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const catItems = sorted.filter(i => i.category === cat)
              return [
                <tr key={`cat-${cat}`} className={styles.categoryRow}>
                  <td colSpan={6} className={styles.categoryLabel}>{cat}</td>
                </tr>,
                ...catItems.map(item => {
                  const grossProfit = (item.cost != null && item.price > 0)
                    ? item.price - item.cost
                    : null
                  const label = marginLabel(item.margin)
                  return (
                    <tr key={item.id} className={`${styles.dataRow} ${!item.active ? styles.inactive : ''}`}>
                      <td className={styles.tdName}>
                        <span className={styles.itemName}>{item.name}</span>
                        {!item.active && <span className={styles.inactiveBadge}>inactive</span>}
                        {item.linkedCount === 0 && <span className={styles.warnBadge}>no recipe linked</span>}
                      </td>
                      <td className={styles.tdNum}>
                        {item.price > 0 ? `$${item.price.toFixed(2)}` : <span className={styles.na}>—</span>}
                      </td>
                      <td className={styles.tdNum}>
                        {item.cost != null
                          ? `$${item.cost.toFixed(2)}`
                          : <span className={styles.na}>—</span>
                        }
                      </td>
                      <td className={styles.tdNum}>
                        {grossProfit != null
                          ? <span style={{ color: grossProfit >= 0 ? '#2a7a2e' : '#c0392b' }}>${grossProfit.toFixed(2)}</span>
                          : <span className={styles.na}>—</span>
                        }
                      </td>
                      <td className={styles.tdNum}>
                        {item.margin != null
                          ? <span style={{ color: marginColor(item.margin), fontWeight: 600 }}>{item.margin.toFixed(1)}%</span>
                          : <span className={styles.na}>—</span>
                        }
                      </td>
                      <td className={styles.tdStatus}>
                        {label && (
                          <span className={`${styles.marginBadge} ${styles[`badge_${label}`]}`}>
                            {label === 'healthy' && <TrendUpIcon />}
                            {label === 'low' && <AlertIcon />}
                            {label}
                          </span>
                        )}
                        {item.missingCost && !label && (
                          <span className={styles.missingBadge}>incomplete</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              ]
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.tableFootnote}>
        Margin = (Sale Price − COGS) ÷ Sale Price. Healthy ≥ 65% · Watch 45–64% · Low &lt; 45%
      </div>
    </div>
  )
}

// ── Main Reports page ──
export default function Reports() {
  const [tab, setTab] = useState('cogs')

  const TABS = [
    { id: 'cogs', label: 'COGS & Margin Analysis' },
  ]

  return (
    <div className={styles.page}>
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Reports</h1>
          <p className="pageSub">Financial insights and performance analysis for your business.</p>
        </div>
      </div>

      <div className={styles.tabRow}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cogs' && <CogsTab />}
    </div>
  )
}
