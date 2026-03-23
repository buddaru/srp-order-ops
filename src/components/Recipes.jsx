import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, safeQuery } from '../lib/supabase'
import styles from './Recipes.module.css'

const SAMPLE_GROUPS = ['Cupcakes', 'Cakes', 'Breads', 'Cookies', 'Frostings & Fillings']

const SAMPLE_RECIPES = [
  { id: 1, name: 'Red Velvet Cupcake',      group: 'Cupcakes',             ingredientCount: 12, yield: '24 cupcakes', emoji: '🎂' },
  { id: 2, name: 'Peach Cobbler Cupcake',   group: 'Cupcakes',             ingredientCount: 9,  yield: '24 cupcakes', emoji: '🍑' },
  { id: 3, name: 'Banana Pudding Cupcake',  group: 'Cupcakes',             ingredientCount: 11, yield: '24 cupcakes', emoji: '🍌' },
  { id: 4, name: 'Chocolate Cupcake',       group: 'Cupcakes',             ingredientCount: 10, yield: '24 cupcakes', emoji: '🍫' },
  { id: 5, name: 'Carrot Cupcake',          group: 'Cupcakes',             ingredientCount: 14, yield: '24 cupcakes', emoji: '🥕' },
  { id: 6, name: 'Vanilla Cupcake',         group: 'Cupcakes',             ingredientCount: 8,  yield: '24 cupcakes', emoji: '🍰' },
  { id: 7, name: 'Blue Velvet Cupcake',     group: 'Cupcakes',             ingredientCount: 12, yield: '24 cupcakes', emoji: '🫐' },
  { id: 8, name: 'Classic Pound Cake',      group: 'Cakes',                ingredientCount: 7,  yield: '1 loaf',      emoji: '🎂' },
  { id: 9, name: 'Cream Cheese Frosting',   group: 'Frostings & Fillings', ingredientCount: 5,  yield: '3 cups',      emoji: '🍮' },
]

const SAMPLE_GROUPS_DETAIL = [
  { name: 'Cupcakes',             count: 7, emoji: '🧁' },
  { name: 'Cakes',                count: 3, emoji: '🎂' },
  { name: 'Breads',               count: 2, emoji: '🍞' },
  { name: 'Cookies',              count: 5, emoji: '🍪' },
  { name: 'Frostings & Fillings', count: 4, emoji: '🍮' },
]

const SAMPLE_DOCS = [
  { name: 'SRP Wholesale Pricing Sheet', updated: 'Mar 10, 2026', type: 'PDF',  emoji: '📄' },
  { name: 'Allergen Reference Guide',    updated: 'Feb 22, 2026', type: 'PDF',  emoji: '📋' },
  { name: 'Cupcake Order Form',          updated: 'Jan 15, 2026', type: 'XLSX', emoji: '📊' },
]

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

