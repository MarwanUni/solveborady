import { ShortcutDoc, SlashTemplate } from '../types';

export interface SymbolShortcut {
  trigger: string;
  symbol: string;
  label: string;
}

/**
 * Prefix-free Greek & EE symbol shortcuts.
 * None of these triggers is a prefix of another, allowing instant expansion.
 */
export const SYMBOL_SHORTCUTS: SymbolShortcut[] = [
  { trigger: ':w', symbol: 'ω', label: 'omega (angular freq)' },
  { trigger: ':th', symbol: 'θ', label: 'theta (phase/angle)' },
  { trigger: ':ohm', symbol: 'Ω', label: 'Ohm (resistance)' },
  { trigger: ':mu', symbol: 'μ', label: 'micro (10^-6)' },
  { trigger: ':pi', symbol: 'π', label: 'pi' },
  { trigger: ':phi', symbol: 'φ', label: 'phi (flux/phase)' },
  { trigger: ':alpha', symbol: 'α', label: 'alpha' },
  { trigger: ':beta', symbol: 'β', label: 'beta' },
  { trigger: ':gamma', symbol: 'γ', label: 'gamma' },
  { trigger: ':delta', symbol: 'δ', label: 'delta' },
  { trigger: ':lambda', symbol: 'λ', label: 'lambda' },
  { trigger: ':sigma', symbol: 'σ', label: 'sigma' },
  { trigger: ':tau', symbol: 'τ', label: 'tau (time constant)' },
  { trigger: ':eps', symbol: 'ε', label: 'epsilon (permittivity)' },
  { trigger: ':inf', symbol: '∞', label: 'infinity' },
  { trigger: ':ang', symbol: '∠', label: 'phasor angle' },
  { trigger: ':deg', symbol: '°', label: 'degrees' },
  { trigger: ':par', symbol: '∥', label: 'parallel impedance' },
];

