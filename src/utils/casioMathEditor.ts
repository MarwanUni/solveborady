import { SYMBOL_SHORTCUTS } from './shortcuts';

export type CasioSlotName = 'num' | 'den' | 'exp' | 'sub' | 'radicand';

export type CasioNode =
  | { id: string; type: 'char'; value: string }
  | { id: string; type: 'frac'; num: CasioNode[]; den: CasioNode[] }
  | { id: string; type: 'sup'; exp: CasioNode[] }
  | { id: string; type: 'sub'; sub: CasioNode[] }
  | { id: string; type: 'sqrt'; radicand: CasioNode[] };

export interface CasioPathSegment {
  nodeId: string;
  slot: CasioSlotName;
}

export interface CasioCursor {
  path: CasioPathSegment[];
  index: number;
}

export interface CasioEditorState {
  nodes: CasioNode[];
  cursor: CasioCursor;
}

let nodeCounter = 0;
function nextId(prefix = 'n'): string {
  nodeCounter += 1;
  return `${prefix}-${nodeCounter}`;
}

export function createEmptyCasioState(): CasioEditorState {
  return {
    nodes: [],
    cursor: { path: [], index: 0 },
  };
}

export function createCasioStateFromNodes(nodes: CasioNode[]): CasioEditorState {
  return {
    nodes,
    cursor: { path: [], index: nodes.length },
  };
}

function getSlotArray(node: CasioNode, slot: CasioSlotName): CasioNode[] | null {
  if (node.type === 'frac' && (slot === 'num' || slot === 'den')) {
    return node[slot];
  }
  if (node.type === 'sup' && slot === 'exp') return node.exp;
  if (node.type === 'sub' && slot === 'sub') return node.sub;
  if (node.type === 'sqrt' && slot === 'radicand') return node.radicand;
  return null;
}

function updateSlotArray(
  node: CasioNode,
  slot: CasioSlotName,
  nextArr: CasioNode[]
): CasioNode {
  if (node.type === 'frac' && slot === 'num') return { ...node, num: nextArr };
  if (node.type === 'frac' && slot === 'den') return { ...node, den: nextArr };
  if (node.type === 'sup' && slot === 'exp') return { ...node, exp: nextArr };
  if (node.type === 'sub' && slot === 'sub') return { ...node, sub: nextArr };
  if (node.type === 'sqrt' && slot === 'radicand') {
    return { ...node, radicand: nextArr };
  }
  return node;
}

export function getListAtPath(
  nodes: CasioNode[],
  path: CasioPathSegment[]
): CasioNode[] {
  let curr = nodes;
  for (const seg of path) {
    const found = curr.find((n) => n.id === seg.nodeId);
    if (!found) return curr;
    const slotArr = getSlotArray(found, seg.slot);
    if (!slotArr) return curr;
    curr = slotArr;
  }
  return curr;
}

function replaceListAtPath(
  nodes: CasioNode[],
  path: CasioPathSegment[],
  nextList: CasioNode[]
): CasioNode[] {
  if (path.length === 0) return nextList;
  const [head, ...rest] = path;
  return nodes.map((n) => {
    if (n.id !== head.nodeId) return n;
    const currentSlot = getSlotArray(n, head.slot);
    if (!currentSlot) return n;
    const updatedSlot =
      rest.length === 0 ? nextList : replaceListAtPath(currentSlot, rest, nextList);
    return updateSlotArray(n, head.slot, updatedSlot);
  });
}

function isNumeratorAtom(node: CasioNode): boolean {
  if (node.type === 'sup' || node.type === 'sub' || node.type === 'sqrt') {
    return true;
  }
  if (node.type === 'char') {
    return /^[A-Za-z0-9_.ωθφαβγδλστμεΩπ∞°]$/.test(node.value);
  }
  return false;
}