function NewRecipeStep1({ onClose, onNext }) {
  const [name, setName]         = useState('')
  const [group, setGroup]       = useState('')
  const [nameErr, setNameErr]   = useState(false)
  const [selected, setSelected] = useState('')
  const inputRef                = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = SAMPLE_GROUPS.filter(g =>
    !group.trim() || g.toLowerCase().includes(group.toLowerCase())
  )

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
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setNameErr(false) }}
              placeholder="e.g. Blue Velvet Cupcake"
              className={nameErr ? 'invalid' : ''}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
            />
            {nameErr && <div className={styles.errMsg}>Recipe name is required.</div>}
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Recipe Group <span className={styles.optional}>(optional)</span>
            </label>
            <input
              type="text"
              value={group}
              onChange={e => { setGroup(e.target.value); setSelected('') }}
              placeholder="Search or create a group…"
            />
            <div className={styles.pills}>
              {filtered.map(g => (
                <button
                  key={g}
                  type="button"
                  className={`${styles.pill} ${selected === g ? styles.pillSelected : ''}`}
                  onClick={() => selectGroup(g)}
                >
                  {g}
                </button>
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
              <textarea
                className={styles.recipeTextarea}
                value={ingredients}
                onChange={e => setIngredients(e.target.value)}
                placeholder={"Dry Mix:\n500g flour\n1/2c semolina\nsalt to taste\n\nWet:\n5 cloves Garlic\n3 egg yolks\nOlive Oil (room temp)"}
              />
              <div className={styles.textareaHint}>
                Add notes to ingredients by putting them in <strong>(note)</strong><br />
                Add headers use a colon : eg <strong>To Garnish:</strong>
              </div>
            </div>
            <div>
              <label className={styles.textareaLabel}>Prep Method</label>
              <textarea
                className={styles.recipeTextarea}
                value={prep}
                onChange={e => setPrep(e.target.value)}
                placeholder={"Dry Mix:\nHeat oven to 350f\nCombine dry ingredients in medium bowl\n\nGarnish:\nAdd chopped chocolate chips as garnish"}
              />
              <div className={styles.textareaHint}>
                Add notes to prep method by putting them in <strong>(note)</strong><br />
                Add headers use a colon : eg <strong>To Garnish:</strong>
              </div>
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

export default function Recipes() {
  const navigate                = useNavigate()
  const [tab, setTab]           = useState('recipes')
  const [query, setQuery]       = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [step, setStep]         = useState(null)
  const [recipeData, setRecipeData] = useState(null)
  const [recipes, setRecipes]   = useState([])
  const [loadingRecipes, setLoadingRecipes] = useState(true)
  const dropRef                 = useRef(null)

  // Load recipes from Supabase
  useEffect(() => {
    const load = async () => {
      const { data, error } = await safeQuery(() =>
        supabase.from('recipes').select('id, name, group_name, yield_qty, yield_unit, ingredients').order('created_at', { ascending: false })
      )
      if (data) {
        setRecipes(data.map(r => ({
          id:              r.id,
          name:            r.name,
          group:           r.group_name || 'Uncategorized',
          ingredientCount: Array.isArray(r.ingredients) ? r.ingredients.filter(i => i.type === 'item').length : 0,
          yield:           r.yield_qty ? `${r.yield_qty}${r.yield_unit ? ' ' + r.yield_unit : ''}` : '—',
          emoji:           '🧁',
        })))
      }
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

  const filteredRecipes = recipes.filter(r => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return r.name.toLowerCase().includes(q) || r.group.toLowerCase().includes(q)
  })

  const handleSaveRecipe = (data) => {
    const newId = `recipe-${Date.now()}`
    setStep(null)
    setRecipeData(null)
    navigate(`/recipes/${newId}`, {
      state: {
        name:        data.name,
        group:       data.group || '',
        ingredients: data.ingredients || '',
        prep:        data.prep || '',
      }
    })
  }

  const closeModal = () => { setStep(null); setRecipeData(null) }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Recipes</h1>
          <p className={styles.pageSub}>Manage your recipe library, groups, and supporting docs.</p>
        </div>
        <div className={styles.dropWrap} ref={dropRef}>
          <button className={`btn btn-primary ${styles.newBtn}`} onClick={() => setDropOpen(o => !o)}>
            <PlusIcon /> New <ChevronIcon />
          </button>
          {dropOpen && (
            <div className={styles.dropdown}>
              <button className={styles.dropItem} onClick={() => { setDropOpen(false); setStep(1) }}>
                <RecipeFileIcon /> New Recipe
              </button>
              <button className={styles.dropItem} onClick={() => setDropOpen(false)}>
                <FolderIcon /> New Recipe Group
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}><SearchIcon /></span>
        <input
          type="text"
          className={`${styles.searchInput} searchOverride`}
          placeholder="Search recipes, ingredients, groups…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.tabs}>
        {[{ id: 'recipes', label: 'Recipes' }, { id: 'groups', label: 'Recipe Groups' }, { id: 'docs', label: 'Docs' }].map(t => (
          <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'recipes' && (
        loadingRecipes ? (
          <div className={styles.empty}>
            <div className={styles.emptySub}>Loading recipes…</div>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🧁</div>
            <div className={styles.emptyTitle}>{query ? 'No recipes found' : 'No recipes yet'}</div>
            <div className={styles.emptySub}>{query ? 'Try a different search.' : 'Click + New to add your first recipe.'}</div>
          </div>
        ) : (
          <div className={styles.recipeGrid}>
            {filteredRecipes.map(r => (
              <div key={r.id} className={styles.recipeCard} onClick={() => navigate(`/recipes/${r.id}`)}>
                <div className={styles.cardThumb}>{r.emoji}</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{r.name}</div>
                  <div className={styles.cardMeta}>{r.ingredientCount} ingredients · Yield: {r.yield}</div>
                  <div className={styles.cardTag}>{r.group}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'groups' && (
        <div className={styles.groupGrid}>
          {SAMPLE_GROUPS_DETAIL.map(g => (
            <div key={g.name} className={styles.groupCard}>
              <div className={styles.groupEmoji}>{g.emoji}</div>
              <div className={styles.groupName}>{g.name}</div>
              <div className={styles.groupCount}>{g.count} recipes</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'docs' && (
        <div className={styles.docsList}>
          {SAMPLE_DOCS.map(d => (
            <div key={d.name} className={styles.docRow}>
              <div className={styles.docEmoji}>{d.emoji}</div>
              <div>
                <div className={styles.docName}>{d.name}</div>
                <div className={styles.docMeta}>Updated {d.updated} · {d.type}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <NewRecipeStep1
          onClose={closeModal}
          onNext={data => { setRecipeData(data); setStep(2) }}
        />
      )}
      {step === 2 && (
        <NewRecipeStep2
          recipeData={recipeData}
          onClose={closeModal}
          onBack={() => setStep(1)}
          onSave={handleSaveRecipe}
        />
      )}
    </div>
  )
}
