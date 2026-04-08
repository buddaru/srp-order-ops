export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="pageHeader">
      <div>
        <div className="pageTitle">{title}</div>
        {subtitle && <div className="pageSub">{subtitle}</div>}
      </div>
      {children && <div className="pageHeaderActions">{children}</div>}
    </div>
  )
}
