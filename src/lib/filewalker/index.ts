import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

/**
 * Walks a directory recursively (or processes a single file) and returns an array of file paths
 * matching the given extensions.
 *
 * @param {string} inputPath The starting directory path or a file path.
 * @param {string[]} extensions An array of file extensions to filter by (e.g., ['.http', '.rest']).
 * @returns {string[]} An array of file paths matching the extensions.
 */
export function fileWalker(inputPath: string, extensions: string[]): string[] {
  const filePaths: string[] = [];
  const absolutePath = path.resolve(inputPath);
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(absolutePath);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(chalk.red(`Error: ${error.message}`));
    return filePaths;
  }

  // Define a root directory for computing relative paths.
  const rootDir: string = process.cwd();
  if (stats.isFile()) {
    const ext = path.extname(absolutePath).toLowerCase();
    if (extensions.includes(ext)) {
      // Return the file path relative to its parent directory.
      filePaths.push(path.relative(rootDir, absolutePath));
    }
    return filePaths;
  } else if (stats.isDirectory()) {
    // nothing to do here
  } else {
    // If it's neither a file nor a directory (e.g., a special file), return empty.
    return filePaths;
  }

  // Recursive directory walker.
  function walk(currentPath: string) {
    const files = fs.readdirSync(currentPath);
    for (const file of files) {
      const filePath = path.join(currentPath, file);
      const stats = fs.lstatSync(filePath);

      // Skip symbolic links
      if (stats.isSymbolicLink()) {
        continue;
      }

      if (stats.isDirectory()) {
        walk(filePath); // Recursive call for subdirectories
      } else if (stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        if (extensions.includes(ext)) {
          // Compute the relative path with respect to the root directory.
          filePaths.push(path.relative(rootDir, filePath));
        }
      }
    }
  }

  walk(rootDir);
  return filePaths;
}