const VALID_SHORTCUT_PREFIX = /^$|[\s+\-*/^(=,[{]$/;

function tryExpandShortcutInList(
  list: CasioNode[],
  cursorIndex: number
): { nextList: CasioNode[]; nextIndex: number } | null {
  // Inspect up to 8 preceding contiguous char nodes
  let start = cursorIndex;
  while (start > 0 && cursorIndex - start < 10 && list[start - 1].type === 'char') {
    start -= 1;
  }
  const chars = list
    .slice(start, cursorIndex)
    .map((n) => (n.type === 'char' ? n.value : ''))
    .join('');

  for (const item of SYMBOL_SHORTCUTS) {
    if (chars.endsWith(item.trigger)) {
      const prefixLen = chars.length - item.trigger.length;
      const prevNodeIdx = start + prefixLen - 1;
      const prevChar =
        prevNodeIdx >= 0 && list[prevNodeIdx].type === 'char'
          ? (list[prevNodeIdx] as { type: 'char'; value: string }).value
          : '';
      if (prevNodeIdx < 0 || list[prevNodeIdx].type !== 'char' || VALID_SHORTCUT_PREFIX.test(prevChar)) {
        const replaceStart = start + prefixLen;
        const symbolNode: CasioNode = {
          id: nextId('sym'),
          type: 'char',
          value: item.symbol,
        };
        const nextList = [
          ...list.slice(0, replaceStart),
          symbolNode,
          ...list.slice(cursorIndex),
        ];
        return { nextList, nextIndex: replaceStart + 1 };
      }
    }
  }
  return null;
}

export function insertChar(
  state: CasioEditorState,
  rawChar: string
): CasioEditorState {
  if (!rawChar || rawChar === ' ') return state;

  // Handle sqrt( shortcut automatically
  if (rawChar === '(') {
    const list = getListAtPath(state.nodes, state.cursor.path);
    const idx = state.cursor.index;
    if (idx >= 4) {
      const last4 = list
        .slice(idx - 4, idx)
        .map((n) => (n.type === 'char' ? n.value : ''))
        .join('');
      if (last4.toLowerCase() === 'sqrt') {
        const sqrtNode: CasioNode = {
          id: nextId('sqrt'),
          type: 'sqrt',
          radicand: [],
        };
        const nextList = [
          ...list.slice(0, idx - 4),
          sqrtNode,
          ...list.slice(idx),
        ];
        return {
          nodes: replaceListAtPath(state.nodes, state.cursor.path, nextList),
          cursor: {
            path: [
              ...state.cursor.path,
              { nodeId: sqrtNode.id, slot: 'radicand' },
            ],
            index: 0,
          },
        };
      }
    }
  }

  // Closing ')' inside a sqrt radicand without unmatched '(' steps cleanly out of sqrt
  if (rawChar === ')' && state.cursor.path.length > 0) {
    const top = state.cursor.path[state.cursor.path.length - 1];
    if (top.slot === 'radicand') {
      const list = getListAtPath(state.nodes, state.cursor.path);
      let balance = 0;
      for (let i = 0; i < state.cursor.index; i++) {
        const n = list[i];
        if (n.type === 'char' && n.value === '(') balance += 1;
        else if (n.type === 'char' && n.value === ')') balance -= 1;
      }
      if (balance <= 0) {
        const parentPath = state.cursor.path.slice(0, -1);
        const parentList = getListAtPath(state.nodes, parentPath);
        const parentIdx = parentList.findIndex((n) => n.id === top.nodeId);
        return {
          nodes: state.nodes,
          cursor: {
            path: parentPath,
            index: parentIdx >= 0 ? parentIdx + 1 : parentList.length,
          },
        };
      }
    }
  }

  // Typing '=' while inside a fraction/sup/sub exits to root level first so `x/y = 2` works effortlessly
  if (rawChar === '=' && state.cursor.path.length > 0) {
    const firstSeg = state.cursor.path[0];
    const rootIdx = state.nodes.findIndex((n) => n.id === firstSeg.nodeId);
    const eqNode: CasioNode = { id: nextId('ch'), type: 'char', value: '=' };
    const insertIdx = rootIdx >= 0 ? rootIdx + 1 : state.nodes.length;
    const nextRoot = [
      ...state.nodes.slice(0, insertIdx),
      eqNode,
      ...state.nodes.slice(insertIdx),
    ];
    return {
      nodes: nextRoot,
      cursor: { path: [], index: insertIdx + 1 },
    };
  }

  const list = getListAtPath(state.nodes, state.cursor.path);
  const charNode: CasioNode = { id: nextId('ch'), type: 'char', value: rawChar };
  const inserted = [
    ...list.slice(0, state.cursor.index),
    charNode,
    ...list.slice(state.cursor.index),
  ];
  const expanded = tryExpandShortcutInList(inserted, state.cursor.index + 1);
  const finalList = expanded ? expanded.nextList : inserted;
  const finalIdx = expanded ? expanded.nextIndex : state.cursor.index + 1;

  return {
    nodes: replaceListAtPath(state.nodes, state.cursor.path, finalList),
    cursor: { path: state.cursor.path, index: finalIdx },
  };
}

export function insertFraction(state: CasioEditorState): CasioEditorState {
  const list = getListAtPath(state.nodes, state.cursor.path);
  const idx = state.cursor.index;

  let pullStart = idx;
  let stripParens = false;

  if (idx > 0) {
    const prev = list[idx - 1];
    if (prev.type === 'char' && prev.value === ')') {
      // Walk backward to matching '('
      let depth = 0;
      for (let i = idx - 1; i >= 0; i--) {
        const n = list[i];
        if (n.type === 'char' && n.value === ')') depth += 1;
        else if (n.type === 'char' && n.value === '(') depth -= 1;
        if (depth === 0) {
          pullStart = i;
          stripParens = true;
          break;
        }
      }
    } else {
      while (pullStart > 0 && isNumeratorAtom(list[pullStart - 1])) {
        pullStart -= 1;
      }
    }
  }

  let pulled = list.slice(pullStart, idx);
  if (stripParens && pulled.length >= 2) {
    pulled = pulled.slice(1, -1);
  }

  const fracNode: CasioNode = {
    id: nextId('frac'),
    type: 'frac',
    num: pulled,
    den: [],
  };

  const nextList = [
    ...list.slice(0, pullStart),
    fracNode,
    ...list.slice(idx),
  ];

  const targetSlot: CasioSlotName = pulled.length > 0 ? 'den' : 'num';

  return {
    nodes: replaceListAtPath(state.nodes, state.cursor.path, nextList),
    cursor: {
      path: [...state.cursor.path, { nodeId: fracNode.id, slot: targetSlot }],
      index: 0,
    },
  };
}

export function insertSup(state: CasioEditorState): CasioEditorState {
  const list = getListAtPath(state.nodes, state.cursor.path);
  const supNode: CasioNode = { id: nextId('sup'), type: 'sup', exp: [] };
  const nextList = [
    ...list.slice(0, state.cursor.index),
    supNode,
    ...list.slice(state.cursor.index),
  ];
  return {
    nodes: replaceListAtPath(state.nodes, state.cursor.path, nextList),
    cursor: {
      path: [...state.cursor.path, { nodeId: supNode.id, slot: 'exp' }],
      index: 0,
    },
  };
}

export function insertSub(state: CasioEditorState): CasioEditorState {
  const list = getListAtPath(state.nodes, state.cursor.path);
  const subNode: CasioNode = { id: nextId('sub'), type: 'sub', sub: [] };
  const nextList = [
    ...list.slice(0, state.cursor.index),
    subNode,
    ...list.slice(state.cursor.index),
  ];
  return {
    nodes: replaceListAtPath(state.nodes, state.cursor.path, nextList),
    cursor: {
      path: [...state.cursor.path, { nodeId: subNode.id, slot: 'sub' }],
      index: 0,
    },
  };
}

export function insertSqrt(state: CasioEditorState): CasioEditorState {
  const list = getListAtPath(state.nodes, state.cursor.path);
  const sqrtNode: CasioNode = { id: nextId('sqrt'), type: 'sqrt', radicand: [] };
  const nextList = [
    ...list.slice(0, state.cursor.index),
    sqrtNode,
    ...list.slice(state.cursor.index),
  ];
  return {
    nodes: replaceListAtPath(state.nodes, state.cursor.path, nextList),
    cursor: {
      path: [...state.cursor.path, { nodeId: sqrtNode.id, slot: 'radicand' }],
      index: 0,
    },
  };
}

export function backspace(state: CasioEditorState): CasioEditorState {
  const list = getListAtPath(state.nodes, state.cursor.path);
  const idx = state.cursor.index;

  if (idx > 0) {
    const prev = list[idx - 1];
    if (prev.type === 'char') {
      const nextList = [...list.slice(0, idx - 1), ...list.slice(idx)];
      return {
        nodes: replaceListAtPath(state.nodes, state.cursor.path, nextList),
        cursor: { path: state.cursor.path, index: idx - 1 },
      };
    }

    // Container node before cursor: if empty remove it, otherwise enter its last slot at end
    if (prev.type === 'frac') {
      if (prev.num.length === 0 && prev.den.length === 0) {
        const nextList = [...list.slice(0, idx - 1), ...list.slice(idx)];
        return {
          nodes: replaceListAtPath(state.nodes, state.cursor.path, nextList),
          cursor: { path: state.cursor.path, index: idx - 1 },
        };
      }
      const targetSlot: CasioSlotName = prev.den.length > 0 ? 'den' : 'num';
      const targetArr = prev[targetSlot];
      return {
        nodes: state.nodes,
        cursor: {
          path: [...state.cursor.path, { nodeId: prev.id, slot: targetSlot }],
          index: targetArr.length,
        },
      };
    }

    const slot: CasioSlotName =
      prev.type === 'sup' ? 'exp' : prev.type === 'sub' ? 'sub' : 'radicand';
    const arr = getSlotArray(prev, slot) ?? [];
    if (arr.length === 0) {
      const nextList = [...list.slice(0, idx - 1), ...list.slice(idx)];
      return {
        nodes: replaceListAtPath(state.nodes, state.cursor.path, nextList),
        cursor: { path: state.cursor.path, index: idx - 1 },
      };
    }
    return {
      nodes: state.nodes,
      cursor: {
        path: [...state.cursor.path, { nodeId: prev.id, slot }],
        index: arr.length,
      },
    };
  }

  // idx === 0 inside a slot: unwrap/remove container back into parent
  if (state.cursor.path.length === 0) return state;

  const seg = state.cursor.path[state.cursor.path.length - 1];
  const parentPath = state.cursor.path.slice(0, -1);
  const parentList = getListAtPath(state.nodes, parentPath);
  const containerIdx = parentList.findIndex((n) => n.id === seg.nodeId);
  if (containerIdx < 0) return state;
  const container = parentList[containerIdx];

  if (container.type === 'frac') {
    if (seg.slot === 'den') {
      const merged = [...container.num, ...container.den];
      const nextParent = [
        ...parentList.slice(0, containerIdx),
        ...merged,
        ...parentList.slice(containerIdx + 1),
      ];
      return {
        nodes: replaceListAtPath(state.nodes, parentPath, nextParent),
        cursor: {
          path: parentPath,
          index: containerIdx + container.num.length,
        },
      };
    }
    // seg.slot === 'num' and idx === 0
    const nextParent = [
      ...parentList.slice(0, containerIdx),
      ...container.num,
      ...container.den,
      ...parentList.slice(containerIdx + 1),
    ];
    return {
      nodes: replaceListAtPath(state.nodes, parentPath, nextParent),
      cursor: { path: parentPath, index: containerIdx },
    };
  }

  const slotArr = getSlotArray(container, seg.slot) ?? [];
  const nextParent = [
    ...parentList.slice(0, containerIdx),
    ...slotArr,
    ...parentList.slice(containerIdx + 1),
  ];
  return {
    nodes: replaceListAtPath(state.nodes, parentPath, nextParent),
    cursor: { path: parentPath, index: containerIdx },
  };
}

export function moveLeft(state: CasioEditorState): CasioEditorState {
  const list = getListAtPath(state.nodes, state.cursor.path);
  const idx = state.cursor.index;

  if (idx > 0) {
    const prev = list[idx - 1];
    if (prev.type === 'frac') {
      return {
        nodes: state.nodes,
        cursor: {
          path: [...state.cursor.path, { nodeId: prev.id, slot: 'den' }],
          index: prev.den.length,
        },
      };
    }
    if (prev.type === 'sup' || prev.type === 'sub' || prev.type === 'sqrt') {
      const slot: CasioSlotName =
        prev.type === 'sup' ? 'exp' : prev.type === 'sub' ? 'sub' : 'radicand';
      const arr = getSlotArray(prev, slot) ?? [];
      return {
        nodes: state.nodes,
        cursor: {
          path: [...state.cursor.path, { nodeId: prev.id, slot }],
          index: arr.length,
        },
      };
    }
    return {
      nodes: state.nodes,
      cursor: { path: state.cursor.path, index: idx - 1 },
    };
  }

  if (state.cursor.path.length === 0) return state;

  const seg = state.cursor.path[state.cursor.path.length - 1];
  const parentPath = state.cursor.path.slice(0, -1);
  const parentList = getListAtPath(state.nodes, parentPath);
  const containerIdx = parentList.findIndex((n) => n.id === seg.nodeId);
  if (containerIdx < 0) return state;
  const container = parentList[containerIdx];

  if (container.type === 'frac' && seg.slot === 'den') {
    return {
      nodes: state.nodes,
      cursor: {
        path: [...parentPath, { nodeId: container.id, slot: 'num' }],
        index: container.num.length,
      },
    };
  }

  return {
    nodes: state.nodes,
    cursor: { path: parentPath, index: containerIdx },
  };
}

export function moveRight(state: CasioEditorState): CasioEditorState {
  const list = getListAtPath(state.nodes, state.cursor.path);
  const idx = state.cursor.index;

  if (idx < list.length) {
    const curr = list[idx];
    if (curr.type === 'frac') {
      return {
        nodes: state.nodes,
        cursor: {
          path: [...state.cursor.path, { nodeId: curr.id, slot: 'num' }],
          index: 0,
        },
      };
    }
    if (curr.type === 'sup' || curr.type === 'sub' || curr.type === 'sqrt') {
      const slot: CasioSlotName =
        curr.type === 'sup' ? 'exp' : curr.type === 'sub' ? 'sub' : 'radicand';
      return {
        nodes: state.nodes,
        cursor: {
          path: [...state.cursor.path, { nodeId: curr.id, slot }],
          index: 0,
        },
      };
    }
    return {
      nodes: state.nodes,
      cursor: { path: state.cursor.path, index: idx + 1 },
    };
  }

  if (state.cursor.path.length === 0) return state;

  const seg = state.cursor.path[state.cursor.path.length - 1];
  const parentPath = state.cursor.path.slice(0, -1);
  const parentList = getListAtPath(state.nodes, parentPath);
  const containerIdx = parentList.findIndex((n) => n.id === seg.nodeId);
  if (containerIdx < 0) return state;
  const container = parentList[containerIdx];

  if (container.type === 'frac' && seg.slot === 'num') {
    return {
      nodes: state.nodes,
      cursor: {
        path: [...parentPath, { nodeId: container.id, slot: 'den' }],
        index: 0,
      },
    };
  }

  return {
    nodes: state.nodes,
    cursor: { path: parentPath, index: containerIdx + 1 },
  };
}

export function moveVertical(
  state: CasioEditorState,
  direction: 'up' | 'down'
): CasioEditorState {
  for (let i = state.cursor.path.length - 1; i >= 0; i--) {
    const seg = state.cursor.path[i];
    if (direction === 'up' && seg.slot === 'den') {
      const parentPath = state.cursor.path.slice(0, i);
      const parentList = getListAtPath(state.nodes, parentPath);
      const frac = parentList.find((n) => n.id === seg.nodeId);
      if (frac?.type === 'frac') {
        return {
          nodes: state.nodes,
          cursor: {
            path: [...parentPath, { nodeId: frac.id, slot: 'num' }],
            index: Math.min(state.cursor.index, frac.num.length),
          },
        };
      }
    }
    if (direction === 'down' && seg.slot === 'num') {
      const parentPath = state.cursor.path.slice(0, i);
      const parentList = getListAtPath(state.nodes, parentPath);
      const frac = parentList.find((n) => n.id === seg.nodeId);
      if (frac?.type === 'frac') {
        return {
          nodes: state.nodes,
          cursor: {
            path: [...parentPath, { nodeId: frac.id, slot: 'den' }],
            index: Math.min(state.cursor.index, frac.den.length),
          },
        };
      }
    }
  }
  return state;
}

function isSimplePlainAtom(nodes: CasioNode[]): boolean {
  if (nodes.length === 0) return true;
  if (nodes.length === 1) {
    return nodes[0].type === 'char' || nodes[0].type === 'sqrt';
  }
  return nodes.every(
    (n) =>
      n.type === 'sub' ||
      (n.type === 'char' && /^[A-Za-z0-9_.ωθφαβγδλστμεΩπ]$/.test(n.value))
  );
}

export function serializeToPlain(nodes: CasioNode[]): string {
  let out = '';
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'char') {
      if (n.value === '=') out += ' = ';
      else if (n.value === '+' || n.value === '-') {
        const prev = i > 0 ? nodes[i - 1] : null;
        const unary =
          !prev ||
          (prev.type === 'char' && /^[(=+\-*,]$/.test(prev.value));
        out += unary ? n.value : ` ${n.value} `;
      } else {
        out += n.value;
      }
    } else if (n.type === 'frac') {
      const numPlain = serializeToPlain(n.num) || '0';
      const denPlain = serializeToPlain(n.den) || '1';
      const nWrapped = isSimplePlainAtom(n.num) ? numPlain : `(${numPlain})`;
      const dWrapped = isSimplePlainAtom(n.den) ? denPlain : `(${denPlain})`;
      out += `${nWrapped}/${dWrapped}`;
    } else if (n.type === 'sup') {
      const expPlain = serializeToPlain(n.exp);
      if (expPlain) {
        const wrapped = isSimplePlainAtom(n.exp) ? expPlain : `(${expPlain})`;
        out += `^${wrapped}`;
      }
    } else if (n.type === 'sub') {
      const subPlain = serializeToPlain(n.sub);
      if (subPlain) {
        out += subPlain;
      }
    } else if (n.type === 'sqrt') {
      const radPlain = serializeToPlain(n.radicand);
      out += `sqrt(${radPlain})`;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

const CHAR_TO_LATEX: Record<string, string> = {
  'ω': '\\omega ',
  'θ': '\\theta ',
  'Ω': '\\Omega ',
  'μ': '\\mu ',
  'π': '\\pi ',
  'φ': '\\phi ',
  'α': '\\alpha ',
  'β': '\\beta ',
  'γ': '\\gamma ',
  'δ': '\\delta ',
  'λ': '\\lambda ',
  'σ': '\\sigma ',
  'τ': '\\tau ',
  'ε': '\\varepsilon ',
  '∞': '\\infty ',
  '∠': '\\angle ',
  '°': '^\\circ ',
  '∥': '\\parallel ',
  '*': ' \\cdot ',
  '·': ' \\cdot ',
};

export function serializeToLatex(nodes: CasioNode[]): string {
  let out = '';
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'char') {
      if (n.value === '=') {
        out += ' = ';
      } else if (n.value === '+' || n.value === '-') {
        const prev = i > 0 ? nodes[i - 1] : null;
        const unary =
          !prev ||
          (prev.type === 'char' && /^[(=+\-*,]$/.test(prev.value));
        out += unary ? n.value : ` ${n.value} `;
      } else {
        out += CHAR_TO_LATEX[n.value] ?? n.value;
      }
    } else if (n.type === 'frac') {
      const numTex = serializeToLatex(n.num) || '\\square';
      const denTex = serializeToLatex(n.den) || '\\square';
      out += `\\frac{${numTex}}{${denTex}}`;
    } else if (n.type === 'sup') {
      const expTex = serializeToLatex(n.exp) || '\\square';
      out += `^{${expTex}}`;
    } else if (n.type === 'sub') {
      const subTex = serializeToLatex(n.sub) || '\\square';
      out += `_{${subTex}}`;
    } else if (n.type === 'sqrt') {
      const radTex = serializeToLatex(n.radicand) || '\\square';
      out += `\\sqrt{${radTex}}`;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Parses a plain-text math string (like `(V1 - Vs)/R1 + (V1 - V2)/R2 = 0` or
 * `x = (-b + sqrt(b^2 - 4*a*c)) / (2*a)`) into Casio Natural Display nodes.
 */
export function parseTextToCasioNodes(text: string): CasioNode[] {
  const clean = text.trim();
  if (!clean) return [];

  let pos = 0;

  const skipSpaces = () => {
    while (pos < clean.length && clean[pos] === ' ') pos += 1;
  };

  function parseSequence(stopAtCloseParen: boolean): CasioNode[] {
    const out: CasioNode[] = [];

    while (pos < clean.length) {
      skipSpaces();
      if (pos >= clean.length) break;
      const ch = clean[pos];

      if (stopAtCloseParen && ch === ')') {
        pos += 1;
        return out;
      }

      if (ch === '/') {
        pos += 1;
        skipSpaces();
        // Pull numerator from end of `out`
        let pullStart = out.length;
        let stripParens = false;
        if (
          out.length > 0 &&
          out[out.length - 1].type === 'char' &&
          (out[out.length - 1] as { value: string }).value === ')'
        ) {
          let depth = 0;
          for (let i = out.length - 1; i >= 0; i--) {
            const node = out[i];
            if (node.type === 'char' && node.value === ')') depth += 1;
            else if (node.type === 'char' && node.value === '(') depth -= 1;
            if (depth === 0) {
              pullStart = i;
              stripParens = true;
              break;
            }
          }
        } else {
          while (pullStart > 0 && isNumeratorAtom(out[pullStart - 1])) {
            pullStart -= 1;
          }
        }
        let num = out.splice(pullStart);
        if (stripParens && num.length >= 2) {
          num = num.slice(1, -1);
        }
        const den = parsePrimaryOperand();
        out.push({ id: nextId('frac'), type: 'frac', num, den });
        continue;
      }

      if (ch === '^') {
        pos += 1;
        const exp = parsePrimaryOperand();
        out.push({ id: nextId('sup'), type: 'sup', exp });
        continue;
      }

      if (ch === '_') {
        pos += 1;
        const sub = parsePrimaryOperand();
        out.push({ id: nextId('sub'), type: 'sub', sub });
        continue;
      }

      if (clean.slice(pos, pos + 5).toLowerCase() === 'sqrt(') {
        pos += 5;
        const radicand = parseSequence(true);
        out.push({ id: nextId('sqrt'), type: 'sqrt', radicand });
        continue;
      }

      // Auto-subscript trailing digits or source tag on EE identifiers like V1, R1, V2, Vs, Is
      if (
        /[A-Za-z]/.test(ch) &&
        pos + 1 < clean.length &&
        (/[0-9]/.test(clean[pos + 1]) ||
          ((ch === 'V' || ch === 'I') &&
            clean[pos + 1] === 's' &&
            (pos + 2 >= clean.length || !/[A-Za-z0-9]/.test(clean[pos + 2])))) &&
        (pos === 0 || !/[A-Za-z0-9]/.test(clean[pos - 1]))
      ) {
        out.push({ id: nextId('ch'), type: 'char', value: ch });
        pos += 1;
        const subChars: CasioNode[] = [];
        if (clean[pos] === 's') {
          subChars.push({ id: nextId('ch'), type: 'char', value: 's' });
          pos += 1;
        } else {
          while (pos < clean.length && /[0-9]/.test(clean[pos])) {
            subChars.push({ id: nextId('ch'), type: 'char', value: clean[pos] });
            pos += 1;
          }
        }
        out.push({ id: nextId('sub'), type: 'sub', sub: subChars });
        continue;
      }

      out.push({ id: nextId('ch'), type: 'char', value: ch });
      pos += 1;
    }

    return out;
  }

  function parsePrimaryOperand(): CasioNode[] {
    skipSpaces();
    if (pos >= clean.length) return [];

    if (clean[pos] === '(') {
      pos += 1;
      return parseSequence(true);
    }

    if (clean.slice(pos, pos + 5).toLowerCase() === 'sqrt(') {
      pos += 5;
      const radicand = parseSequence(true);
      return [{ id: nextId('sqrt'), type: 'sqrt', radicand }];
    }

    const atom: CasioNode[] = [];
    while (pos < clean.length && /[A-Za-z0-9_.ωθφαβγδλστμεΩπ]/.test(clean[pos])) {
      const ch = clean[pos];
      if (
        atom.length === 1 &&
        atom[0].type === 'char' &&
        /[A-Za-z]/.test(atom[0].value) &&
        /[0-9]/.test(ch)
      ) {
        const subChars: CasioNode[] = [];
        while (pos < clean.length && /[0-9]/.test(clean[pos])) {
          subChars.push({ id: nextId('ch'), type: 'char', value: clean[pos] });
          pos += 1;
        }
        atom.push({ id: nextId('sub'), type: 'sub', sub: subChars });
        break;
      }
      atom.push({ id: nextId('ch'), type: 'char', value: ch });
      pos += 1;
    }

    if (pos < clean.length && clean[pos] === '^') {
      pos += 1;
      atom.push({ id: nextId('sup'), type: 'sup', exp: parsePrimaryOperand() });
    }
    return atom;
  }

  return parseSequence(false);
}
