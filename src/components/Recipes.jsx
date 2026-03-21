import styles from './Recipes.module.css'

export default function Recipes() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.icon}>🧁</div>
        <h1 className={styles.title}>Recipes</h1>
        <p className={styles.sub}>Recipe management is coming soon. You'll be able to store, organize, and share your bakery recipes right here.</p>
        <div className={styles.pill}>Coming Soon</div>
      </div>
    </div>
  )
}
