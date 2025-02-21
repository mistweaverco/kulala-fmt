import * as fs from "fs";
import * as path from "path";

/**
 * Walks a directory recursively and returns an array of file paths matching the given extensions.
 *
 * @param {string} dirPath The starting directory path.
 * @param {string[]} extensions An array of file extensions to filter by (e.g., ['.http', '.rest']).
 * @returns {string[]} An array of file paths matching the extensions.
 */
export function fileWalker(dirPath: string, extensions: string[]): string[] {
  const filePaths: string[] = [];
  const rootPath = path.resolve(dirPath); // Store the absolute root path

  function walk(currentPath: string) {
    const files = fs.readdirSync(currentPath);

    for (const file of files) {
      const filePath = path.join(currentPath, file);
      const stats = fs.lstatSync(filePath); // Use lstatSync to detect symlinks

      // Skip symbolic links
      if (stats.isSymbolicLink()) {
        continue;
      }

      if (stats.isDirectory()) {
        walk(filePath); // Recursive call for subdirectories
      } else if (stats.isFile()) {
        // Ensure case-insensitive matching on the file extension
        const ext = path.extname(filePath).toLowerCase();
        if (extensions.includes(ext)) {
          // Convert absolute path to relative path
          const relativePath = path.relative(rootPath, filePath);
          filePaths.push(relativePath);
        }
      }
    }
  }

  walk(rootPath);
  return filePaths;
}
