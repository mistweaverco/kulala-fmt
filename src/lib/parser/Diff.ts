import { diffLines } from "diff";
import pc from "picocolors";

export const Diff = (build: string, content: string) => {
  const changes = diffLines(content, build);
  const hasChanges = changes.some((part) => part.added || part.removed);
  if (!hasChanges) {
    console.log(pc.green("No changes detected!"));
    process.exit(0);
  }
  changes.forEach((part) => {
    const lines = part.value.split("\n");
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
    lines.forEach((line) => {
      if (part.added) {
        console.log(pc.green(`+ ${line}`));
      } else if (part.removed) {
        console.log(pc.red(`- ${line}`));
      } else {
        console.log(pc.gray(`  ${line}`));
      }
    });
  });

  console.log();
};
