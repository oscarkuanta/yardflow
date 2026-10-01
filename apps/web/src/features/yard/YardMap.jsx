import { useState } from 'react';
import { SIZE_LABELS, formatDecimal } from '../../lib/format.js';
import {
  GATE_AREA_WIDTH,
  LABEL_HEIGHT,
  MAP_PADDING,
  layoutYard,
  stackFill,
} from './yard-geometry.js';

const BLOCK_TYPE_LABELS = { STANDARD: 'Standard', EMPTY: 'Empty', DG: 'DG' };
const HIGH_OCCUPANCY = 90;
const MEDIUM_OCCUPANCY = 75;

export function blockOutlineColor(block) {
  if (block.type === 'DG') {
    return 'var(--warn)';
  }
  if (block.occupancy.occupancyPercent >= HIGH_OCCUPANCY) {
    return 'var(--danger)';
  }
  if (block.occupancy.occupancyPercent >= MEDIUM_OCCUPANCY) {
    return 'var(--warn)';
  }
  return 'var(--border)';
}

function GateLanes({ height }) {
  const laneTop = Math.max(MAP_PADDING + LABEL_HEIGHT, height / 2 - 70);
  return (
    <g aria-hidden="true">
      <text x={24} y={laneTop - 14} className="fill-[var(--text-muted)] text-[13px] font-semibold">
        Gate
      </text>
      {[1, 2].map((lane, index) => (
        <g key={lane}>
          <rect
            x={24}
            y={laneTop + index * 74}
            width={GATE_AREA_WIDTH - 64}
            height={58}
            rx={12}
            fill="var(--surface-2)"
            stroke="var(--border)"
            strokeDasharray="6 5"
          />
          <text
            x={24 + (GATE_AREA_WIDTH - 64) / 2}
            y={laneTop + index * 74 + 34}
            textAnchor="middle"
            className="fill-[var(--text-muted)] font-mono text-[12px]"
          >
            Lane {lane}
          </text>
        </g>
      ))}
    </g>
  );
}

function BlockLabel({ layout }) {
  const { block } = layout;
  const label = `${block.code} · ${BLOCK_TYPE_LABELS[block.type]} · ${formatDecimal(
    block.occupancy.occupancyPercent,
  )}%`;
  const width = Math.max(110, label.length * 7.4 + 22);
  return (
    <g aria-hidden="true">
      <rect
        x={layout.x}
        y={layout.y - LABEL_HEIGHT + 2}
        width={width}
        height={24}
        rx={12}
        fill="var(--surface-glass)"
        stroke="var(--border)"
      />
      <text
        x={layout.x + 11}
        y={layout.y - LABEL_HEIGHT + 18.5}
        className="fill-[var(--text)] text-[12px] font-semibold"
      >
        {label}
      </text>
    </g>
  );
}

function StackCell({ cell, maxTier, isPulsing, onHover, onSelect }) {
  const fill = stackFill(cell.stack, maxTier);
  return (
    <rect
      x={cell.x}
      y={cell.y}
      width={cell.width}
      height={cell.height}
      rx={4}
      fill={fill.color}
      fillOpacity={fill.opacity}
      stroke="var(--accent)"
      strokeWidth={0}
      className={`cursor-pointer transition-[fill-opacity] hover:brightness-125 ${
        isPulsing ? 'animate-stack-pulse' : ''
      }`}
      onMouseEnter={() => onHover(cell)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(cell.stack.stackCode)}
      data-stack={cell.stack.stackCode}
    />
  );
}

function StackTooltip({ cell, map }) {
  if (!cell) {
    return null;
  }
  const { stack } = cell;
  const left = ((cell.x + cell.width / 2) / map.width) * 100;
  const top = (cell.y / map.height) * 100;
  return (
    <div
      role="tooltip"
      className="glass pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full px-3 py-2 text-xs"
      style={{ left: `${left}%`, top: `calc(${top}% - 8px)` }}
    >
      <p className="numeric font-semibold">{stack.stackCode}</p>
      <p className="text-muted">
        {stack.height === 0
          ? 'Empty stack'
          : `${stack.height} high · top ${SIZE_LABELS[stack.topSize] ?? stack.topSize}`}
        {stack.hasHold ? ' · customs hold' : ''}
        {stack.hasDangerous ? ' · DG' : ''}
      </p>
    </div>
  );
}

export function YardMap({ blocks, pulsingStacks, onSelectStack }) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const map = layoutYard(blocks);
  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${map.width} ${map.height}`}
        className="h-auto w-full"
        role="group"
        aria-label="Yard map. Use the table view for a keyboard friendly list of stacks."
      >
        <GateLanes height={map.height} />
        {map.layouts.map((layout) => (
          <g key={layout.block.code} data-block={layout.block.code}>
            <BlockLabel layout={layout} />
            <rect
              x={layout.x - 6}
              y={layout.y - 6}
              width={layout.width + 12}
              height={layout.height + 12}
              rx={10}
              fill="none"
              stroke={blockOutlineColor(layout.block)}
              strokeWidth={layout.block.type === 'DG' ? 2 : 1.5}
            />
            {layout.cells.map((cell) => (
              <StackCell
                key={cell.stack.stackCode}
                cell={cell}
                maxTier={layout.block.maxTier}
                isPulsing={pulsingStacks.has(cell.stack.stackCode)}
                onHover={setHoveredCell}
                onSelect={onSelectStack}
              />
            ))}
          </g>
        ))}
      </svg>
      <StackTooltip cell={hoveredCell} map={map} />
    </div>
  );
}
