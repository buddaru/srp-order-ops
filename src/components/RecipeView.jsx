import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, safeQuery } from '../lib/supabase'
import styles from './RecipeView.module.css'

// ── Icons ──
const BackIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
const ShareIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
const EditIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const FolderIcon= () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
const YieldIcon = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
const PhotoIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
const ScaleIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v18M18 3v18M3 6h18M3 18h18M3 12h18"/></svg>
const ChevronIcon = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>

// ── Fraction / scaling helpers ──
function toDecimal(str) {
  str = str.trim()
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3])
  const frac = str.match(/^(\d+)\/(\d+)$/)
  if (frac) return parseInt(frac[1]) / parseInt(frac[2])
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

function toFraction(n) {
  if (n <= 0) return '0'
  if (n === Math.floor(n)) return String(Math.floor(n))
  const whole = Math.floor(n)
  const rem   = n - whole
  const fracs = [[1,8],[1,4],[1,3],[3,8],[1,2],[5,8],[2,3],[3,4],[7,8]]
  let best = null, bestDiff = Infinity
  for (const [num, den] of fracs) {
    const diff = Math.abs(rem - num / den)
    if (diff < bestDiff) { bestDiff = diff; best = [num, den] }
  }
  if (bestDiff > 0.06) return n.toFixed(1)
  const fracStr = `${best[0]}/${best[1]}`
  return whole > 0 ? `${whole} ${fracStr}` : fracStr
}

function scaleAmount(amountStr, factor) {
  if (!amountStr || factor === 1) return amountStr
  // compound: "1 tbsp + 1 tsp"
  if (amountStr.includes('+')) {
    return amountStr.split('+').map(p => scaleAmount(p.trim(), factor)).join(' + ')
  }
  const numPattern = /^([\d]+\s+[\d]+\/[\d]+|[\d]+\/[\d]+|[\d]*\.[\d]+|[\d]+)/
  const match = amountStr.match(numPattern)
  if (!match) return amountStr
  const dec = toDecimal(match[1])
  if (dec === null) return amountStr
  return amountStr.replace(match[1], toFraction(dec * factor))
}

