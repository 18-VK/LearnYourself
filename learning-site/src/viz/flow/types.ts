/**
 * Data model for FlowDiagram: the boxes, arrows and ordered steps of one diagram from the notes.
 *
 * A diagram that replaces an ASCII block transcribes that block exactly: every node label, extra line
 * and edge label must appear in the original text (tests/unit/flow checks this against the note), in
 * the same order, with no extra boxes or arrows. Narration may quote the surrounding note text.
 */

export interface GridPos {
  /** 0-based row (top to bottom) in the wide layout */
  row: number;
  /** 0-based column; fractions centre a node between columns */
  col: number;
}

export interface FlowNode {
  id: string;
  /** First line of the box, exactly as written in the note. */
  label: string;
  /** Further lines inside the same box (sub-labels, bullets), exactly as written. */
  lines?: string[];
  /** Grid position for `layout: 'grid'` diagrams. */
  at?: GridPos;
  /** `plain` = text without a box in the original (an outcome or a note under an arrow). */
  kind?: 'box' | 'plain';
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  /** Text written on or beside the arrow in the original. */
  label?: string;
  /** Arrowheads at both ends (`<--->` in the original). */
  twoWay?: boolean;
  /** No arrowhead: a plain connector (tree branches). */
  plain?: boolean;
}

export interface FlowStep {
  /** Nodes highlighted in this step. Defaults to the edge's target (or source when `reverse`). */
  focus?: string[];
  /** The edge the token travels along to reach this step. */
  edge?: string;
  /** Travel the edge from `to` back to `from` (two-way edges). */
  reverse?: boolean;
  narration: string;
}

export interface FlowDiagramData {
  id: string;
  title: string;
  /** Where the original text lives: the `diagram:` placement must point at the same block. */
  source: { file: string; section: string; codeBlock: number; occurrence?: number };
  /**
   * chain = nodes in reading order (vertical on narrow screens, rows on wide ones);
   * grid  = authored positions (`at`) for branching or side-by-side diagrams;
   * tree  = an indented outline built from the edges (parent → child).
   */
  layout: 'chain' | 'grid' | 'tree';
  nodes: FlowNode[];
  edges: FlowEdge[];
  steps: FlowStep[];
}
