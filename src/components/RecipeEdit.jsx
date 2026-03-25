import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase, safeQuery } from '../lib/supabase'
import styles from './RecipeEdit.module.css'

// ── Icons ──
const DragIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <circle cx="9"  cy="5"  r="1.5" fill="currentColor"/>
    <circle cx="9"  cy="12" r="1.5" fill="currentColor"/>
    <circle cx="9"  cy="19" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="5"  r="1.5" fill="currentColor"/>
    <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="19" r="1.5" fill="currentColor"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const NoteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const PhotoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)
const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
)
const ListIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6"  x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6"  x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const FolderIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
)
const ShareIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
)
// ── Parse raw pasted text → structured arrays ──
function parseIngredients(raw) {
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map(line => {
    if (line.trim().endsWith(':')) return { type: 'header', label: line.trim().slice(0, -1) }
    const parts  = line.trim().split(/\s+/)
    const amount = parts.slice(0, 2).join(' ')
    const name   = parts.slice(2).join(' ')
    return { type: 'item', amount, name: name || amount, note: '' }
  })
}

function parseDirections(raw) {
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map(line => {
    if (line.trim().endsWith(':')) return { type: 'header', label: line.trim().slice(0, -1) }
    return { type: 'step', text: line.trim() }
  })
}

// ── Auto-resize textarea ──
function autoResize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

