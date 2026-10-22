import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** A note (or source file) from the repository, with CRLF normalised and any BOM removed. */
export function noteText(repoRelative: string): string {
  return readFileSync(path.join(REPO, ...repoRelative.split('/')), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
}
