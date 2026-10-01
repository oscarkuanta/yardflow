import { SIZE_LABELS, formatDecimal } from '../../lib/format.js';

function stackSummary(stack) {
  const notes = [];
  if (stack.hasHold) {
    notes.push('customs hold');
  }
  if (stack.hasDangerous) {
    notes.push('DG');
  }
  return notes.join(', ');
}

export function YardTable({ blocks, onSelectStack }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block) => {
        const usedStacks = block.stacks.filter((stack) => stack.height > 0);
        return (
          <section
            key={block.code}
            className="panel overflow-hidden"
            aria-label={`Block ${block.code}`}
          >
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
              Block {block.code} · {block.type} · {formatDecimal(block.occupancy.occupancyPercent)}%
              · {usedStacks.length} of {block.rows * block.bays} stacks used
            </h2>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Stack
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Height
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Top size
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usedStacks.map((stack) => (
                    <tr key={stack.stackCode} className="border-t border-line">
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          className="numeric underline-offset-2 hover:underline"
                          onClick={() => onSelectStack(stack.stackCode)}
                        >
                          {stack.stackCode}
                        </button>
                      </td>
                      <td className="numeric px-4 py-2">
                        {stack.height} / {block.maxTier}
                      </td>
                      <td className="px-4 py-2">{SIZE_LABELS[stack.topSize] ?? '—'}</td>
                      <td className="px-4 py-2 text-muted">{stackSummary(stack)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
