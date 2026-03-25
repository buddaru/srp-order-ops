import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, safeQuery } from '../lib/supabase'
import styles from './Recipes.module.css'

const SAMPLE_GROUPS = ['Cupcakes', 'Cakes', 'Breads', 'Cookies', 'Frostings & Fillings']

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)
const ChevronIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
)
const RecipeFileIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
  </svg>
)
const FolderIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)
const GridIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
)
const ListIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)

function NewRecipeStep1({ onClose, onNext }) {
  const [name, setName]         = useState('')
  const [group, setGroup]       = useState('')
  const [nameErr, setNameErr]   = useState(false)
  const [selected, setSelected] = useState('')
  const inputRef                = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const filtered = SAMPLE_GROUPS.filter(g => !group.trim() || g.toLowerCase().includes(group.toLowerCase()))
  const handleNext = () => {
    if (!name.trim()) { setNameErr(true); inputRef.current?.focus(); return }
    onNext({ name: name.trim(), group: selected || group.trim() })
  }
  const selectGroup = (g) => { setSelected(g); setGroup(g) }
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.stepDots}>
          <div className={`${styles.dot} ${styles.dotActive}`} />
          <div className={styles.dot} />
        </div>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>New Recipe</div>
            <div className={styles.modalSub}>Give your recipe a name and optionally assign it to a group.</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><CloseIcon /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Recipe Name <span className={styles.req}>*</span></label>
            <input ref={inputRef} type="text" value={name} onChange={e => { setName(e.target.value); setNameErr(false) }} placeholder="e.g. Blue Velvet Cupcake" className={nameErr ? 'invalid' : ''} onKeyDown={e => e.key === 'Enter' && handleNext()} />
            {nameErr && <div className={styles.errMsg}>Recipe name is required.</div>}
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Recipe Group <span className={styles.optional}>(optional)</span></label>
            <input type="text" value={group} onChange={e => { setGroup(e.target.value); setSelected('') }} placeholder="Search or create a group…" />
            <div className={styles.pills}>
              {filtered.map(g => (
                <button key={g} type="button" className={`${styles.pill} ${selected === g ? styles.pillSelected : ''}`} onClick={() => selectGroup(g)}>{g}</button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={`btn btn-primary ${styles.saveBtn}`} onClick={handleNext}>Next →</button>
        </div>
      </div>
    </div>
  )
}

function NewRecipeStep2({ recipeData, onClose, onBack, onSave }) {
  const [ingredients, setIngredients] = useState('')
  const [prep, setPrep]               = useState('')
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${styles.modalWide}`}>
        <div className={styles.stepDots}>
          <div className={`${styles.dot} ${styles.dotDone}`} />
          <div className={`${styles.dot} ${styles.dotActive}`} />
        </div>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Add Ingredients & Prep Method</div>
            <div className={styles.modalSub}>Type or copy/paste ingredients and/or prep steps from any word doc, spreadsheet, PDF, or website.</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><CloseIcon /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.twoCol}>
            <div>
              <label className={styles.textareaLabel}>Ingredients</label>
              <textarea className={styles.recipeTextarea} value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder={"Dry Mix:\n500g flour\n1/2c semolina\nsalt to taste\n\nWet:\n5 cloves Garlic\n3 egg yolks\nOlive Oil (room temp)"} />
              <div className={styles.textareaHint}>Add notes to ingredients by putting them in <strong>(note)</strong><br />Add headers use a colon : eg <strong>To Garnish:</strong></div>
            </div>
            <div>
              <label className={styles.textareaLabel}>Prep Method</label>
              <textarea className={styles.recipeTextarea} value={prep} onChange={e => setPrep(e.target.value)} placeholder={"Dry Mix:\nHeat oven to 350f\nCombine dry ingredients in medium bowl\n\nGarnish:\nAdd chopped chocolate chips as garnish"} />
              <div className={styles.textareaHint}>Add notes to prep method by putting them in <strong>(note)</strong><br />Add headers use a colon : eg <strong>To Garnish:</strong></div>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.skipBtn} onClick={onClose}>Skip</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.cancelBtn} onClick={onBack}>← Back</button>
            <button className={`btn btn-primary ${styles.saveBtn}`} onClick={() => onSave({ ...recipeData, ingredients, prep })}>Add Recipe</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewGroupModal({ onClose, onCreate }) {
  const [name, setName]   = useState('')
  const [err, setErr]     = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const handleCreate = async () => {
    if (!name.trim()) { setErr(true); inputRef.current?.focus(); return }
    setSaving(true)
    const { data, error } = await supabase.from('recipe_groups').insert({ name: name.trim() }).select().single()
    setSaving(false)
    if (!error && data) onCreate(data)
  }
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>New Recipe Group</div>
            <div className={styles.modalSub}>Give your recipe group a name to get started.</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><CloseIcon /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Group Name <span className={styles.req}>*</span></label>
            <input ref={inputRef} type="text" value={name} onChange={e => { setName(e.target.value); setErr(false) }} placeholder="e.g. Cakes, Cupcakes, Frostings…" className={err ? 'invalid' : ''} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            {err && <div className={styles.errMsg}>Group name is required.</div>}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={`btn btn-primary ${styles.saveBtn}`} onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create Recipe Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Recipes() {
  const navigate                = useNavigate()
  const [tab, setTab]           = useState('recipes')
  const [viewMode, setViewMode] = useState('list')
  const [sortBy, setSortBy]     = useState('last_viewed')
  const [query, setQuery]       = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [step, setStep]         = useState(null)
  const [recipeData, setRecipeData] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [recipes, setRecipes]   = useState([])
  const [groups, setGroups]     = useState([])
  const [loadingRecipes, setLoadingRecipes] = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [syncMsg, setSyncMsg]   = useState(null)

  const dropRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: recs }, { data: grps }] = await Promise.all([
        safeQuery(() => supabase.from('recipes').select('id, name, group_name, yield_qty, yield_unit, ingredients, last_viewed').order('name')),
        safeQuery(() => supabase.from('recipe_groups').select('id, name, cover_image').order('name')),
      ])
      if (recs) {
        setRecipes(recs.map(r => ({
          id:              r.id,
          name:            r.name,
          group:           r.group_name || 'Uncategorized',
          ingredientCount: Array.isArray(r.ingredients) ? r.ingredients.filter(i => i.type === 'item').length : 0,
          yield:           r.yield_qty ? `${r.yield_qty}${r.yield_unit ? ' ' + r.yield_unit : ''}` : '—',
          lastViewed:      r.last_viewed || null,
        })))
      }
      if (grps) setGroups(grps)
      setLoadingRecipes(false)
    }
    load()
  }, [])

  useEffect(() => {
    const handler = e => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleMeezSync = async () => {
    setSyncing(true)
    setSyncMsg('Starting sync…')

    const runChunk = async () => {
      try {
        const res  = await fetch('/api/sync-meez', { method: 'POST' })
        const data = await res.json()

        if (!res.ok) {
          setSyncMsg(data.error || 'Sync failed')
          setSyncing(false)
          return
        }

        setSyncMsg(data.message)

        if (data.hasMore) {
          // Small pause so React can re-render the progress message, then continue
          setTimeout(runChunk, 200)
        } else {
          // Done — reload recipes and groups
          const [{ data: rows }, { data: grps }] = await Promise.all([
            supabase.from('recipes').select('id, name, group_name, yield_qty, yield_unit, ingredients, last_viewed').order('name'),
            supabase.from('recipe_groups').select('id, name, cover_image').order('name'),
          ])
          if (rows) {
            setRecipes(rows.map(r => ({
              id:              r.id,
              name:            r.name,
              group:           r.group_name || 'Uncategorized',
              ingredientCount: Array.isArray(r.ingredients) ? r.ingredients.filter(i => i.type === 'item').length : 0,
              yield:           r.yield_qty ? `${r.yield_qty}${r.yield_unit ? ' ' + r.yield_unit : ''}` : '—',
              lastViewed:      r.last_viewed || null,
            })))
          }
          if (grps) setGroups(grps)
          setSyncing(false)
          setTimeout(() => setSyncMsg(null), 6000)
        }
      } catch {
        setSyncMsg('Sync failed — check your connection.')
        setSyncing(false)
      }
    }

    runChunk()
  }

  const filteredRecipes = recipes
    .filter(r => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return r.name.toLowerCase().includes(q) || r.group.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'az') return a.name.localeCompare(b.name)
      if (sortBy === 'za') return b.name.localeCompare(a.name)
      // last_viewed — most recent first, nulls last
      if (sortBy === 'last_viewed') {
        if (!a.lastViewed && !b.lastViewed) return 0
        if (!a.lastViewed) return 1
        if (!b.lastViewed) return -1
        return new Date(b.lastViewed) - new Date(a.lastViewed)
      }
      return 0
    })

  const filteredGroups = groups.filter(g => {
    if (!query.trim()) return true
    return g.name.toLowerCase().includes(query.toLowerCase())
  })

  const handleSaveRecipe = (data) => {
    const newId = `recipe-${Date.now()}`
    setStep(null)
    setRecipeData(null)
    navigate(`/recipes/${newId}/edit`, { state: { name: data.name, group: data.group || '', ingredients: data.ingredients || '', prep: data.prep || '' } })
  }

  const handleGroupCreated = (group) => {
    setGroups(prev => [...prev, group])
    setShowGroupModal(false)
    navigate(`/recipe-groups/${group.id}`)
  }

  const closeModal = () => { setStep(null); setRecipeData(null) }

  const ViewToggle = () => (
    <div className={styles.viewToggle}>
      <button className={`${styles.vtBtn} ${viewMode === 'grid' ? styles.vtActive : ''}`} onClick={() => setViewMode('grid')}><GridIcon /></button>
      <button className={`${styles.vtBtn} ${viewMode === 'list' ? styles.vtActive : ''}`} onClick={() => setViewMode('list')}><ListIcon /></button>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Recipes</h1>
          <p className={styles.pageSub}>Manage your recipe library, groups, and supporting docs.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className={styles.syncBtn} onClick={handleMeezSync} disabled={syncing}>
            {syncing ? '⟳ Syncing…' : '⟳ Sync from Meez'}
          </button>
          <div className={styles.dropWrap} ref={dropRef}>
            <button className={`btn btn-primary ${styles.newBtn}`} onClick={() => setDropOpen(o => !o)}>
              <PlusIcon /> New <ChevronIcon />
            </button>
            {dropOpen && (
              <div className={styles.dropdown}>
                <button className={styles.dropItem} onClick={() => { setDropOpen(false); setStep(1) }}>
                  <RecipeFileIcon /> New Recipe
                </button>
                <button className={styles.dropItem} onClick={() => { setDropOpen(false); setShowGroupModal(true) }}>
                  <FolderIcon /> New Recipe Group
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {syncMsg && <div className={styles.syncMsg}>{syncMsg}</div>}

      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}><SearchIcon /></span>
        <input type="text" className={`${styles.searchInput} searchOverride`} placeholder="Search recipes, ingredients, groups…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className={styles.tabRow}>
        <div className={styles.tabs}>
          {[{ id: 'recipes', label: 'Recipes' }, { id: 'groups', label: 'Recipe Groups' }, { id: 'docs', label: 'Docs' }].map(t => (
            <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab === 'recipes' && (
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="last_viewed">Last Viewed</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
            </select>
          )}
          <ViewToggle />
        </div>
      </div>

      {/* ── Recipes tab ── */}
      {tab === 'recipes' && (
        loadingRecipes ? (
          <div className={styles.empty}><div className={styles.emptySub}>Loading recipes…</div></div>
        ) : filteredRecipes.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🧁</div>
            <div className={styles.emptyTitle}>{query ? 'No recipes found' : 'No recipes yet'}</div>
            <div className={styles.emptySub}>{query ? 'Try a different search.' : 'Click + New to add your first recipe.'}</div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles.recipeGrid}>
            {filteredRecipes.map(r => (
              <div key={r.id} className={styles.recipeCard} onClick={() => navigate(`/recipes/${r.id}`)}>
                <div className={styles.cardThumb}>🧁</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{r.name}</div>
                  <div className={styles.cardMeta}>{r.ingredientCount} ingredients · Yield: {r.yield}</div>
                  <div className={styles.cardTag}>{r.group}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.listView}>
            {filteredRecipes.map(r => (
              <div key={r.id} className={styles.listRow} onClick={() => navigate(`/recipes/${r.id}`)}>
                <div className={styles.listThumb}>🧁</div>
                <div className={styles.listInfo}>
                  <div className={styles.listName}>{r.name}</div>
                  <div className={styles.listMeta}>{r.ingredientCount} ingredients · Yield: {r.yield}</div>
                </div>
                <div className={styles.listTag}>{r.group}</div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Groups tab ── */}
      {tab === 'groups' && (
        filteredGroups.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📁</div>
            <div className={styles.emptyTitle}>{query ? 'No groups found' : 'No recipe groups yet'}</div>
            <div className={styles.emptySub}>Click + New → New Recipe Group to create one.</div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles.groupGrid}>
            {filteredGroups.map(g => (
              <div key={g.id} className={styles.groupCard} onClick={() => navigate(`/recipe-groups/${g.id}`)}>
                {g.cover_image
                  ? <div className={styles.groupCover} style={{ backgroundImage: `url(${g.cover_image})` }} />
                  : <div className={styles.groupEmoji}>📁</div>
                }
                <div className={styles.groupName}>{g.name}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.listView}>
            {filteredGroups.map(g => (
              <div key={g.id} className={styles.listRow} onClick={() => navigate(`/recipe-groups/${g.id}`)}>
                <div className={styles.listThumb}>
                  {g.cover_image
                    ? <div className={styles.listCoverThumb} style={{ backgroundImage: `url(${g.cover_image})` }} />
                    : '📁'
                  }
                </div>
                <div className={styles.listInfo}>
                  <div className={styles.listName}>{g.name}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Docs tab ── */}
      {tab === 'docs' && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📄</div>
          <div className={styles.emptyTitle}>No docs yet</div>
          <div className={styles.emptySub}>Docs coming soon.</div>
        </div>
      )}

      {step === 1 && <NewRecipeStep1 onClose={closeModal} onNext={data => { setRecipeData(data); setStep(2) }} />}
      {step === 2 && <NewRecipeStep2 recipeData={recipeData} onClose={closeModal} onBack={() => setStep(1)} onSave={handleSaveRecipe} />}
      {showGroupModal && <NewGroupModal onClose={() => setShowGroupModal(false)} onCreate={handleGroupCreated} />}
    </div>
  )
}
