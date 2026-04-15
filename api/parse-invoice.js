// api/parse-invoice.js
// Accepts a PDF (base64) + ingredients list, returns extracted line items with AI fuzzy-matches

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { pdf_base64, ingredients } = req.body
  if (!pdf_base64) return res.status(400).json({ error: 'pdf_base64 is required' })
  if (!ingredients || !Array.isArray(ingredients)) return res.status(400).json({ error: 'ingredients array is required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const ingredientNames = ingredients.map(i => i.name).join('\n')

  const prompt = `You are a data extraction assistant for a bakery supply management system.

Extract all line items from this supplier invoice PDF. Then match each line item to the closest ingredient from our ingredient library below.

OUR INGREDIENTS:
${ingredientNames}

For each invoice line item, return:
- invoice_name: exact product name from invoice
- qty: quantity number
- qty_unit: unit type (case, unit, lb, bag, etc.)
- unit_price: price per unit/case as a number
- total_price: line total as a number
- matched_ingredient: the EXACT ingredient name from our list above that best matches this product, or null if no match
- confidence: "high" (clearly the same product), "medium" (likely a match), "low" (uncertain), or "none" (no match)
- match_note: brief explanation of your matching logic (e.g. "C&H Powdered Sugar 50lb = Powdered Sugar", or "Dawn dish soap - no food ingredient match")

Also extract the invoice header fields.

Return ONLY valid JSON with this exact structure, no markdown, no explanation:
{
  "invoice_number": "string or null",
  "supplier": "string or null",
  "order_date": "YYYY-MM-DD or null",
  "delivery_date": "YYYY-MM-DD or null",
  "total_amount": number or null,
  "line_items": [
    {
      "invoice_name": "string",
      "qty": number,
      "qty_unit": "string",
      "unit_price": number,
      "total_price": number,
      "matched_ingredient": "string or null",
      "confidence": "high|medium|low|none",
      "match_note": "string"
    }
  ]
}`

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf_base64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      console.error('Claude API error:', err)
      return res.status(500).json({ error: 'AI parsing failed', detail: err })
    }

    const claudeData = await claudeRes.json()
    const rawText = claudeData.content?.find(b => b.type === 'text')?.text || ''

    let parsed
    try {
      const clean = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(clean)
    } catch (e) {
      console.error('JSON parse error:', rawText)
      return res.status(500).json({ error: 'Failed to parse AI response', raw: rawText })
    }

    // Attach ingredient IDs to matched items
    const ingMap = {}
    ingredients.forEach(i => { ingMap[i.name] = i })

    parsed.line_items = (parsed.line_items || []).map(item => ({
      ...item,
      matched_id: item.matched_ingredient ? (ingMap[item.matched_ingredient]?.id || null) : null,
      matched_unit: item.matched_ingredient ? (ingMap[item.matched_ingredient]?.purchase_unit || null) : null,
    }))

    return res.status(200).json(parsed)
  } catch (err) {
    console.error('parse-invoice error:', err)
    return res.status(500).json({ error: err.message })
  }
}
