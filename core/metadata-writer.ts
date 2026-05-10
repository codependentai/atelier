import * as cheerio from 'cheerio'
import path from 'node:path'

export interface MetadataUpdate {
  description?: string
  tags?: string[]
}

export function writeMetadata(
  content: string,
  relativePath: string,
  updates: MetadataUpdate,
): string {
  const extension = path.extname(relativePath).toLowerCase()

  if (extension === '.md' || extension === '.markdown') {
    return writeMarkdownMetadata(content, updates)
  }

  return writeHtmlMetadata(content, updates)
}

function writeHtmlMetadata(content: string, updates: MetadataUpdate): string {
  const $ = cheerio.load(content)

  if ($('head').length === 0) {
    if ($('html').length === 0) {
      return prependFrontmatterStyleHtml(content, updates)
    }
    $('html').prepend('<head></head>')
  }

  if (updates.description !== undefined) {
    const descEl = $('meta[name="description"]')
    if (descEl.length === 0) {
      $('head').append(`<meta name="description" content="${escapeAttr(updates.description)}">`)
    } else {
      descEl.attr('content', updates.description)
    }
  }

  if (updates.tags !== undefined) {
    const value = updates.tags.filter((tag) => tag.trim().length > 0).join(', ')
    const keywordsEl = $('meta[name="keywords"]')
    if (value === '') {
      keywordsEl.remove()
    } else if (keywordsEl.length === 0) {
      $('head').append(`<meta name="keywords" content="${escapeAttr(value)}">`)
    } else {
      keywordsEl.attr('content', value)
    }
  }

  return $.html()
}

function prependFrontmatterStyleHtml(content: string, updates: MetadataUpdate): string {
  const metaTags: string[] = []
  if (updates.description !== undefined && updates.description !== '') {
    metaTags.push(`<meta name="description" content="${escapeAttr(updates.description)}">`)
  }
  if (updates.tags?.length) {
    metaTags.push(
      `<meta name="keywords" content="${escapeAttr(updates.tags.join(', '))}">`,
    )
  }
  if (metaTags.length === 0) {
    return content
  }
  return `${metaTags.join('\n')}\n${content}`
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function writeMarkdownMetadata(content: string, updates: MetadataUpdate): string {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const fields = new Map<string, string | string[]>()
  const fieldOrder: string[] = []
  let body = content

  if (frontmatterMatch) {
    body = content.slice(frontmatterMatch[0].length)
    const lines = frontmatterMatch[1].split(/\r?\n/)

    let currentListKey: string | null = null

    for (const line of lines) {
      const fieldMatch = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*(.*)$/)
      if (fieldMatch) {
        const key = fieldMatch[1]
        const value = fieldMatch[2].trim()
        if (!fields.has(key)) {
          fieldOrder.push(key)
        }
        currentListKey = null
        if (value.startsWith('[') && value.endsWith(']')) {
          fields.set(
            key,
            value
              .slice(1, -1)
              .split(',')
              .map((entry) => stripQuotes(entry.trim()))
              .filter(Boolean),
          )
        } else if (value === '') {
          currentListKey = key
          fields.set(key, [])
        } else {
          fields.set(key, stripQuotes(value))
        }
      } else if (currentListKey && /^\s*-\s+/.test(line)) {
        const list = fields.get(currentListKey)
        if (Array.isArray(list)) {
          list.push(stripQuotes(line.replace(/^\s*-\s+/, '').trim()))
        }
      }
    }
  }

  if (updates.description !== undefined) {
    if (!fields.has('description')) {
      fieldOrder.push('description')
    }
    fields.set('description', updates.description)
  }

  if (updates.tags !== undefined) {
    if (!fields.has('tags')) {
      fieldOrder.push('tags')
    }
    fields.set('tags', updates.tags.filter((tag) => tag.trim().length > 0))
  }

  if (fieldOrder.length === 0) {
    return body
  }

  const lines = fieldOrder
    .filter((key) => {
      const value = fields.get(key)
      if (Array.isArray(value)) {
        return value.length > 0
      }
      return value !== '' && value !== undefined
    })
    .map((key) => {
      const value = fields.get(key)!
      if (Array.isArray(value)) {
        const items = value.map((entry) => (needsYamlQuote(entry) ? JSON.stringify(entry) : entry))
        return `${key}: [${items.join(', ')}]`
      }
      const stringValue = String(value)
      return `${key}: ${needsYamlQuote(stringValue) ? JSON.stringify(stringValue) : stringValue}`
    })

  if (lines.length === 0) {
    return body.replace(/^\r?\n+/, '')
  }

  const trimmedBody = body.replace(/^\r?\n+/, '')
  return `---\n${lines.join('\n')}\n---\n\n${trimmedBody}`
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function needsYamlQuote(value: string): boolean {
  return /[:#\[\]{}&*!|>'"%@`,]/.test(value) || value.includes('\n')
}
