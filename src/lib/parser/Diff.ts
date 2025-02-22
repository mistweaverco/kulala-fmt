import "colors";
import * as diff from "diff";

export const Diff = (build: string, content: string) => {
  const d = diff.diffChars(content, build);

  d.forEach((part) => {
    // green for additions, red for deletions
    const text = part.added
      ? part.value.bgGreen
      : part.removed
        ? part.value.bgRed
        : part.value;
    process.stderr.write(text);
  });

  console.log();
};