const VALID_PREFIX_BOUNDARY = /^$|[\s+\-*/^(=,[{]$/;

export function expandSymbolShortcut(
  text: string,
  cursorPos: number
): { nextText: string; nextCursorPos: number; expanded: boolean } {
  const before = text.slice(0, cursorPos);
  const after = text.slice(cursorPos);

  for (const item of SYMBOL_SHORTCUTS) {
    if (before.endsWith(item.trigger)) {
      const charBeforeTrigger = before.slice(
        0,
        before.length - item.trigger.length
      );
      const prevChar = charBeforeTrigger.slice(-1);
      if (VALID_PREFIX_BOUNDARY.test(prevChar)) {
        const nextBefore = charBeforeTrigger + item.symbol;
        return {
          nextText: nextBefore + after,
          nextCursorPos: nextBefore.length,
          expanded: true,
        };
      }
    }
  }

  return { nextText: text, nextCursorPos: cursorPos, expanded: false };
}

export const SLASH_TEMPLATES: SlashTemplate[] = [
  {
    command: '/kcl',
    label: 'Kirchhoff Current Law (KCL)',
    description: 'Sum of currents leaving a node equals zero',
    lines: [
      '# KCL at Node A',
      '(VA - Vs)/R1 + VA/R2 + (VA - VB)/R3 = 0',
      'I1 + I2 - Is = 0',
    ],
  },
  {
    command: '/kvl',
    label: 'Kirchhoff Voltage Law (KVL)',
    description: 'Sum of voltage drops around a closed loop',
    lines: [
      '# KVL Around Loop 1',
      '-Vs + I1*R1 + (I1 - I2)*R2 = 0',
      'VR1 = I1 * R1',
    ],
  },
  {
    command: '/nodal',
    label: 'Nodal Analysis (2-Node System)',
    description: 'Two-node circuit equations ready for Ctrl+Enter solver',
    lines: [
      '# Nodal Analysis',
      'Vs = 12',
      'R1 = 1k',
      'R2 = 2.2k',
      'R3 = 4.7k',
      '(V1 - Vs)/R1 + V1/R2 + (V1 - V2)/R3 = 0',
      '(V2 - V1)/R3 + V2/1k = 2m',
    ],
  },
  {
    command: '/mesh',
    label: 'Mesh Analysis (2-Loop System)',
    description: 'Two-mesh impedance equations ready for Ctrl+Enter solver',
    lines: [
      '# Mesh Analysis',
      'R1 = 100',
      'R2 = 220',
      'R3 = 330',
      '(R1 + R2)*I1 - R2*I2 = 10',
      '-R2*I1 + (R2 + R3)*I2 = -5',
    ],
  },
  {
    command: '/divider',
    label: 'Voltage & Current Divider',
    description: 'Resistive voltage divider & output calculation',
    lines: [
      '# Voltage Divider',
      'Vin = 12',
      'R1 = 4.7k',
      'R2 = 10k',
      'Vout = Vin * R2 / (R1 + R2)',
      'Idiv = Vin / (R1 + R2)',
    ],
  },
  {
    command: '/thevenin',
    label: 'Thevenin Equivalent',
    description: 'Open-circuit voltage, equivalent resistance & load transfer',
    lines: [
      '# Thevenin Equivalent',
      'Vth = 9',
      'Rth = 1.5k',
      'RL = 3.3k',
      'Vload = Vth * RL / (Rth + RL)',
      'Pmax = Vth^2 / (4 * Rth)',
    ],
  },
];

export const APP_SHORTCUTS: ShortcutDoc[] = [
  // Video
  { keys: 'Alt + Space', action: 'Play / Pause video (global)', category: 'Video' },
  { keys: 'Alt + Left / Right', action: 'Seek video -5s / +5s', category: 'Video' },
  { keys: 'Alt + Up / Down', action: 'Decrease / Increase speed (0.5x–2x)', category: 'Video' },
  { keys: 'Alt + T', action: 'Insert video timestamp tag @[MM:SS]', category: 'Video' },
  { keys: 'Enter (on timestamp)', action: 'Jump video to tagged timestamp', category: 'Video' },
  { keys: 'Alt + O / Enter', action: 'Focus video URL / Load URL', category: 'Video' },
  { keys: 'Alt + Shift + O', action: 'Open local video file picker', category: 'Video' },

  // Notebook
  { keys: 'Enter', action: 'Insert new line below (or apply /command)', category: 'Notebook' },
  { keys: 'Up / Down', action: 'Move cursor between lines', category: 'Notebook' },
  { keys: 'Shift + Up / Down', action: 'Select block of lines', category: 'Notebook' },
  { keys: 'Ctrl + Shift + L', action: 'Select contiguous equation block', category: 'Notebook' },
  { keys: 'Alt + A', action: 'Append new line at bottom', category: 'Notebook' },
  { keys: 'Alt + R', action: 'Rename active lecture notebook', category: 'Notebook' },
  { keys: 'Backspace (start)', action: 'Delete empty line / merge with previous', category: 'Notebook' },
  { keys: 'Ctrl + Shift + D', action: 'Duplicate current line', category: 'Notebook' },
  { keys: '/kcl, /nodal, /mesh...', action: 'Quick-insert EE template', category: 'Notebook' },
  { keys: ':w, :th, :ohm, :mu...', action: 'Insert Greek / EE symbols', category: 'Notebook' },

  // Math & Solver
  { keys: 'Ctrl + Enter', action: 'Solve selected linear equation system', category: 'Math & Solver' },
  { keys: 'Alt + I', action: 'Insert solved values into notebook', category: 'Math & Solver' },
  { keys: 'Alt + X', action: 'Close equation solver panel', category: 'Math & Solver' },
  { keys: 'Alt + E', action: 'Toggle KaTeX preview visibility', category: 'Math & Solver' },

  // Layout & Workspace
  { keys: 'Alt + L', action: 'Cycle layout (Split -> Notebook -> Video)', category: 'Layout & Workspace' },
  { keys: 'Alt + [ / ]', action: 'Resize split panes (-5% / +5%)', category: 'Layout & Workspace' },
  { keys: 'Alt + K', action: 'Open lecture notebooks switcher', category: 'Layout & Workspace' },
  { keys: 'Alt + Shift + N', action: 'Create new lecture notebook', category: 'Layout & Workspace' },
  { keys: 'Alt + PageUp / PageDown', action: 'Switch previous / next notebook', category: 'Layout & Workspace' },
  { keys: 'Alt + J', action: 'Toggle Dark / Light theme', category: 'Layout & Workspace' },
  { keys: 'Alt + M', action: 'Export current notebook as Markdown', category: 'Layout & Workspace' },
  { keys: 'Alt + P', action: 'Open Print / PDF view', category: 'Layout & Workspace' },
  { keys: '? / F1 / Ctrl + /', action: 'Open / close this shortcut cheat sheet', category: 'Layout & Workspace' },
  { keys: 'Esc', action: 'Close modal / clear line selection', category: 'Layout & Workspace' },
];
