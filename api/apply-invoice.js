// api/apply-invoice.js
// Saves invoice record, logs price history, updates ingredient current prices

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    invoice_number,
    supplier,
    order_date,
    delivery_date,
    total_amount,
    line_items,       // full extracted line items for record-keeping
    confirmed_matches, // [{ ingredient_id, ingredient_name, new_price, purchase_unit, invoice_item_name }]
    supply_items,     // [{ item_name, total_paid, qty, unit, price_per_unit, invoice_name }]
  } = req.body

  if (!confirmed_matches || !Array.isArray(confirmed_matches)) {
    return res.status(400).json({ error: 'confirmed_matches array is required' })
  }

  try {
    // 1. Save the invoice record
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoice_number || null,
        supplier:       supplier || null,
        order_date:     order_date || null,
        delivery_date:  delivery_date || null,
        total_amount:   total_amount || null,
        item_count:     (line_items || []).length,
        line_items:     line_items || [],
        matches:        confirmed_matches,
      })
      .select('id')
      .single()

    if (invErr) throw invErr

    const invoiceId = invoice.id

    // 2. For each confirmed match: update ingredient price + log history
    const updates = confirmed_matches.filter(m => m.ingredient_id && m.new_price > 0)

    for (const match of updates) {
      // Update ingredient current price
      await supabase
        .from('ingredients')
        .update({
          purchase_price: match.new_price,
          supplier:       supplier || undefined,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', match.ingredient_id)

      // Log price history
      await supabase
        .from('ingredient_price_history')
        .insert({
          ingredient_id:   match.ingredient_id,
          ingredient_name: match.ingredient_name,
          purchase_price:  match.new_price,
          purchase_unit:   match.purchase_unit || null,
          supplier:        supplier || null,
          source:          'invoice',
          invoice_id:      invoiceId,
          invoice_number:  invoice_number || null,
          recorded_at:     order_date ? new Date(order_date).toISOString() : new Date().toISOString(),
        })
    }

    // 3. Save supply item price history (non-ingredient tracked items)
    let supplyCount = 0
    if (supply_items && supply_items.length > 0) {
      for (const s of supply_items) {
        const { error: sErr } = await supabase
          .from('supply_price_history')
          .insert({
            invoice_id:    invoiceId,
            item_name:     s.item_name,
            total_paid:    s.total_paid,
            qty:           s.qty,
            unit:          s.unit,
            price_per_unit: parseFloat(s.price_per_unit.toFixed(6)),
            supplier:      supplier || null,
            recorded_at:   order_date ? new Date(order_date).toISOString() : new Date().toISOString(),
          })
        if (sErr) {
          console.error('supply_price_history insert error:', sErr.message)
        } else {
          supplyCount++
        }
      }
    }

    return res.status(200).json({
      success: true,
      invoice_id: invoiceId,
      updated_count: updates.length,
      supply_count: supplyCount,
    })
  } catch (err) {
    console.error('apply-invoice error:', err)
    return res.status(500).json({ error: err.message })
  }
}
