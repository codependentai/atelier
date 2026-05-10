import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'
import MarkdownIt from 'markdown-it'
import type { VaultFile, VaultIndex, VaultLink } from '../src/shared/types.js'
import { getRelativeVaultPath, normalizeRelativePath, safeResolveVaultPath } from './path-guards.js'
import { readVaultConfig } from './vault-config.js'
import { iterateWikilinks } from './wikilink.js'

const HTML_EXTENSIONS = new Set(['.html', '.htm'])
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown'])
const DOCUMENT_EXTENSIONS = new Set([...HTML_EXTENSIONS, ...MARKDOWN_EXTENSIONS])

const markdownParser = new MarkdownIt({ html: true, linkify: false })

export function isMarkdownPath(relativePath: string): boolean {
  return MARKDOWN_EXTENSIONS.has(path.extname(relativePath).toLowerCase())
}

export function isHtmlPath(relativePath: string): boolean {
  return HTML_EXTENSIONS.has(path.extname(relativePath).toLowerCase())
}

export function isDocumentPath(relativePath: string): boolean {
  return DOCUMENT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())
}
const IGNORE_DIRS = new Set([
  '.git',
  '.htmlvault',
  '.cache',
  '.vite',
  'build',
  'coverage',
  'dist',
  'dist-cli',
  'dist-electron',
  'node_modules',
])

export function shouldIgnoreEntry(
  relativePath: string,
  basename: string,
  userIgnored: readonly string[] = [],
): boolean {
  if (IGNORE_DIRS.has(basename)) {
    return true
  }
  if (userIgnored.length === 0) {
    return false
  }
  const normalizedRelative = relativePath.replace(/\\/g, '/')
  for (const raw of userIgnored) {
    const pattern = raw.trim().replace(/\\/g, '/').replace(/\/+$/, '')
    if (!pattern) {
      continue
    }
    if (!pattern.includes('/')) {
      if (basename === pattern) {
        return true
      }
    } else if (
      normalizedRelative === pattern ||
      normalizedRelative.startsWith(`${pattern}/`)
    ) {
      return true
    }
  }
  return false
}

const EXTERNAL_PROTOCOLS = [
  'http:',
  'https:',
  'mailto:',
  'tel:',
  'data:',
  'javascript:',
]

type LinkClassificationInput = Pick<VaultLink, 'from' | 'rawHref' | 'label' | 'sourceTag'>

export async function createVaultIndex(
  rootPath: string,
  options: { userIgnored?: readonly string[] } = {},
): Promise<VaultIndex> {
  let userIgnored = options.userIgnored
  if (userIgnored === undefined) {
    const config = await readVaultConfig(rootPath)
    userIgnored = config.ignoredPaths ?? []
  }
  const files = await collectDocumentFiles(rootPath, userIgnored)
  const fileSet = new Set(files.map((file) => file.relativePath.toLowerCase()))
  const basenameMap = buildBasenameMap(files.map((file) => file.relativePath))
  const indexedFiles: VaultFile[] = []
  const links: VaultLink[] = []

  for (const file of files) {
    const content = await fs.readFile(file.absolutePath, 'utf8')
    const parsed = isMarkdownPath(file.relativePath)
      ? parseMarkdownFile(content, file.relativePath, file.stats.size, file.stats.mtimeMs)
      : parseHtmlFile(content, file.relativePath, file.stats.size, file.stats.mtimeMs)
    indexedFiles.push(parsed.file)

    for (const link of parsed.links) {
      links.push(await classifyLink(rootPath, file.relativePath, link, fileSet, basenameMap))
    }
  }

  const backlinks: Record<string, VaultLink[]> = {}
  for (const file of indexedFiles) {
    backlinks[file.relativePath] = []
  }

  for (const link of links) {
    if (link.kind === 'html' && link.resolvedTarget && backlinks[link.resolvedTarget]) {
      backlinks[link.resolvedTarget].push(link)
    }
  }

  return {
    rootPath,
    vaultName: path.basename(rootPath),
    files: indexedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    links,
    backlinks,
    graph: {
      nodes: indexedFiles.map((file) => ({
        id: file.relativePath,
        title: file.title,
      })),
      edges: links
        .filter((link) => link.kind === 'html' && link.resolvedTarget)
        .map((link) => ({
          from: link.from,
          to: link.resolvedTarget!,
        })),
    },
    generatedAt: Date.now(),
  }
}

