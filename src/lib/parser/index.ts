import * as fs from "fs";
import chalk from "chalk";
import yaml from "js-yaml";
import { fileWalker } from "./../filewalker";
import { DocumentParser } from "./DocumentParser";
import { DocumentBuilder } from "./DocumentBuilder";
import { Diff } from "./Diff";
import { OpenAPIDocumentParser, OpenAPISpec } from "./OpenAPIDocumentParser";

const OpenAPIParser = new OpenAPIDocumentParser();

const getOpenAPISpecAsJSON = (filepath: string): OpenAPISpec => {
  if (filepath.endsWith(".yaml") || filepath.endsWith(".yml")) {
    return yaml.load(fs.readFileSync(filepath, "utf-8")) as OpenAPISpec;
  }
  return JSON.parse(fs.readFileSync(filepath, "utf-8")) as OpenAPISpec;
};

const isFileValid = (filepath: string): [boolean, string, string] => {
  const content = fs.readFileSync(filepath, "utf-8");
  const document = DocumentParser.parse(content);
  const build = DocumentBuilder.build(document);
  return [content === build, content, build];
};

const fixFile = (filepath: string): boolean => {
  const content = fs.readFileSync(filepath, "utf-8");
  const document = DocumentParser.parse(content);
  const build = DocumentBuilder.build(document);
  const isValid = content === build;
  if (!isValid) {
    fs.writeFileSync(filepath, build, "utf-8");
  }
  return !isValid;
};

/**
 * Checks the validity of HTTP files in the given directory.
 *
 * @param {string} dirPath The directory path to check.
 * @param {string[]} extensions An array of file extensions to filter by (e.g., ['.http', '.rest']).
 * @returns {CheckedFiles[]} An array of CheckedFiles objects.
 */
export const check = (
  verbose: boolean = false,
  dirPath: string | null,
  extensions: string[] | undefined = undefined,
): void => {
  if (!dirPath) {
    dirPath = process.cwd();
  }
  if (!extensions) {
    extensions = [".http", ".rest"];
  }
  const files = fileWalker(dirPath, extensions);
  for (const file of files) {
    const [isValid, content, build] = isFileValid(file);
    if (!isValid) {
      console.log(chalk.red(`Invalid file: ${file}`));
      if (verbose) {
        Diff(build, content);
      }
    } else {
      console.log(chalk.green(`Valid file: ${file}`));
    }
  }
};

export const format = (
  dirPath: string | null,
  extensions: string[] | undefined = undefined,
): void => {
  if (!dirPath) {
    dirPath = process.cwd();
  }
  if (!extensions) {
    extensions = [".http", ".rest"];
  }
  const files = fileWalker(dirPath, extensions);
  for (const file of files) {
    const neededFix = fixFile(file);
    if (neededFix) {
      console.log(chalk.yellow(`Formatted file: ${file}`));
    } else {
      console.log(chalk.green(`Valid file: ${file}`));
    }
  }
};

export const convert = (
  options: { from: string; to: string },
  files: string[],
): void => {
  for (const file of files) {
    const json = getOpenAPISpecAsJSON(file);
    const { documents, serverUrls } = OpenAPIParser.parse(json);
    serverUrls.forEach((serverUrl, index) => {
      const build = DocumentBuilder.build(documents[index]);
      const outputFilename = file.replace(/\.[^/.]+$/, `.${serverUrl}.http`);
      fs.writeFileSync(outputFilename, build, "utf-8");
      console.log(chalk.green(`Converted file: ${file} --> ${outputFilename}`));
    });
  }
};
