import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, safeQuery } from '../lib/supabase'
import styles from './RecipeGroupPage.module.css'

const BackIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
const SearchIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
const PlusIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const CheckIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
const PhotoIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
const TrashIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const EditIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>

export default function RecipeGroupPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const fileRef = useRef(null)

  const [group, setGroup] = useState(null)
  const [groupRecipes, setGroupRecipes] = useState([])
  const [allRecipes, setAllRecipes] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [coverPreview, setCoverPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: g }, { data: recipes }] = await Promise.all([
        safeQuery(() => supabase.from('recipe_groups').select('*').eq('id', id).single()),
        safeQuery(() => supabase.from('recipes').select('id, name, group_name, yield_qty, yield_unit').order('name')),
      ])
      if (g) {
        setGroup(g)
        setCoverPreview(g.cover_image || null)
      }
      if (recipes) {
        setAllRecipes(recipes)
        // load recipes belonging to this group
        const { data: members } = await safeQuery(() =>
          supabase.from('recipe_group_members').select('recipe_id').eq('group_id', id)
        )
        const memberIds = new Set((members || []).map(m => m.recipe_id))
        setGroupRecipes(recipes.filter(r => memberIds.has(r.id)))
      }
      setLoading(false)
    }
    load()
  }, [id])

  // Enter edit mode automatically if just created (no recipes yet)
  useEffect(() => {
    if (!loading && group && groupRecipes.length === 0) setEditMode(true)
  }, [loading, group, groupRecipes.length])

  const addRecipe = async (recipe) => {
    if (groupRecipes.find(r => r.id === recipe.id)) return
    setGroupRecipes(prev => [...prev, recipe])
    await supabase.from('recipe_group_members').insert({ group_id: id, recipe_id: recipe.id })
  }

  const removeRecipe = async (recipeId) => {
    setGroupRecipes(prev => prev.filter(r => r.id !== recipeId))
    await supabase.from('recipe_group_members').delete().eq('group_id', id).eq('recipe_id', recipeId)
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result
      setCoverPreview(dataUrl)
      setSaving(true)
      await supabase.from('recipe_groups').update({ cover_image: dataUrl }).eq('id', id)
      setSaving(false)
    }
    reader.readAsDataURL(file)
  }

  const handleDone = () => setEditMode(false)

  const filteredSearch = allRecipes.filter(r => {
    if (!searchQuery.trim()) return true
    return r.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const memberIds = new Set(groupRecipes.map(r => r.id))

  if (loading) return <div className={styles.loading}>Loading…</div>
  if (!group) return <div className={styles.loading}>Group not found.</div>

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => navigate('/recipes')}>
          <BackIcon /> Recipes
        </button>
        <div className={styles.topbarRight}>
          {saving && <span className={styles.savingLabel}>Saving…</span>}
          {!editMode ? (
            <button className={styles.btnOutline} onClick={() => setEditMode(true)}>
              <EditIcon /> Edit Group
            </button>
          ) : (
            <button className={styles.btnDone} onClick={handleDone}>
              <CheckIcon /> Done
            </button>
          )}
        </div>
      </div>

      {/* Cover image */}
      <div
        className={styles.cover}
        onClick={() => editMode && fileRef.current?.click()}
        style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : {}}
      >
        {!coverPreview && (
          <div className={styles.coverEmpty}>
            <PhotoIcon />
            {editMode && <span>Click to add cover image</span>}
          </div>
        )}
        {editMode && coverPreview && (
          <div className={styles.coverOverlay}>
            <PhotoIcon /> Change cover
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
      </div>

      {/* Group name */}
      <div className={styles.groupHeader}>
        <h1 className={styles.groupName}>{group.name}</h1>
        <span className={styles.groupCount}>{groupRecipes.length} recipe{groupRecipes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Edit mode: search + add */}
      {editMode && (
        <div className={styles.editSection}>
          <div className={styles.editLabel}>Add recipes to this group</div>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}><SearchIcon /></span>
            <input
              className={styles.searchInput}
              placeholder="Search recipes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.searchResults}>
            {filteredSearch.length === 0 ? (
              <div className={styles.noResults}>No recipes found</div>
            ) : filteredSearch.map(r => {
              const inGroup = memberIds.has(r.id)
              return (
                <div key={r.id} className={`${styles.searchRow} ${inGroup ? styles.searchRowAdded : ''}`}>
                  <div className={styles.searchRowName}>{r.name}</div>
                  {r.group_name && <div className={styles.searchRowGroup}>{r.group_name}</div>}
                  <button
                    className={inGroup ? styles.addedBtn : styles.addBtn}
                    onClick={() => inGroup ? removeRecipe(r.id) : addRecipe(r)}
                  >
                    {inGroup ? '✓ Added' : <><PlusIcon /> Add</>}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recipe list */}
      <div className={styles.recipeList}>
        {groupRecipes.length === 0 && !editMode ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🧁</div>
            <div className={styles.emptyTitle}>No recipes yet</div>
            <div className={styles.emptySub}>Click Edit Group to add recipes.</div>
          </div>
        ) : groupRecipes.map(r => (
          <div key={r.id} className={styles.recipeRow} onClick={() => !editMode && navigate(`/recipes/${r.id}`)}>
            <div className={styles.recipeThumb}>🧁</div>
            <div className={styles.recipeInfo}>
              <div className={styles.recipeName}>{r.name}</div>
              {r.yield_qty && <div className={styles.recipeMeta}>Yield: {r.yield_qty}{r.yield_unit ? ' ' + r.yield_unit : ''}</div>}
            </div>
            {editMode && (
              <button className={styles.removeBtn} onClick={(e) => { e.stopPropagation(); removeRecipe(r.id) }}>
                <TrashIcon />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
