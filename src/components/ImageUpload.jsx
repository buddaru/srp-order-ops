import styles from './ImageUpload.module.css'

export default function ImageUpload({ value, onChange }) {
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onChange(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleClick = () => {
    if (!value) document.getElementById('img-file-input').click()
  }

  return (
    <div
      className={`${styles.zone} ${value ? styles.hasImage : ''}`}
      onClick={handleClick}
    >
      <input
        id="img-file-input"
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      {value ? (
        <>
          <img src={value} alt="Order" className={styles.preview} />
          <button
            type="button"
            className={styles.removeBtn}
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
          >×</button>
        </>
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.icon}>🖼️</div>
          <div className={styles.text}>
            Click to attach a photo<br />
            <strong>JPG, PNG, WEBP</strong>
          </div>
        </div>
      )}
    </div>
  )
}
