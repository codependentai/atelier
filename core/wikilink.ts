export interface WikilinkMatch {
  target: string
  label?: string
}

export function createWikilinkRegex(): RegExp {
  return /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g
}

export function* iterateWikilinks(body: string): Generator<WikilinkMatch> {
  const regex = createWikilinkRegex()
  let match: RegExpExecArray | null
  while ((match = regex.exec(body)) !== null) {
    const target = match[1].trim()
    const label = match[2]?.trim()
    yield label ? { target, label } : { target }
  }
}

export function expandWikilinksToMarkdown(body: string): string {
  return body.replace(createWikilinkRegex(), (_match, target: string, label: string | undefined) => {
    const cleanTarget = target.trim()
    const cleanLabel = label ? label.trim() : cleanTarget
    return `[${cleanLabel}](${encodeURI(cleanTarget)})`
  })
}