// ── Drag & drop hook ──
function useDragDrop(setList) {
  const dragSrc = useRef(null)

  const onDragStart = useCallback((e, i) => {
    dragSrc.current = i
    e.currentTarget.classList.add(styles.dragging)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onDragEnd = useCallback((e) => {
    e.currentTarget.classList.remove(styles.dragging)
    document.querySelectorAll(`.${styles.dragOverTop}, .${styles.dragOverBottom}`)
      .forEach(el => el.classList.remove(styles.dragOverTop, styles.dragOverBottom))
  }, [])

  const onDragOver = useCallback((e, i) => {
    e.preventDefault()
    if (dragSrc.current === null || dragSrc.current === i) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mid  = rect.top + rect.height / 2
    document.querySelectorAll(`.${styles.dragOverTop}, .${styles.dragOverBottom}`)
      .forEach(el => el.classList.remove(styles.dragOverTop, styles.dragOverBottom))
    e.currentTarget.classList.add(e.clientY < mid ? styles.dragOverTop : styles.dragOverBottom)
  }, [])

  const onDragLeave = useCallback((e) => {
    e.currentTarget.classList.remove(styles.dragOverTop, styles.dragOverBottom)
  }, [])

  const onDrop = useCallback((e, destI) => {
    e.preventDefault()
    e.currentTarget.classList.remove(styles.dragOverTop, styles.dragOverBottom)
    const srcI = dragSrc.current
    if (srcI === null || srcI === destI) return
    const rect   = e.currentTarget.getBoundingClientRect()
    const before = e.clientY < rect.top + rect.height / 2
    setList(prev => {
      const next = [...prev]
      const [item] = next.splice(srcI, 1)
      const newDest = srcI < destI ? (before ? destI - 1 : destI) : (before ? destI : destI + 1)
      next.splice(Math.max(0, newDest), 0, item)
      return next
    })
    dragSrc.current = null
  }, [setList])

  return { onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }
}

// ══════════════════════════════════
//  Main component
// ══════════════════════════════════
export default function RecipeEdit() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { id }    = useParams()

  // Seed from navigation state (coming from step-2 modal)
  const seed      = location.state || {}
  const isNew     = id?.startsWith('recipe-') // temp id from Recipes.jsx

  const [loading,     setLoading]     = useState(!isNew)
  const [saveStatus,  setSaveStatus]  = useState(null)
  const [dbId,        setDbId]        = useState(isNew ? null : id)
  const [groups,      setGroups]      = useState([])
  const autosaveTimer = useRef(null)

  const [recipeName,  setRecipeName]  = useState(seed.name  || '')
  const [recipeGroup, setRecipeGroup] = useState(seed.group || '')
  const [yieldQty,    setYieldQty]    = useState('')
  const [yieldUnit,   setYieldUnit]   = useState('')
  const [ings,        setIngs]        = useState(() => parseIngredients(seed.ingredients || ''))
  const [steps,       setSteps]       = useState(() => parseDirections(seed.prep || ''))

  // New row state
  const [newIngAmount, setNewIngAmount] = useState('')
  const [newIngName,   setNewIngName]   = useState('')
  const [showNewIng,   setShowNewIng]   = useState(false)
  const [newStepText,  setNewStepText]  = useState('')
  const [showNewStep,  setShowNewStep]  = useState(false)

  const newIngAmountRef = useRef(null)
  const newIngNameRef   = useRef(null)
  const newStepRef      = useRef(null)

  const ingDrag  = useDragDrop(setIngs)
  const stepDrag = useDragDrop(setSteps)

  useEffect(() => {
    supabase.from('recipe_groups').select('id, name').order('name').then(({ data }) => {
      if (data) setGroups(data)
    })
  }, [])

  // ── Load existing recipe from Supabase ──
  useEffect(() => {
    if (isNew) return // fresh recipe — nothing to load yet
    const load = async () => {
      const { data, error } = await safeQuery(() =>
        supabase.from('recipes').select('*').eq('id', id).single()
      )
      if (error || !data) { setLoading(false); return }
      setRecipeName(data.name        || '')
      setRecipeGroup(data.group_name || '')
      setYieldQty(data.yield_qty     || '')
      setYieldUnit(data.yield_unit   || '')
      // Normalize ingredients: Meez uses {qty, unit} but editor uses {amount}
      const rawIngs = data.ingredients || []
      setIngs(rawIngs.map(ing => {
        if (ing.type === 'header') return ing
        if (ing.amount !== undefined) return ing  // already in editor format
        return {
          type:   ing.type || 'item',
          amount: [ing.qty, ing.unit].filter(Boolean).join(' '),
          name:   ing.name || '',
          note:   ing.note || '',
        }
      }))
      // Support both 'steps' (Meez) and 'directions' (manual)
      const rawSteps = data.steps || data.directions || []
      setSteps(rawSteps.map(s => {
        if (s.type) return s  // already in editor format
        if (s.is_header) return { type: 'header', label: s.text || '' }
        return { type: 'step', text: s.text || '' }
      }))
      setDbId(data.id)
      setLoading(false)
    }
    load()
  }, [id, isNew])

  // Focus new ingredient row
  useEffect(() => {
    if (showNewIng && newIngAmountRef.current) newIngAmountRef.current.focus()
  }, [showNewIng])

  // Focus new step row
  useEffect(() => {
    if (showNewStep && newStepRef.current) {
      newStepRef.current.focus()
      autoResize(newStepRef.current)
    }
  }, [showNewStep])

  // ── Save to Supabase ──
  const save = useCallback(async (opts = {}) => {
    setSaveStatus('saving')

    const payload = {
      name:        recipeName.trim() || 'Untitled Recipe',
      group_name:  recipeGroup.trim() || null,
      yield_qty:   yieldQty.trim()   || null,
      yield_unit:  yieldUnit.trim()  || null,
      ingredients: ings,
      directions:  steps,
      updated_at:  new Date().toISOString(),
    }

    let error, data, savedId

    if (dbId) {
      ;({ data, error } = await safeQuery(() =>
        supabase.from('recipes').update(payload).eq('id', dbId).select().single()
      ))
      savedId = dbId
    } else {
      ;({ data, error } = await safeQuery(() =>
        supabase.from('recipes').insert(payload).select().single()
      ))
      if (data?.id) {
        setDbId(data.id)
        savedId = data.id
        window.history.replaceState({}, '', `/recipes/${data.id}/edit`)
      }
    }

    if (error) {
      console.error('Save recipe error:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    } else {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    }

    if (opts.thenNavigate && savedId) navigate(`/recipes/${savedId}`)
    else if (opts.thenNavigate) navigate('/recipes')
  }, [recipeName, recipeGroup, yieldQty, yieldUnit, ings, steps, dbId, navigate])

  // ── Autosave — debounced 2s after any change ──
  const scheduleAutosave = useCallback(() => {
    clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => save(), 2000)
  }, [save])

  useEffect(() => { scheduleAutosave() }, [recipeName, recipeGroup, yieldQty, yieldUnit, ings, steps])

  useEffect(() => () => clearTimeout(autosaveTimer.current), [])

  // ── Ingredient actions ──
  const updateIng   = (i, field, val) => setIngs(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing))
  const deleteIng   = (i) => setIngs(prev => prev.filter((_, idx) => idx !== i))
  const toggleIngNote = (i) => setIngs(prev => prev.map((ing, idx) => idx === i ? { ...ing, _showNote: !ing._showNote } : ing))

  const addIngHeader = () => {
    setIngs(prev => [...prev, { type: 'header', label: '' }])
    setTimeout(() => {
      const headers = document.querySelectorAll(`.${styles.headerLabelInput}`)
      headers[headers.length - 1]?.focus()
    }, 30)
  }

  const commitNewIng = () => {
    if (!newIngName.trim()) { setShowNewIng(false); return }
    setIngs(prev => [...prev, { type: 'item', amount: newIngAmount.trim(), name: newIngName.trim(), note: '' }])
    setNewIngAmount('')
    setNewIngName('')
    setShowNewIng(true)
    setTimeout(() => newIngAmountRef.current?.focus(), 30)
  }

  const handleNewIngKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitNewIng() }
    if (e.key === 'Escape') { setShowNewIng(false); setNewIngAmount(''); setNewIngName('') }
    if (e.key === 'Tab' && !e.shiftKey && e.target === newIngAmountRef.current) {
      e.preventDefault(); newIngNameRef.current?.focus()
    }
  }

  // ── Step actions ──
  const updateStep  = (i, field, val) => setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  const deleteStep  = (i) => setSteps(prev => prev.filter((_, idx) => idx !== i))

  const addDirHeader = () => {
    setSteps(prev => [...prev, { type: 'header', label: '' }])
    setTimeout(() => {
      const headers = document.querySelectorAll(`.${styles.dirHeaderInput}`)
      headers[headers.length - 1]?.focus()
    }, 30)
  }

  const commitNewStep = () => {
    if (!newStepText.trim()) { setShowNewStep(false); return }
    setSteps(prev => [...prev, { type: 'step', text: newStepText.trim() }])
    setNewStepText('')
    setShowNewStep(true)
    setTimeout(() => { newStepRef.current?.focus(); autoResize(newStepRef.current) }, 30)
  }

  const handleNewStepKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitNewStep() }
    if (e.key === 'Escape') { setShowNewStep(false); setNewStepText('') }
  }

  // Renumber steps (skip headers)
  const stepNumbers = {}
  let n = 0
  steps.forEach((s, i) => { if (s.type === 'step') stepNumbers[i] = ++n })
  const totalSteps = n

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', fontSize: 14 }}>
      Loading recipe…
    </div>
  )

  return (
    <div className={styles.page}>
      {/* ── Topbar ── */}
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => navigate('/recipes')}>
          <BackIcon /> Recipes
        </button>
        <div className={styles.topbarRight}>
          {saveStatus === 'saving' && <span className={styles.savingLabel}>Saving…</span>}
          {saveStatus === 'saved'  && <span className={styles.savedLabel}>Saved</span>}
          {saveStatus === 'error'  && <span className={styles.errorLabel}>Save failed</span>}
          <button className={styles.btnDone} onClick={() => save({ thenNavigate: true })}>
            <CheckIcon /> Done
          </button>
          <button className={styles.btnOutline}>
            <ShareIcon /> Share
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={styles.content}>
        <input
          className={styles.recipeTitle}
          type="text"
          value={recipeName}
          onChange={e => setRecipeName(e.target.value)}
          placeholder="Recipe name…"
        />
        <div className={styles.groupSelectRow}>
          <FolderIcon />
          <select
            className={styles.groupSelect}
            value={recipeGroup}
            onChange={e => setRecipeGroup(e.target.value)}
          >
            <option value="">No group assigned</option>
            {groups.map(g => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.panels}>

          {/* ══ LEFT: Ingredients ══ */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div className={styles.panelLabel}>Ingredients</div>
              <div className={styles.yieldSublabel}>Total Yield</div>
              <div className={styles.yieldRow}>
                <div className={styles.yieldGroup}>
                  <div className={styles.yieldFieldLabel}>Qty</div>
                  <input
                    className={styles.yieldInput}
                    type="number"
                    value={yieldQty}
                    onChange={e => setYieldQty(e.target.value)}
                    placeholder="24"
                  />
                </div>
                <div className={styles.yieldGroup}>
                  <div className={styles.yieldFieldLabel}>Unit</div>
                  <input
                    className={`${styles.yieldInput} ${styles.yieldInputWide}`}
                    type="text"
                    value={yieldUnit}
                    onChange={e => setYieldUnit(e.target.value)}
                    placeholder="cupcakes"
                  />
                </div>
              </div>
            </div>

            <div className={styles.ingList}>
              {ings.map((ing, i) => ing.type === 'header' ? (
                <div
                  key={i}
                  className={`${styles.ingRow} ${styles.headerRow}`}
                  draggable
                  onDragStart={e => ingDrag.onDragStart(e, i)}
                  onDragEnd={ingDrag.onDragEnd}
                  onDragOver={e => ingDrag.onDragOver(e, i)}
                  onDragLeave={ingDrag.onDragLeave}
                  onDrop={e => ingDrag.onDrop(e, i)}
                >
                  <div className={styles.dragHandle}><DragIcon /></div>
                  <div className={styles.headerRowInner}>
                    <div className={styles.headerBadge}>HEADER</div>
                    <input
                      className={styles.headerLabelInput}
                      type="text"
                      value={ing.label}
                      onChange={e => updateIng(i, 'label', e.target.value)}
                      placeholder="Section name…"
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    />
                  </div>
                  <div className={styles.ingActions}>
                    <button className={`${styles.iconBtn} ${styles.del}`} onClick={() => deleteIng(i)}><TrashIcon /></button>
                  </div>
                </div>
              ) : (
                <div
                  key={i}
                  className={styles.ingRow}
                  draggable
                  onDragStart={e => ingDrag.onDragStart(e, i)}
                  onDragEnd={ingDrag.onDragEnd}
                  onDragOver={e => ingDrag.onDragOver(e, i)}
                  onDragLeave={ingDrag.onDragLeave}
                  onDrop={e => ingDrag.onDrop(e, i)}
                >
                  <div className={styles.dragHandle}><DragIcon /></div>
                  <input
                    className={styles.ingAmount}
                    type="text"
                    value={ing.amount}
                    onChange={e => updateIng(i, 'amount', e.target.value)}
                    placeholder="Amount"
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  />
                  <div className={styles.ingRight}>
                    <input
                      className={styles.ingName}
                      type="text"
                      value={ing.name}
                      onChange={e => updateIng(i, 'name', e.target.value)}
                      placeholder="Ingredient"
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    />
                    {(ing._showNote || ing.note) && (
                      <input
                        className={styles.ingNote}
                        type="text"
                        value={ing.note}
                        onChange={e => updateIng(i, 'note', e.target.value)}
                        placeholder="Add a note…"
                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                      />
                    )}
                  </div>
                  <div className={styles.ingActions}>
                    <button className={styles.iconBtn} onClick={() => toggleIngNote(i)} title="Add note"><NoteIcon /></button>
                    <button className={`${styles.iconBtn} ${styles.del}`} onClick={() => deleteIng(i)}><TrashIcon /></button>
                  </div>
                </div>
              ))}

              {!showNewIng ? (
                <div className={styles.ingGhost} onClick={() => setShowNewIng(true)}>
                  <div className={styles.ghostAmount}>Amount</div>
                  <div className={styles.ghostName}>Type ingredient…</div>
                </div>
              ) : (
                <div className={`${styles.ingRow} ${styles.newRow}`}>
                  <div style={{ width: 20, flexShrink: 0 }} />
                  <input
                    ref={newIngAmountRef}
                    className={styles.ingAmount}
                    type="text"
                    value={newIngAmount}
                    onChange={e => setNewIngAmount(e.target.value)}
                    placeholder="e.g. 2 cups"
                    onKeyDown={handleNewIngKey}
                  />
                  <div className={styles.ingRight}>
                    <input
                      ref={newIngNameRef}
                      className={styles.ingName}
                      type="text"
                      value={newIngName}
                      onChange={e => setNewIngName(e.target.value)}
                      placeholder="Ingredient name"
                      onKeyDown={handleNewIngKey}
                      onBlur={() => setTimeout(commitNewIng, 150)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={styles.panelFooter}>
              <button className={styles.linkBtn} onClick={addIngHeader}>
                <PlusIcon /> Add Header
              </button>
            </div>
          </div>

          {/* ══ RIGHT: Directions ══ */}
          <div className={styles.panel}>
            <div className={styles.dirTabRow}>
              <button className={`${styles.dirTab} ${styles.active}`}>
                <ListIcon /> Directions
              </button>
            </div>

            <div className={styles.coverArea}>
              <PhotoIcon />
              Add Cover Image
              <div className={styles.coverHint}>for best results use an image in landscape</div>
            </div>

            <div className={styles.dirSectionLabel}>
              Directions
              <span className={styles.stepBadge}>{totalSteps}</span>
            </div>

            <div className={styles.dirList}>
              {steps.map((s, i) => s.type === 'header' ? (
                <div
                  key={i}
                  className={`${styles.dirRow} ${styles.headerRow}`}
                  draggable
                  onDragStart={e => stepDrag.onDragStart(e, i)}
                  onDragEnd={stepDrag.onDragEnd}
                  onDragOver={e => stepDrag.onDragOver(e, i)}
                  onDragLeave={stepDrag.onDragLeave}
                  onDrop={e => stepDrag.onDrop(e, i)}
                >
                  <div className={styles.dragHandle}><DragIcon /></div>
                  <div className={`${styles.stepPill} ${styles.headerPill}`}>§</div>
                  <div className={styles.stepBody}>
                    <input
                      className={styles.dirHeaderInput}
                      type="text"
                      value={s.label}
                      onChange={e => updateStep(i, 'label', e.target.value)}
                      placeholder="Section name…"
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    />
                  </div>
                  <div className={styles.dirRowActions}>
                    <button className={`${styles.iconBtn} ${styles.del}`} onClick={() => deleteStep(i)}><TrashIcon /></button>
                  </div>
                  <div style={{ width: 72, flexShrink: 0 }} />
                </div>
              ) : (
                <div
                  key={i}
                  className={styles.dirRow}
                  draggable
                  onDragStart={e => stepDrag.onDragStart(e, i)}
                  onDragEnd={stepDrag.onDragEnd}
                  onDragOver={e => stepDrag.onDragOver(e, i)}
                  onDragLeave={stepDrag.onDragLeave}
                  onDrop={e => stepDrag.onDrop(e, i)}
                >
                  <div className={styles.dragHandle}><DragIcon /></div>
                  <div className={styles.stepPill}>{stepNumbers[i]}</div>
                  <div className={styles.stepBody}>
                    <textarea
                      className={styles.stepTextarea}
                      value={s.text}
                      onChange={e => { updateStep(i, 'text', e.target.value); autoResize(e.target) }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur() } }}
                      onFocus={e => autoResize(e.target)}
                      rows={1}
                      ref={el => el && autoResize(el)}
                    />
                  </div>
                  <div className={styles.dirRowActions}>
                    <button className={`${styles.iconBtn} ${styles.del}`} onClick={() => deleteStep(i)}><TrashIcon /></button>
                  </div>
                  <div className={styles.mediaSlot}>
                    <PhotoIcon />
                    <span>Add photo / video</span>
                  </div>
                </div>
              ))}

              {!showNewStep ? (
                <div className={styles.dirGhost} onClick={() => setShowNewStep(true)}>
                  <div className={styles.ghostPill}>{totalSteps + 1}</div>
                  <div className={styles.ghostText}>Add a direction…</div>
                </div>
              ) : (
                <div className={`${styles.dirRow} ${styles.newRow}`}>
                  <div style={{ width: 20, flexShrink: 0 }} />
                  <div className={styles.stepPill}>{totalSteps + 1}</div>
                  <div className={styles.stepBody}>
                    <textarea
                      ref={newStepRef}
                      className={styles.stepTextarea}
                      value={newStepText}
                      onChange={e => { setNewStepText(e.target.value); autoResize(e.target) }}
                      onKeyDown={handleNewStepKey}
                      onBlur={() => setTimeout(commitNewStep, 150)}
                      placeholder="Type direction, press Enter to save…"
                      rows={1}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={styles.panelFooter}>
              <button className={styles.linkBtn} onClick={addDirHeader}>
                <PlusIcon /> Add Header
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
