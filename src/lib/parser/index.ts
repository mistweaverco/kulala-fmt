import { fileWalker } from "./../filewalker";

export const parse = (
  dirPath: string | null,
  extensions: string[] | undefined = undefined,
): string[] => {
  if (!dirPath) {
    dirPath = process.cwd();
  }
  if (!extensions) {
    extensions = [".http", ".rest"];
  }
  return fileWalker(dirPath, extensions);
};
