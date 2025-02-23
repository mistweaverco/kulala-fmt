import * as fs from "fs";
import chalk from "chalk";
import yaml from "js-yaml";
import { fileWalker } from "./../filewalker";
import { DocumentParser } from "./DocumentParser";
import { DocumentBuilder } from "./DocumentBuilder";
import { Diff } from "./Diff";
import { OpenAPIDocumentParser, OpenAPISpec } from "./OpenAPIDocumentParser";
import { PostmanDocumentParser } from "./PostmanDocumentParser";
import { BrunoDocumentParser } from "./BrunoDocumentParser";

const OpenAPIParser = new OpenAPIDocumentParser();
const PostmanParser = new PostmanDocumentParser();
const BrunoParser = new BrunoDocumentParser();

const getOpenAPISpecAsJSON = (filepath: string): OpenAPISpec => {
  if (filepath.endsWith(".yaml") || filepath.endsWith(".yml")) {
    return yaml.load(fs.readFileSync(filepath, "utf-8")) as OpenAPISpec;
  }
  return JSON.parse(fs.readFileSync(filepath, "utf-8")) as OpenAPISpec;
};

const isFileValid = async (
  filepath: string,
  options: { body: boolean },
): Promise<[boolean, string, string]> => {
  const content = fs.readFileSync(filepath, "utf-8");
  const document = DocumentParser.parse(content);
  const build = await DocumentBuilder.build(document, options.body);
  return [content === build, content, build];
};

const fixFile = async (
  filepath: string,
  formatBody: boolean,
): Promise<boolean> => {
  const content = fs.readFileSync(filepath, "utf-8");
  const document = DocumentParser.parse(content);
  const build = await DocumentBuilder.build(document, formatBody);
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
 * @param {{ verbose: boolean; body: boolean }} options The options to use.
 * @param {string[]} extensions An array of file extensions to filter by (e.g., ['.http', '.rest']).
 * @returns {CheckedFiles[]} An array of CheckedFiles objects.
 */
export const check = async (
  dirPath: string | null,
  options: { verbose: boolean; body: boolean },
  extensions: string[] | undefined = undefined,
): Promise<void> => {
  if (!dirPath) {
    dirPath = process.cwd();
  }
  if (!extensions) {
    extensions = [".http", ".rest"];
  }
  const files = fileWalker(dirPath, extensions);
  for (const file of files) {
    const [isValid, content, build] = await isFileValid(file, options);
    if (!isValid) {
      console.log(chalk.red(`Invalid file: ${file}`));
      if (options.verbose) {
        Diff(build, content);
      }
    } else {
      console.log(chalk.green(`Valid file: ${file}`));
    }
  }
};

export const format = async (
  dirPath: string | null,
  options: { body: boolean },
  extensions: string[] | undefined = undefined,
): Promise<void> => {
  if (!dirPath) {
    dirPath = process.cwd();
  }
  if (!extensions) {
    extensions = [".http", ".rest"];
  }
  const files = fileWalker(dirPath, extensions);
  for (const file of files) {
    const neededFix = await fixFile(file, options.body);
    if (neededFix) {
      console.log(chalk.yellow(`Formatted file: ${file}`));
    } else {
      console.log(chalk.green(`Valid file: ${file}`));
    }
  }
};

const convertFromOpenAPI = async (files: string[]): Promise<void> => {
  for (const file of files) {
    const json = getOpenAPISpecAsJSON(file);
    const { documents, serverUrls } = OpenAPIParser.parse(json);
    serverUrls.forEach(async (serverUrl, index) => {
      const build = await DocumentBuilder.build(documents[index]);
      const outputFilename = file.replace(/\.[^/.]+$/, `.${serverUrl}.http`);
      fs.writeFileSync(outputFilename, build, "utf-8");
      console.log(
        chalk.green(
          `Converted OpenAPI spec file: ${file} --> ${outputFilename}`,
        ),
      );
    });
  }
};

const convertFromPostman = async (files: string[]): Promise<void> => {
  for (const file of files) {
    const json = JSON.parse(fs.readFileSync(file, "utf-8"));
    const { document } = PostmanParser.parse(json);
    const build = await DocumentBuilder.build(document);
    const outputFilename = file.replace(/\.[^/.]+$/, ".http");
    fs.writeFileSync(outputFilename, build, "utf-8");
    console.log(
      chalk.green(
        `Converted PostMan Collection file: ${file} --> ${outputFilename}`,
      ),
    );
  }
};

const convertFromBruno = async (files: string[]): Promise<void> => {
  const { documents, environmentNames, collectionName } = BrunoParser.parse(
    files[0],
  );
  environmentNames.forEach(async (envName, idx) => {
    const build = await DocumentBuilder.build(documents[idx]);
    const outputFilename = `${collectionName}.${envName}.http`;
    fs.writeFileSync(outputFilename, build, "utf-8");
    console.log(
      chalk.green(
        `Converted Bruno collection: ${files[0]} --> ${outputFilename}`,
      ),
    );
  });
};

const invalidFormat = (t: "src" | "dest", format: string): void => {
  console.log(chalk.red(`Invalid ${t} format ${format}.`));
  process.exit(1);
};

export const convert = async (
  options: { from: string; to: string },
  files: string[],
): Promise<void> => {
  switch (options.from) {
    case "openapi":
      switch (options.to) {
        case "http":
          await convertFromOpenAPI(files);
          break;
        default:
          invalidFormat("dest", options.to);
      }
      break;
    case "postman":
      switch (options.to) {
        case "http":
          await convertFromPostman(files);
          break;
        default:
          invalidFormat("dest", options.to);
      }
      break;
    case "bruno":
      switch (options.to) {
        case "http":
          await convertFromBruno(files);
          break;
        default:
          invalidFormat("dest", options.to);
      }
      break;
    default:
      invalidFormat("src", options.from);
  }
};
