import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const scriptTag = '<script src="/js/ads.js" defer></script>'
const attributionFields = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'gbraid', 'wbraid', 'landing_page', 'submission_page',
]

function htmlFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...htmlFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full)
  }
  return out
}

for (const file of htmlFiles(root)) {
  let html = fs.readFileSync(file, 'utf8')
  let changed = false

  if (!html.includes('/js/ads.js') && html.includes('</body>')) {
    html = html.replace('</body>', `${scriptTag}\n</body>`)
    changed = true
  }

  if (html.includes('name="before-jumbo-strategy-studio"')) {
    const missing = attributionFields.filter((name) => !html.includes(`name="${name}"`))
    if (missing.length) {
      const fields = missing.map((name) => `  <input name="${name}" />`).join('\n')
      const marker = '<!-- Hidden static form so Netlify detects "before-jumbo-strategy-studio" at deploy -->'
      const start = html.indexOf(marker)
      if (start >= 0) {
        const close = html.indexOf('</form>', start)
        if (close >= 0) {
          html = html.slice(0, close) + fields + '\n' + html.slice(close)
          changed = true
        }
      }
    }
  }

  if (changed) fs.writeFileSync(file, html)
}

console.log('BeforeJumboLoan Ads tracking installed in build output.')