// ── Scale dropdown component ──
function ScaleDropdown({ scale, setScale, baseQty, baseUnit }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const options = [
    { label: '½×', value: 0.5 },
    { label: '1×', value: 1 },
    { label: '2×', value: 2 },
    { label: '3×', value: 3 },
    { label: '4×', value: 4 },
    { label: '5×', value: 5 },
  ]

  const scaledYield = baseQty
    ? `${toFraction(parseFloat(baseQty) * scale)} ${baseUnit || ''}`
    : null

  const scaleLabel = scale === 0.5 ? '½×' : `${scale}×`

  return (
    <div className={styles.scaleWrap} ref={ref}>
      <button
        className={`${styles.scaleBtn} ${scale !== 1 ? styles.scaleBtnActive : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <ScaleIcon />
        Batch size
        <span className={styles.scaleBadge}>{scaleLabel}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className={styles.scaleDropdown}>
          <div className={styles.scaleHeader}>Scale recipe</div>
          {options.map(opt => (
            <button
              key={opt.value}
              className={`${styles.scaleOption} ${scale === opt.value ? styles.scaleSelected : ''}`}
              onClick={() => { setScale(opt.value); setOpen(false) }}
            >
              <span>{opt.label}</span>
              {baseQty && (
                <span className={styles.scaleYield}>
                  → {toFraction(parseFloat(baseQty) * opt.value)} {baseUnit || ''}
                </span>
              )}
            </button>
          ))}
          <div className={styles.scaleDivider} />
          <div className={styles.customRow}>
            <span className={styles.customLabel}>Custom</span>
            <input
              className={styles.customInput}
              type="number"
              min="0.1"
              step="0.5"
              placeholder="e.g. 6"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = parseFloat(e.target.value)
                  if (v > 0) { setScale(v); setOpen(false) }
                }
              }}
            />
            <span className={styles.customLabel}>×</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════
//  Main component
// ══════════════════════════════════
export default function RecipeView() {
  const navigate       = useNavigate()
  const { id }         = useParams()
  const [loading, setLoading] = useState(true)
  const [recipe,  setRecipe]  = useState(null)
  const [scale,   setScale]   = useState(1)

  useEffect(() => {
    const load = async () => {
      const { data } = await safeQuery(() =>
        supabase.from('recipes').select('*').eq('id', id).single()
      )
      if (data) {
        setRecipe(data)
        // Update last_viewed timestamp
        supabase.from('recipes').update({ last_viewed: new Date().toISOString() }).eq('id', id)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className={styles.loadingState}>Loading recipe…</div>
  if (!recipe)  return <div className={styles.loadingState}>Recipe not found.</div>

  const ings  = (recipe.ingredients || []).map(ing => {
    if (ing.type === 'header') return ing
    if (ing.type === 'item' && ing.amount !== undefined) return ing  // manual recipe format
    // Meez format: {qty, unit, name, note, type}
    return {
      type:   'item',
      amount: [ing.qty, ing.unit].filter(Boolean).join(' '),
      name:   ing.name || '',
      note:   ing.note || '',
    }
  })
  // support both 'steps' (Meez sync) and 'directions' (manually created recipes)
  const rawSteps = recipe.steps || recipe.directions || []
  // normalize Meez steps format {order, text} to view format {type, text}
  const steps = rawSteps.map(s => {
    if (s.type) return s  // already in view format
    if (s.is_header) return { type: 'header', label: s.text }
    return { type: 'step', text: s.text }
  })

  const stepNums = {}
  let n = 0
  steps.forEach((s, i) => { if (s.type === 'step') stepNums[i] = ++n })
  const totalSteps = n

  const scaledYield = recipe.yield_qty
    ? `${toFraction(parseFloat(recipe.yield_qty) * scale)}${recipe.yield_unit ? ' ' + recipe.yield_unit : ''}`
    : null

  return (
    <div className={styles.page}>
      {/* ── Topbar ── */}
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => navigate('/recipes')}>
          <BackIcon /> Recipes
        </button>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbName}>{recipe.name}</span>
        <div className={styles.topbarRight}>
          <button className={styles.btnOutline}>
            <ShareIcon /> Share
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={styles.content}>

        {/* Meta row */}
        <div className={styles.metaRow}>
          {recipe.group_name && (
            <span className={styles.tag}><FolderIcon /> {recipe.group_name}</span>
          )}
          {scaledYield && (
            <span className={styles.yieldTag}><YieldIcon /> Yield: {scaledYield}</span>
          )}
          <ScaleDropdown
            scale={scale}
            setScale={setScale}
            baseQty={recipe.yield_qty}
            baseUnit={recipe.yield_unit}
          />
        </div>

        {/* Panels */}
        <div className={styles.panels}>

          {/* ── LEFT: Ingredients ── */}
          <div className={styles.panel}>
            <div className={styles.panelLabel}>Ingredients</div>
            <div className={styles.ingList}>
              {ings.length === 0 ? (
                <div className={styles.emptyPanel}>No ingredients added yet.</div>
              ) : ings.map((ing, i) => ing.type === 'header' ? (
                <div key={i} className={styles.ingHeaderRow}>
                  <span className={styles.ingHeaderLabel}>{ing.label}</span>
                </div>
              ) : (
                <div key={i} className={styles.ingRow}>
                  <div className={styles.ingAmount}>
                    {scaleAmount(ing.amount, scale)}
                  </div>
                  <div className={styles.ingName}>
                    {ing.name}
                    {ing.note && <span className={styles.ingNote}>{ing.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Directions ── */}
          <div className={styles.panel}>
            <div className={styles.panelLabel}>
              Directions
              {totalSteps > 0 && <span className={styles.stepBadge}>{totalSteps}</span>}
            </div>

            {recipe.cover_image ? (
              <img src={recipe.cover_image} alt="Cover" className={styles.coverImg} />
            ) : (
              <div className={styles.coverEmpty}>
                <PhotoIcon /> No cover image
              </div>
            )}

            <div className={styles.dirList}>
              {steps.length === 0 ? (
                <div className={styles.emptyPanel}>No directions added yet.</div>
              ) : steps.map((s, i) => s.type === 'header' ? (
                <div key={i} className={styles.dirHeaderRow}>
                  <span className={styles.dirHeaderLabel}>{s.label}</span>
                </div>
              ) : (
                <div key={i} className={styles.dirRow}>
                  <div className={styles.stepPill}>{stepNums[i]}</div>
                  <div className={styles.stepText}>{s.text}</div>
                  {s.media && (
                    <img src={s.media} alt={`Step ${stepNums[i]}`} className={styles.stepImg} />
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Edit FAB ── */}
      <button className={styles.editFab} onClick={() => navigate(`/recipes/${id}/edit`)}>
        <EditIcon /> Edit Recipe
      </button>
    </div>
  )
}
