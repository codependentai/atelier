import path from 'node:path'

export function toPosixPath(filePath: string): string {
  return filePath.replaceAll(path.sep, '/').replaceAll('\\', '/')
}

export function normalizeRelativePath(relativePath: string): string {
  return toPosixPath(relativePath).replace(/^\/+/, '')
}

export function safeResolveVaultPath(rootPath: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
    throw new Error('Path must be relative to the vault.')
  }

  const normalizedRelativePath = normalizeRelativePath(relativePath)

  if (!normalizedRelativePath || path.isAbsolute(normalizedRelativePath)) {
    throw new Error('Path must be relative to the vault.')
  }

  const resolvedRoot = path.resolve(rootPath)
  const resolvedTarget = path.resolve(resolvedRoot, normalizedRelativePath)
  const rootPrefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(rootPrefix)) {
    throw new Error('Path escapes the vault.')
  }

  return resolvedTarget
}

export function getRelativeVaultPath(rootPath: string, absolutePath: string): string {
  return normalizeRelativePath(path.relative(rootPath, absolutePath))
}
