// api/fetch-rd-price.js
// Attempts to look up an ingredient price on Restaurant Depot's website.
// Falls back gracefully if the site is unreachable or requires location login.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'Query param ?q= required' })

  try {
    // RD uses a Salesforce Commerce Cloud backend.
    // Their search API endpoint (used by rdrestaurant.com):
    const rdSearchUrl = `https://www.restaurantdepot.com/s/search-products?q=${encodeURIComponent(q)}&lang=en_US`

    const response = await fetch(rdSearchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.restaurantdepot.com/',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      return res.status(200).json({
        notFound: true,
        message: `Restaurant Depot returned HTTP ${response.status}. Prices may require store login.`,
        searchUrl: `https://www.restaurantdepot.com/s/search-products?q=${encodeURIComponent(q)}`,
      })
    }

    const html = await response.text()

    // Try to extract the first product result from the HTML.
    // RD renders product cards with data-price and data-name attributes.
    const nameMatch  = html.match(/class="[^"]*product-name[^"]*"[^>]*>([^<]{3,80})</i)
    const priceMatch = html.match(/\$\s*(\d+\.?\d*)\s*\/\s*([A-Za-z]+)/i)
    const unitMatch  = html.match(/data-unit="([^"]+)"/i)

    if (nameMatch && priceMatch) {
      const rawUnit = unitMatch?.[1] || priceMatch[2] || 'each'
      // Map RD unit strings to our internal unit keys
      const unitMap = {
        'lb': 'lb', 'lbs': 'lb', 'pound': 'lb',
        'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
        'ct': 'each', 'ea': 'each', 'each': 'each',
        'cs': 'each', 'case': 'each',
        'gal': 'l',   // approximate
        'qt': 'l',
      }
      const unit  = unitMap[rawUnit.toLowerCase()] || rawUnit.toLowerCase()
      const price = parseFloat(priceMatch[1])

      return res.status(200).json({
        name:      nameMatch[1].trim(),
        price,
        unit,
        source:    'restaurantdepot.com',
        searchUrl: `https://www.restaurantdepot.com/s/search-products?q=${encodeURIComponent(q)}`,
      })
    }

    // No price found in HTML — return search link so user can check manually
    return res.status(200).json({
      notFound: true,
      message:  'No price found automatically. Click to search RD manually.',
      searchUrl: `https://www.restaurantdepot.com/s/search-products?q=${encodeURIComponent(q)}`,
    })

  } catch (err) {
    // Network error or CORS — return a helpful fallback
    return res.status(200).json({
      notFound: true,
      message:  'Restaurant Depot could not be reached automatically.',
      searchUrl: `https://www.restaurantdepot.com/s/search-products?q=${encodeURIComponent(q)}`,
    })
  }
}
