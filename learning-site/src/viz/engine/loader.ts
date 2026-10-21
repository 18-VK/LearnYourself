import type { ComponentType } from 'react';

/** What a visualizer module exports: a React component taking the placement's props. */
export interface VizModule {
  default: ComponentType<Record<string, unknown>>;
}
/** Loads a visualizer's code on demand, so each one is its own chunk fetched only when it scrolls into view. */
export type VizLoader = () => Promise<VizModule>;

/**
 * A code panel that shows C# (or SQL) copied from a note. The build fails if `code` no longer appears
 * verbatim inside some fenced block of `file`, so a visualizer can never show stale code.
 */
export interface VerbatimCheck {
  /** Shown in the error, e.g. "binary search visualizer". */
  label: string;
  /** Repo-relative note path, exact case. */
  file: string;
  /** The note heading the code sits under, for the error message. */
  heading: string;
  code: string;
  /** Which source files to update when the note changes. */
  fix: string;
}
