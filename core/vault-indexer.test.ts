import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { safeResolveVaultPath } from './path-guards.js'
import { createVaultIndex, parseHtmlFile } from './vault-indexer.js'

let tempRoot: string | undefined

afterEach(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  }
})

async function makeTempVault(): Promise<string> {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'html-vault-'))
  return tempRoot
}

describe('parseHtmlFile', () => {
  it('extracts titles, headings, metadata, and resource links', () => {
    const parsed = parseHtmlFile(
      `<!doctype html>
      <html>
        <head>
          <title>Artifact Index</title>
          <meta name="description" content="A useful artifact.">
          <meta name="keywords" content="html, agents, vault">
          <link rel="stylesheet" href="./assets/app.css">
        </head>
        <body>
          <h1>Main Heading</h1>
          <h2>Second Heading</h2>
          <a href="./docs/spec.html">Spec</a>
          <img src="./assets/diagram.png" alt="">
          <script src="./assets/app.js"></script>
        </body>
      </html>`,
      'index.html',
    )

    expect(parsed.file.title).toBe('Artifact Index')
    expect(parsed.file.metadata.description).toBe('A useful artifact.')
    expect(parsed.file.metadata.tags).toEqual(['html', 'agents', 'vault'])
    expect(parsed.file.headings).toEqual(['Main Heading', 'Second Heading'])
    expect(parsed.links.map((link) => `${link.sourceTag}:${link.rawHref}`)).toEqual([
      'a:./docs/spec.html',
      'img:./assets/diagram.png',
      'script:./assets/app.js',
      'link:./assets/app.css',
    ])
  })
})

describe('createVaultIndex', () => {
  it('resolves relative links, backlinks, assets, external links, anchors, and missing targets', async () => {
    const root = await makeTempVault()
    await fs.mkdir(path.join(root, 'docs'), { recursive: true })
    await fs.mkdir(path.join(root, 'assets'), { recursive: true })
    await fs.writeFile(path.join(root, 'assets', 'app.css'), 'body { color: black; }', 'utf8')
    await fs.writeFile(
      path.join(root, 'index.html'),
      `<!doctype html>
      <html>
        <head>
          <title>Index</title>
          <link rel="stylesheet" href="./assets/app.css">
        </head>
        <body>
          <a href="./docs/spec.html?draft=1#top">Spec</a>
          <a href="missing.html">Missing</a>
          <a href="https://example.com">External</a>
          <a href="#local">Anchor</a>
        </body>
      </html>`,
      'utf8',
    )
    await fs.writeFile(
      path.join(root, 'docs', 'spec.html'),
      `<!doctype html>
      <html>
        <head><title>Spec</title></head>
        <body><a href="../index.html">Index</a></body>
      </html>`,
      'utf8',
    )

    const index = await createVaultIndex(root)
    const linksByHref = new Map(index.links.map((link) => [link.rawHref, link]))

    expect(index.files.map((file) => file.relativePath)).toEqual(['docs/spec.html', 'index.html'])
    expect(linksByHref.get('./docs/spec.html?draft=1#top')).toMatchObject({
      kind: 'html',
      resolvedTarget: 'docs/spec.html',
    })
    expect(linksByHref.get('./assets/app.css')).toMatchObject({
      kind: 'asset',
      resolvedTarget: 'assets/app.css',
    })
    expect(linksByHref.get('missing.html')).toMatchObject({
      kind: 'missing',
      resolvedTarget: 'missing.html',
    })
    expect(linksByHref.get('https://example.com')).toMatchObject({ kind: 'external' })
    expect(linksByHref.get('#local')).toMatchObject({ kind: 'anchor', resolvedTarget: 'index.html' })
    expect(index.backlinks['docs/spec.html']).toHaveLength(1)
    expect(index.backlinks['docs/spec.html'][0].from).toBe('index.html')
    expect(index.graph.edges).toEqual(
      expect.arrayContaining([
        { from: 'index.html', to: 'docs/spec.html' },
        { from: 'docs/spec.html', to: 'index.html' },
      ]),
    )
  })

  it('honors VaultConfig.ignoredPaths from .htmlvault/config.json', async () => {
    const root = await makeTempVault()
    await fs.mkdir(path.join(root, '.htmlvault'), { recursive: true })
    await fs.writeFile(
      path.join(root, '.htmlvault', 'config.json'),
      JSON.stringify({ ignoredPaths: ['drafts', 'archive/old'] }),
      'utf8',
    )
    await fs.mkdir(path.join(root, 'drafts'), { recursive: true })
    await fs.mkdir(path.join(root, 'archive', 'old'), { recursive: true })
    await fs.mkdir(path.join(root, 'archive', 'recent'), { recursive: true })
    await fs.writeFile(path.join(root, 'kept.html'), '<title>Kept</title>', 'utf8')
    await fs.writeFile(path.join(root, 'drafts', 'wip.html'), '<title>WIP</title>', 'utf8')
    await fs.writeFile(path.join(root, 'archive', 'old', 'gone.html'), '<title>Gone</title>', 'utf8')
    await fs.writeFile(path.join(root, 'archive', 'recent', 'still-here.html'), '<title>Recent</title>', 'utf8')

    const index = await createVaultIndex(root)
    const paths = index.files.map((file) => file.relativePath).sort()

    expect(paths).toEqual(['archive/recent/still-here.html', 'kept.html'])
  })
})

describe('safeResolveVaultPath', () => {
  it('rejects traversal outside the vault root', async () => {
    const root = await makeTempVault()

    expect(() => safeResolveVaultPath(root, '../outside.html')).toThrow('Path escapes the vault.')
    expect(() => safeResolveVaultPath(root, '/absolute.html')).toThrow('Path must be relative to the vault.')
    expect(safeResolveVaultPath(root, 'nested/page.html')).toBe(path.join(root, 'nested', 'page.html'))
  })
})
