import { promises as fs } from 'node:fs'
import type { VaultContext, VaultFile } from '../src/shared/types.js'
import { safeResolveVaultPath } from './path-guards.js'
import { createVaultIndex } from './vault-indexer.js'

export async function createVaultContext(
  vaultPath: string,
  relativePath: string,
  options: { includeSource?: boolean } = {},
): Promise<VaultContext> {
  const index = await createVaultIndex(vaultPath)
  const file = index.files.find((item) => item.relativePath === relativePath)

  if (!file) {
    throw new Error(`File is not indexed in this vault: ${relativePath}`)
  }

  const outgoingLinks = index.links.filter((link) => link.from === relativePath)
  const backlinks = index.backlinks[relativePath] ?? []
  const missingLinks = outgoingLinks.filter((link) => link.kind === 'missing')
  const relatedPaths = new Set<string>()

  for (const link of outgoingLinks) {
    if (link.kind === 'html' && link.resolvedTarget) {
      relatedPaths.add(link.resolvedTarget)
    }
  }

  for (const link of backlinks) {
    relatedPaths.add(link.from)
  }

  const relatedFiles = [...relatedPaths]
    .filter((path) => path !== relativePath)
    .map((path) => index.files.find((candidate) => candidate.relativePath === path))
    .filter((candidate): candidate is VaultFile => Boolean(candidate))

  return {
    vaultPath,
    file,
    outgoingLinks,
    backlinks,
    missingLinks,
    relatedFiles,
    ...(options.includeSource
      ? { source: await fs.readFile(safeResolveVaultPath(vaultPath, relativePath), 'utf8') }
      : {}),
    generatedAt: Date.now(),
  }
}
