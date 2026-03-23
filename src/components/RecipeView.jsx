import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, safeQuery } from '../lib/supabase'
import styles from './RecipeView.module.css'

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
)
const ShareIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
)
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
)
const FolderIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
)
const YieldIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
)
const PhotoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
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

export default function RecipeView() {
  const navigate    = useNavigate()
  const { id }      = useParams()
  const [loading,   setLoading]   = useState(true)
  const [recipe,    setRecipe]    = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await safeQuery(() =>
        supabase.from('recipes').select('*').eq('id', id).single()
      )
      if (data) setRecipe(data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className={styles.loadingState}>Loading recipe…</div>
  )

  if (!recipe) return (
    <div className={styles.loadingState}>Recipe not found.</div>
  )

  const ings  = recipe.ingredients || []
  const steps = recipe.directions  || []

  // Renumber steps only (skip headers)
  const stepNums = {}
  let n = 0
  steps.forEach((s, i) => { if (s.type === 'step') stepNums[i] = ++n })
  const totalSteps = n

  return (
    <div className={styles.page}>
      {/* ── Topbar ── */}
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => navigate('/recipes')}>
          <BackIcon /> Recipes
        </button>
        <div className={styles.topbarRight}>
          <button className={styles.btnOutline}>
            <ShareIcon /> Share
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={styles.content}>

        {/* Recipe header */}
        <div className={styles.recipeHeader}>
          <h1 className={styles.recipeName}>{recipe.name}</h1>
          <div className={styles.recipeMeta}>
            {recipe.group_name && (
              <span className={styles.tag}>
                <FolderIcon /> {recipe.group_name}
              </span>
            )}
            {(recipe.yield_qty || recipe.yield_unit) && (
              <span className={styles.yieldTag}>
                <YieldIcon /> Yield: {recipe.yield_qty}{recipe.yield_unit ? ' ' + recipe.yield_unit : ''}
              </span>
            )}
          </div>
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
                  <div className={styles.ingAmount}>{ing.amount}</div>
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
              <ListIcon /> Directions
              {totalSteps > 0 && <span className={styles.stepBadge}>{totalSteps}</span>}
            </div>

            {/* Cover image */}
            {recipe.cover_image ? (
              <img src={recipe.cover_image} alt="Cover" className={styles.coverImg} />
            ) : (
              <div className={styles.coverEmpty}>
                <PhotoIcon />
                No cover image
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
                  {s.media ? (
                    <img src={s.media} alt={`Step ${stepNums[i]}`} className={styles.stepImg} />
                  ) : (
                    <div className={styles.mediaSlot}>
                      <PhotoIcon />
                      <span>Add photo / video</span>
                    </div>
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