function buildBasenameMap(relativePaths: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const relativePath of relativePaths) {
    const baseName = path.basename(relativePath)
    const stem = baseName.replace(/\.[^.]+$/, '').toLowerCase()
    if (!map.has(stem)) {
      map.set(stem, relativePath)
    }
  }
  return map
}

export function parseHtmlFile(
  content: string,
  relativePath: string,
  size = Buffer.byteLength(content, 'utf8'),
  modifiedAt = Date.now(),
): { file: VaultFile; links: LinkClassificationInput[] } {
  const $ = cheerio.load(content)
  const titleText = $('title').first().text().trim()
  const h1Text = $('h1').first().text().trim()
  const title = titleText || h1Text || path.basename(relativePath)
  const description = $('meta[name="description"]').attr('content')?.trim()
  const tags = $('meta[name="keywords"]')
    .attr('content')
    ?.split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  const headings = $('h1, h2, h3')
    .toArray()
    .map((heading) => $(heading).text().trim())
    .filter(Boolean)

  const links: LinkClassificationInput[] = []
  const collect = (selector: string, attr: 'href' | 'src', sourceTag: VaultLink['sourceTag']) => {
    $(selector).each((_, element) => {
      const rawHref = $(element).attr(attr)?.trim()
      if (!rawHref) {
        return
      }

      links.push({
        from: relativePath,
        rawHref,
        label: sourceTag === 'a' ? $(element).text().replace(/\s+/g, ' ').trim() : undefined,
        sourceTag,
      })
    })
  }

  collect('a[href]', 'href', 'a')
  collect('img[src]', 'src', 'img')
  collect('script[src]', 'src', 'script')
  collect('link[href]', 'href', 'link')

  return {
    file: {
      relativePath,
      title,
      headings,
      metadata: {
        ...(description ? { description } : {}),
        ...(tags?.length ? { tags } : {}),
      },
      size,
      modifiedAt,
    },
    links,
  }
}

export async function classifyLink(
  rootPath: string,
  fromPath: string,
  link: LinkClassificationInput,
  fileSet: Set<string>,
  basenameMap?: Map<string, string>,
): Promise<VaultLink> {
  const rawHref = link.rawHref.trim()

  if (!rawHref) {
    return { ...link, kind: 'missing' }
  }

  if (link.sourceTag === 'wikilink') {
    const stem = rawHref.replace(/\.[^.]+$/, '').toLowerCase()
    const resolved = basenameMap?.get(stem)
    if (resolved) {
      return { ...link, kind: 'html', resolvedTarget: resolved }
    }
    return { ...link, kind: 'missing', resolvedTarget: rawHref }
  }

  if (rawHref.startsWith('#')) {
    return { ...link, kind: 'anchor', resolvedTarget: fromPath }
  }

  const protocolMatch = rawHref.match(/^[a-zA-Z][a-zA-Z\d+.-]*:/)
  if (protocolMatch && EXTERNAL_PROTOCOLS.includes(protocolMatch[0].toLowerCase())) {
    return { ...link, kind: 'external' }
  }

  const strippedHref = rawHref.split('#')[0].split('?')[0]
  if (!strippedHref) {
    return { ...link, kind: 'anchor', resolvedTarget: fromPath }
  }

  const fromDirectory = path.posix.dirname(normalizeRelativePath(fromPath))
  const rawTarget = strippedHref.startsWith('/')
    ? strippedHref.replace(/^\/+/, '')
    : path.posix.join(fromDirectory === '.' ? '' : fromDirectory, strippedHref)
  const normalizedTarget = normalizeRelativePath(path.posix.normalize(rawTarget))

  if (normalizedTarget.startsWith('../')) {
    return { ...link, kind: 'missing', resolvedTarget: normalizedTarget }
  }

  const extension = path.posix.extname(normalizedTarget).toLowerCase()
  const documentTarget = DOCUMENT_EXTENSIONS.has(extension)

  if (documentTarget && fileSet.has(normalizedTarget.toLowerCase())) {
    return { ...link, kind: 'html', resolvedTarget: normalizedTarget }
  }

  try {
    await fs.access(safeResolveVaultPath(rootPath, normalizedTarget))
    return {
      ...link,
      kind: documentTarget ? 'html' : 'asset',
      resolvedTarget: normalizedTarget,
    }
  } catch {
    return { ...link, kind: 'missing', resolvedTarget: normalizedTarget }
  }
}

async function collectDocumentFiles(
  rootPath: string,
  userIgnored: readonly string[],
): Promise<
  Array<{
    absolutePath: string
    relativePath: string
    stats: {
      size: number
      mtimeMs: number
    }
  }>
