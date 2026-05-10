import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from './main.js'

let tempRoot: string | undefined

afterEach(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  }
})

async function makeVault(): Promise<string> {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'html-vault-cli-'))
  await fs.mkdir(path.join(tempRoot, 'docs'), { recursive: true })
  await fs.writeFile(
    path.join(tempRoot, 'index.html'),
    `<!doctype html>
    <html>
      <head><title>Index</title></head>
      <body>
        <h1>Index</h1>
        <a href="./docs/spec.html">Spec</a>
        <a href="./missing.html">Missing</a>
      </body>
    </html>`,
    'utf8',
  )
  await fs.writeFile(
    path.join(tempRoot, 'docs', 'spec.html'),
    `<!doctype html>
    <html>
      <head><title>Spec</title></head>
      <body><a href="../index.html">Index</a></body>
    </html>`,
    'utf8',
  )
  return tempRoot
}

describe('atelier CLI', () => {
  it('prints markdown for index, inspect, context, link-check, and prompt commands', async () => {
    const vault = await makeVault()

    await expect(runCli(['index', vault])).resolves.toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining('# Atelier Index'),
    })
    await expect(runCli(['inspect', vault, 'index.html'])).resolves.toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining('## Missing Links'),
    })
    await expect(runCli(['context', vault, '--file', 'index.html'])).resolves.toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining('# Atelier Context'),
    })
    await expect(runCli(['link-check', vault])).resolves.toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining('Missing links: 1'),
    })
    await expect(runCli(['prompt', 'create', vault])).resolves.toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining('Create a new standalone HTML artifact'),
    })
    await expect(runCli(['prompt', 'revise', vault, '--file', 'index.html'])).resolves.toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining('Revise index.html'),
    })
  })

  it('prints stable JSON command envelopes with --json', async () => {
    const vault = await makeVault()
    const result = await runCli(['index', vault, '--json'])
    const parsed = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(parsed.command).toBe('index')
    expect(parsed.vaultPath).toBe(vault)
    expect(parsed.payload.files).toHaveLength(2)
  })

  it('includes selected source only when context --include-source is used', async () => {
    const vault = await makeVault()
    const result = await runCli(['context', vault, '--file', 'index.html', '--include-source', '--json'])
    const parsed = JSON.parse(result.stdout)

    expect(parsed.payload.source).toContain('<title>Index</title>')
    expect(parsed.payload.source).not.toContain('<title>Spec</title>')
  })

  it('reports missing vaults, missing files, and traversal attempts as errors', async () => {
    const vault = await makeVault()

    await expect(runCli(['index', path.join(vault, 'nope')])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining('Vault path is not a directory'),
    })
    await expect(runCli(['inspect', vault, 'nope.html'])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining('File is not indexed'),
    })
    await expect(runCli(['context', vault, '--file', '../outside.html'])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining('File is not indexed'),
    })
  })

  it('emits schemaVersion in every JSON envelope', async () => {
    const vault = await makeVault()
    const result = await runCli(['index', vault, '--json'])
    const parsed = JSON.parse(result.stdout)
    expect(parsed.schemaVersion).toBe(1)
  })

  it('creates a new HTML file with template content', async () => {
    const vault = await makeVault()
    const result = await runCli(['create', vault, 'notes/quick.html', '--title', 'Quick', '--json'])
    const parsed = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(parsed.command).toBe('create')
    expect(parsed.payload.relativePath).toBe('notes/quick.html')
    expect(parsed.payload.bytesWritten).toBeGreaterThan(0)

    const written = await fs.readFile(path.join(vault, 'notes/quick.html'), 'utf8')
    expect(written).toContain('<title>Quick</title>')
  })

  it('refuses to create a file that already exists', async () => {
    const vault = await makeVault()
    await expect(runCli(['create', vault, 'index.html'])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining('already exists'),
    })
  })

  it('initializes a new vault with config and welcome file', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'html-vault-init-'))
    const target = path.join(tempRoot, 'fresh-vault')

    const result = await runCli(['init', target, '--json'])
    const parsed = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(parsed.command).toBe('init')
    expect(parsed.payload.vaultRoot).toBe(target)
    expect(parsed.payload.vaultName).toBe('fresh-vault')
    expect(parsed.payload.seededWelcome).toBe(true)

    const config = JSON.parse(await fs.readFile(path.join(target, '.htmlvault', 'config.json'), 'utf8'))
    expect(config.vaultName).toBe('fresh-vault')

    const welcome = await fs.readFile(path.join(target, 'index.html'), 'utf8')
    expect(welcome).toContain('Welcome to fresh-vault')
  })

  it('honors --name and --no-welcome flags on init', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'html-vault-init-named-'))
    const target = path.join(tempRoot, 'my-vault')

    const result = await runCli(['init', target, '--name', 'My Display Name', '--no-welcome', '--json'])
    const parsed = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(parsed.payload.vaultName).toBe('My Display Name')
    expect(parsed.payload.seededWelcome).toBe(false)

    const config = JSON.parse(await fs.readFile(path.join(target, '.htmlvault', 'config.json'), 'utf8'))
    expect(config.vaultName).toBe('My Display Name')

    await expect(fs.access(path.join(target, 'index.html'))).rejects.toThrow()
  })

  it('refuses to init when target folder already exists', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'html-vault-init-collide-'))
    const target = path.join(tempRoot, 'existing')
    await fs.mkdir(target)

    const result = await runCli(['init', target])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('already exists')
  })

  it('creates a document from --title without an explicit path', async () => {
    const vault = await makeVault()
    const result = await runCli(['create', vault, '--title', 'Quick Idea', '--json'])
    const parsed = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(parsed.command).toBe('create')
    expect(parsed.payload.relativePath).toBe('quick-idea.html')

    const written = await fs.readFile(path.join(vault, 'quick-idea.html'), 'utf8')
    expect(written).toContain('<title>Quick Idea</title>')
  })

  it('creates a markdown document from --title --format md', async () => {
    const vault = await makeVault()
    const result = await runCli(['create', vault, '--title', 'Note', '--format', 'md', '--json'])
    const parsed = JSON.parse(result.stdout)

    expect(parsed.payload.relativePath).toBe('note.md')
    const written = await fs.readFile(path.join(vault, 'note.md'), 'utf8')
    expect(written).toContain('title: Note')
  })

  it('imports external files into the vault', async () => {
    const vault = await makeVault()
    const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'html-vault-import-src-'))
    const sourceFile = path.join(sourceDir, 'imported.html')
    await fs.writeFile(sourceFile, '<!doctype html><html><head><title>Imported</title></head><body></body></html>', 'utf8')

    try {
      const result = await runCli(['import', vault, sourceFile, '--json'])
      const parsed = JSON.parse(result.stdout)

      expect(result.exitCode).toBe(0)
      expect(parsed.command).toBe('import')
      expect(parsed.payload.importedPaths).toContain('imported.html')

      const written = await fs.readFile(path.join(vault, 'imported.html'), 'utf8')
      expect(written).toContain('<title>Imported</title>')
    } finally {
      await fs.rm(sourceDir, { recursive: true, force: true })
    }
  })

  it('updates an existing file with --content', async () => {
    const vault = await makeVault()
    const result = await runCli([
      'update',
      vault,
      'index.html',
      '--content',
      '<!doctype html><html><head><title>Renamed</title></head><body></body></html>',
      '--json',
    ])

    expect(result.exitCode).toBe(0)
    const written = await fs.readFile(path.join(vault, 'index.html'), 'utf8')
    expect(written).toContain('<title>Renamed</title>')
  })

  it('refuses to update a non-existent file', async () => {
    const vault = await makeVault()
    await expect(
      runCli(['update', vault, 'never.html', '--content', '<html></html>']),
    ).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining('does not exist'),
    })
  })

  it('reads stdin when --from-stdin is set', async () => {
    const vault = await makeVault()
    const result = await runCli(
      ['create', vault, 'streamed.html', '--from-stdin', '--json'],
      undefined,
      { stdinReader: async () => '<html><head><title>Streamed</title></head></html>' },
    )
    expect(result.exitCode).toBe(0)
    const written = await fs.readFile(path.join(vault, 'streamed.html'), 'utf8')
    expect(written).toContain('<title>Streamed</title>')
  })

  it('moves a file to a new location', async () => {
    const vault = await makeVault()
    const result = await runCli(['move', vault, 'docs/spec.html', 'archive/spec.html', '--json'])
    expect(result.exitCode).toBe(0)
    await expect(fs.access(path.join(vault, 'docs/spec.html'))).rejects.toThrow()
    await expect(fs.access(path.join(vault, 'archive/spec.html'))).resolves.toBeUndefined()
  })

  it('renames a file in place', async () => {
    const vault = await makeVault()
    const result = await runCli(['rename', vault, 'index.html', 'home.html', '--json'])
    expect(result.exitCode).toBe(0)
    await expect(fs.access(path.join(vault, 'home.html'))).resolves.toBeUndefined()
  })

  it('duplicates with -copy suffix', async () => {
    const vault = await makeVault()
    const result = await runCli(['duplicate', vault, 'index.html', '--json'])
    const parsed = JSON.parse(result.stdout)
    expect(parsed.payload.duplicatePath).toBe('index-copy.html')
  })

  it('deletes a file', async () => {
    const vault = await makeVault()
    const result = await runCli(['delete', vault, 'docs/spec.html', '--json'])
    expect(result.exitCode).toBe(0)
    await expect(fs.access(path.join(vault, 'docs/spec.html'))).rejects.toThrow()
  })

  it('creates a folder', async () => {
    const vault = await makeVault()
    const result = await runCli(['mkdir', vault, 'archive/2026', '--json'])
    expect(result.exitCode).toBe(0)
    const stats = await fs.stat(path.join(vault, 'archive/2026'))
    expect(stats.isDirectory()).toBe(true)
  })

  it('searches across vault content', async () => {
    const vault = await makeVault()
    const result = await runCli(['search', vault, 'Spec', '--json'])
    const parsed = JSON.parse(result.stdout)
    expect(parsed.payload.matches.length).toBeGreaterThan(0)
    expect(parsed.payload.matches[0].relativePath).toBeTruthy()
    expect(parsed.payload.matches[0].snippet).toContain('Spec')
  })

  it('lints the vault and surfaces issues', async () => {
    const vault = await makeVault()
    const result = await runCli(['lint', vault, '--json'])
    const parsed = JSON.parse(result.stdout)
    expect(parsed.payload.fileCount).toBe(2)
    const kinds = new Set(parsed.payload.issues.map((issue: { kind: string }) => issue.kind))
    expect(kinds.has('missing-link')).toBe(true)
    expect(kinds.has('missing-description')).toBe(true)
  })
})
