import type { VaultIndex } from '../shared/types'

export function GraphView({
  index,
  selectedPath,
  onSelect,
}: {
  index: VaultIndex
  selectedPath: string
  onSelect: (path: string) => void
}) {
  const width = 920
  const height = 620
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) * 0.36
  const positions = new Map<string, { x: number; y: number }>()

  index.graph.nodes.forEach((node, indexOfNode) => {
    const angle = (Math.PI * 2 * indexOfNode) / Math.max(index.graph.nodes.length, 1) - Math.PI / 2
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    })
  })

  return (
    <section className="graph-pane">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Vault graph">
        {index.graph.edges.map((edge) => {
          const from = positions.get(edge.from)
          const to = positions.get(edge.to)
          if (!from || !to) {
            return null
          }

          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={edge.from === selectedPath || edge.to === selectedPath ? 'active-edge' : ''}
            />
          )
        })}
        {index.graph.nodes.map((node) => {
          const point = positions.get(node.id)!
          const active = node.id === selectedPath

          return (
            <g key={node.id} className={`graph-node ${active ? 'active' : ''}`} onClick={() => onSelect(node.id)}>
              <circle cx={point.x} cy={point.y} r={active ? 24 : 19} />
              <text x={point.x} y={point.y + 40} textAnchor="middle">
                {node.title}
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}