> {
  const found: Array<{
    absolutePath: string
    relativePath: string
    stats: {
      size: number
      mtimeMs: number
    }
  }> = []

  await walk(rootPath)
  return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  async function walk(directoryPath: string): Promise<void> {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true })

    for (const entry of entries) {
      const absolutePath = path.join(directoryPath, entry.name)
      const relativeFromRoot = getRelativeVaultPath(rootPath, absolutePath)
      if (shouldIgnoreEntry(relativeFromRoot, entry.name, userIgnored)) {
        continue
      }

      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }

      if (!entry.isFile() || !DOCUMENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue
      }

      const stats = await fs.stat(absolutePath)
      found.push({
        absolutePath,
        relativePath: getRelativeVaultPath(rootPath, absolutePath),
        stats: {
          size: Number(stats.size),
          mtimeMs: Number(stats.mtimeMs),
        },
      })
    }
  }
}

interface ParsedFrontmatter {
  body: string
  data: { title?: string; description?: string; tags?: string[] }
}

function extractFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    return { body: content, data: {} }
  }

  const body = content.slice(match[0].length)
  const data: ParsedFrontmatter['data'] = {}
  const lines = match[1].split(/\r?\n/)

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const fieldMatch = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*(.*)$/)
    if (!fieldMatch) {
      continue
    }

    const [, key, rawValue] = fieldMatch
    const value = rawValue.trim()

    if (key === 'title') {
      data.title = stripQuotes(value)
    } else if (key === 'description') {
      data.description = stripQuotes(value)
    } else if (key === 'tags') {
      if (value.startsWith('[') && value.endsWith(']')) {
        data.tags = value
          .slice(1, -1)
          .split(',')
          .map((tag) => stripQuotes(tag.trim()))
          .filter(Boolean)
      } else if (value === '') {
        const collected: string[] = []
        let j = i + 1
        while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
          collected.push(stripQuotes(lines[j].replace(/^\s*-\s+/, '').trim()))
          j += 1
        }
        if (collected.length) {
          data.tags = collected
          i = j - 1
        }
      } else {
        data.tags = [stripQuotes(value)]
      }
    }
  }

  return { body, data }
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

export function parseMarkdownFile(
  content: string,
  relativePath: string,
  size = Buffer.byteLength(content, 'utf8'),
  modifiedAt = Date.now(),
): { file: VaultFile; links: LinkClassificationInput[] } {
  const { body, data } = extractFrontmatter(content)
  const tokens = markdownParser.parse(body, {})
  const headings: string[] = []
  const links: LinkClassificationInput[] = []
  let firstParagraph: string | undefined
  let firstH1: string | undefined

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.type === 'heading_open') {
      const inline = tokens[i + 1]
      const text = inline?.content?.trim() ?? ''
      const level = Number(token.tag.replace('h', ''))
      if (level <= 3 && text) {
        headings.push(text)
      }
      if (level === 1 && !firstH1) {
        firstH1 = text
      }
    } else if (token.type === 'paragraph_open' && !firstParagraph) {
      const inline = tokens[i + 1]
      if (inline?.content) {
        firstParagraph = inline.content.replace(/\s+/g, ' ').trim().slice(0, 280)
      }
    } else if (token.type === 'inline' && token.children) {
      for (const child of token.children) {
        if (child.type === 'link_open') {
          const href = child.attrGet('href')?.trim()
          if (!href) {
            continue
          }
          const labelToken = token.children[token.children.indexOf(child) + 1]
          const label = labelToken && labelToken.type === 'text' ? labelToken.content.trim() : undefined
          links.push({
            from: relativePath,
            rawHref: href,
            label,
            sourceTag: 'a',
          })
        } else if (child.type === 'image') {
          const src = child.attrGet('src')?.trim()
          if (src) {
            links.push({
              from: relativePath,
              rawHref: src,
              sourceTag: 'img',
            })
          }
        }
      }
    }
  }

  for (const wiki of iterateWikilinks(body)) {
    links.push({
      from: relativePath,
      rawHref: wiki.target,
      ...(wiki.label ? { label: wiki.label } : {}),
      sourceTag: 'wikilink',
    })
  }

  const title = data.title ?? firstH1 ?? path.basename(relativePath)
  const description = data.description ?? firstParagraph

  return {
    file: {
      relativePath,
      title,
      headings,
      metadata: {
        ...(description ? { description } : {}),
        ...(data.tags?.length ? { tags: data.tags } : {}),
      },
      size,
      modifiedAt,
    },
    links,
  }
}
