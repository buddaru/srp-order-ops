export const today = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
})()

export const daysFromNow = (n) => {
  const d = new Date(today)
  d.setDate(d.getDate() + n)
  return d
}

export const toDS = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
export const toTS = (h, m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
export const parseDate = (s) => { const d=new Date(s+'T00:00:00'); d.setHours(0,0,0,0); return d }
export const diffDays = (ds) => Math.round((parseDate(ds)-today)/86400000)
export const fmtTime = (t) => { const [h,m]=t.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}` }
export const fmtDate = (ds) => { const d=diffDays(ds); if(d===0)return'Today'; if(d===1)return'Tomorrow'; if(d===-1)return'Yesterday'; return parseDate(ds).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) }
export const fmtDateShort = (ds) => parseDate(ds).toLocaleDateString('en-US', { month:'short', day:'numeric' })
export const fmt$ = (n) => `$${Number(n).toFixed(2)}`
export const mkInitials = (name) => name.trim().split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2)
export const firstName = (name) => name.split(' ')[0]
export const orderTotal = (order) => order.items.reduce((s,i)=>s+(parseFloat(i.price)||0)*(parseInt(i.qty)||0),0)

export const dueBadge = (order) => {
  const d = diffDays(order.pickupDate)
  const short = fmtDateShort(order.pickupDate)
  if (d < 0)   return { cls: 'overdue',  label: `Overdue · ${short} · ${fmtTime(order.pickupTime)}` }
  if (d === 0) return { cls: 'today',    label: `Today, ${short} · ${fmtTime(order.pickupTime)}` }
  if (d === 1) return { cls: 'tomorrow', label: `Tomorrow, ${short} · ${fmtTime(order.pickupTime)}` }
  return { cls: 'future', label: `${fmtDate(order.pickupDate)} · ${fmtTime(order.pickupTime)}` }
}


export const STAGES = [
  { id: 'received',      label: 'Received' },
  { id: 'in-production', label: 'In Production' },
  { id: 'ready',         label: 'Ready for Pickup' },
  { id: 'picked-up',     label: 'Picked Up' },
]

// Manual SMS — shown as button on Ready for Pickup card
export const READY_SMS = (name) =>
  `🎉 Your Sweet Red Peach Carson order is READY, ${firstName(name)}! Come pick up anytime — we'll have it waiting.`

// Manual SMS — shown as button on Picked Up card
export const PICKEDUP_SMS = (name) =>
  `Thanks for visiting Sweet Red Peach Carson, ${firstName(name)}! We hope you love every bite. See you next time!`

// Days shown in calendar strip
export const STRIP_DAYS = 10

// Format: "Thursday, March 12  3:55 PM"
export const fmtNow = () => {
  const now = new Date()
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
  const month   = now.toLocaleDateString('en-US', { month: 'long' })
  const day     = now.getDate()
  const time    = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${weekday}, ${month} ${day}  ${time}`
}
