import { diffChars, structuredPatch } from 'diff';
import pc from 'picocolors';

export type DiffOptions = {
  filepath?: string;
  context?: number;
};

const SIMILARITY_THRESHOLD = 0.6;

const colorRemoved = (text: string): string =>
  // eslint-disable-next-line typescript-eslint/no-misused-spread
  [...text]
    .map((ch) => {
      if (ch === ' ') {
        return pc.bgRed(pc.white(' '));
      }
      if (ch === '\t') {
        return pc.bgRed('→');
      }
      return pc.red(ch);
    })
    .join('');

const colorAdded = (text: string): string =>
  // eslint-disable-next-line typescript-eslint/no-misused-spread
  [...text]
    .map((ch) => {
      if (ch === ' ') {
        return pc.bgGreen(pc.white(' '));
      }
      if (ch === '\t') {
        return pc.bgGreen('→');
      }
      return pc.green(ch);
    })
    .join('');

const lineSimilarity = (oldLine: string, newLine: string): number => {
  const parts = diffChars(oldLine, newLine);
  const unchanged = parts
    .filter((part) => !part.added && !part.removed)
    .reduce((sum, part) => sum + part.value.length, 0);
  return unchanged / Math.max(oldLine.length, newLine.length, 1);
};

const pairAddedToRemoved = (removed: string[], added: string[]): (string | undefined)[] => {
  const addedToRemoved: (string | undefined)[] = added.map(() => undefined);
  const usedAdded = new Set<number>();

  for (let r = 0; r < removed.length; r++) {
    let bestIndex = -1;
    let bestSimilarity = SIMILARITY_THRESHOLD;

    for (let a = 0; a < added.length; a++) {
      if (usedAdded.has(a)) {
        continue;
      }
      const similarity = lineSimilarity(removed[r], added[a]);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = a;
      }
    }

    if (bestIndex >= 0) {
      addedToRemoved[bestIndex] = removed[r];
      usedAdded.add(bestIndex);
    }
  }

  return addedToRemoved;
};

const dimUnchanged = (text: string): string => pc.gray(text);

const renderInlineDiff = (oldLine: string, newLine: string): string => {
  if (oldLine === newLine) {
    return dimUnchanged(newLine);
  }

  const parts = diffChars(oldLine, newLine);
  let result = '';

  for (const part of parts) {
    if (part.removed) {
      result += colorRemoved(part.value);
    } else if (part.added) {
      result += colorAdded(part.value);
    } else {
      result += dimUnchanged(part.value);
    }
  }

  return result;
};

const renderOutcomeLine = (newLine: string, oldLine?: string): string => {
  if (oldLine === undefined) {
    return colorAdded(newLine);
  }
  return renderInlineDiff(oldLine, newLine);
};

const printOutcomeLine = (line: string, oldLine?: string): void => {
  console.log(` ${renderOutcomeLine(line, oldLine)}`);
};

const printChangeBlock = (removed: string[], added: string[]): void => {
  if (removed.length === added.length && removed.length > 0) {
    for (let j = 0; j < added.length; j++) {
      printOutcomeLine(added[j], removed[j]);
    }
    return;
  }

  const addedToRemoved = pairAddedToRemoved(removed, added);
  for (let j = 0; j < added.length; j++) {
    printOutcomeLine(added[j], addedToRemoved[j]);
  }
};

const printHunk = (lines: string[]): void => {
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line === '\\ No newline at end of file') {
      i++;
      continue;
    }

    if (line.startsWith(' ')) {
      console.log(` ${dimUnchanged(line.slice(1))}`);
      i++;
      continue;
    }

    if (line.startsWith('-')) {
      const removed: string[] = [];
      while (i < lines.length && lines[i].startsWith('-')) {
        removed.push(lines[i].slice(1));
        i++;
      }

      const added: string[] = [];
      while (i < lines.length && lines[i].startsWith('+')) {
        added.push(lines[i].slice(1));
        i++;
      }

      printChangeBlock(removed, added);
      continue;
    }

    if (line.startsWith('+')) {
      printOutcomeLine(line.slice(1));
    }

    i++;
  }
};

export const Diff = (build: string, content: string, options?: DiffOptions) => {
  const filepath = options?.filepath ?? 'file';
  const context = options?.context ?? 3;

  const patch = structuredPatch(filepath, filepath, content, build, undefined, undefined, {
    context,
  });

  if (patch.hunks.length === 0) {
    console.log(pc.green('No changes detected!'));
    return;
  }

  console.log(`--- ${filepath}`);
  console.log(`+++ ${filepath}`);

  for (const hunk of patch.hunks) {
    const oldRange = hunk.oldLines === 1 ? `${hunk.oldStart}` : `${hunk.oldStart},${hunk.oldLines}`;
    const newRange = hunk.newLines === 1 ? `${hunk.newStart}` : `${hunk.newStart},${hunk.newLines}`;

    console.log(pc.yellow(`@@ -${oldRange} +${newRange} @@`));
    printHunk(hunk.lines);
  }

  console.log();
};
