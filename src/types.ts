export type ThemeMode = 'dark' | 'light';

export type CopyFormat = 'latex' | 'markdown' | 'mathml';

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  points: StrokePoint[];
  mode: 'pen' | 'eraser';
  width: number;
}

export interface ReadableEquation {
  id: string;
  latex: string;
  plain: string;
  title?: string;
  source: 'handwritten' | 'typed' | 'photo';
  createdAt: number;
}

export type LineKind =
  | 'blank'
  | 'heading'
  | 'text'
  | 'assignment'
  | 'expression'
  | 'equation';

export interface EvaluatedLineResult {
  lineId: string;
  kind: LineKind;
  displayValue: string;
  secondaryValue?: string;
  latex: string;
  isError?: boolean;
  errorMessage?: string;
  isComplex?: boolean;
}

export interface SlashTemplate {
  command: string;
  label: string;
  description: string;
  lines: string[];
}

export interface ShortcutDoc {
  keys: string;
  action: string;
  category:
    | 'Handwriting Pad'
    | 'Typing & Equations'
    | 'Workspace & Export'
    | 'Video'
    | 'Notebook'
    | 'Math & Solver'
    | 'Layout & Workspace';
}
