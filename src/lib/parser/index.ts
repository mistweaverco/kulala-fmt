import * as fs from "fs";
import { fileWalker } from "./../filewalker";
import { DocumentParser } from "./DocumentParser";

type CheckedFiles = {
  filepath: string;
  isValid: boolean;
};

const isFileValid = (filepath: string): boolean => {
  const content = fs.readFileSync(filepath, "utf-8");
  const document = DocumentParser.parse(content);
  console.log(document.variables);
  for (const block of document.blocks) {
    console.log(block.request);
  }
  return true;
};

/**
 * Checks the validity of HTTP files in the given directory.
 *
 * @param {string} dirPath The directory path to check.
 * @param {string[]} extensions An array of file extensions to filter by (e.g., ['.http', '.rest']).
 * @returns {CheckedFiles[]} An array of CheckedFiles objects.
 */
export const check = (
  dirPath: string | null,
  extensions: string[] | undefined = undefined,
): CheckedFiles[] => {
  if (!dirPath) {
    dirPath = process.cwd();
  }
  if (!extensions) {
    extensions = [".http", ".rest"];
  }
  const files = fileWalker(dirPath, extensions);
  const checkedFiles: CheckedFiles[] = [];
  for (const file of files) {
    const isValid = isFileValid(file);
    checkedFiles.push({ filepath: file, isValid });
  }
  return checkedFiles;
};
