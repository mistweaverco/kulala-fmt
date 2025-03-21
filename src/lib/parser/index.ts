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
import * as process from "process";

const OpenAPIParser = new OpenAPIDocumentParser();
const PostmanParser = new PostmanDocumentParser();
const BrunoParser = new BrunoDocumentParser();

const getOpenAPISpecAsJSON = (filepath: string): OpenAPISpec => {
  if (filepath.endsWith(".yaml") || filepath.endsWith(".yml")) {
    return yaml.load(fs.readFileSync(filepath, "utf-8")) as OpenAPISpec;
  }
  return JSON.parse(fs.readFileSync(filepath, "utf-8")) as OpenAPISpec;
};

const isAlreadyPretty = async (
  filepath: string,
  options: { body: boolean },
): Promise<[boolean | null, string, string]> => {
  const content = fs.readFileSync(filepath, "utf-8");
  const document = DocumentParser.parse(content);
  if (!document) {
    return [null, content, ""];
  }
  const build = await DocumentBuilder.build(document, options.body);
  return [content === build, content, build];
};

const makeFilePretty = async (
  filepath: string,
  formatBody: boolean,
): Promise<boolean | null> => {
  const content = fs.readFileSync(filepath, "utf-8");
  const document = DocumentParser.parse(content);
  // if document is null, that means we had an error parsing the file
  if (!document) {
    return null;
  }
  const build = await DocumentBuilder.build(document, formatBody);
  const isPretty = content === build;
  if (!isPretty) {
    fs.writeFileSync(filepath, build, "utf-8");
  }
  return isPretty;
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
  let errorHappened = false;
  const files = fileWalker(dirPath, extensions);
  for (const file of files) {
    const [isPretty, content, build] = await isAlreadyPretty(file, options);
    if (isPretty === false) {
      console.log(chalk.yellow(`File not pretty: ${file}`));
      if (options.verbose) {
        Diff(build, content);
      }
    } else if (isPretty === null) {
      console.log(chalk.red(`Error parsing file: ${file}`));
      errorHappened = true;
    } else {
      console.log(chalk.green(`Valid file: ${file}`));
    }
  }
  if (errorHappened) {
    process.exit(1);
  }
};

const getStdinContent = () => {
  return new Promise<string>((resolve, reject) => {
    let content = "";

    process.stdin.on("data", (d) => {
      content += d.toString();
    });

    process.stdin.on("end", () => {
      resolve(content);
    });

    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
};

export const formatStdin = async () => {
  const content = await getStdinContent();

  console.log(content);
};

export const format = async (
  dirPath: string | null,
  options: { body: boolean; stdin: boolean },
  extensions: string[] | undefined = undefined,
): Promise<void> => {
  if (options?.stdin) {
    await formatStdin();
    return;
  }

  if (!dirPath) {
    dirPath = process.cwd();
  }
  if (!extensions) {
    extensions = [".http", ".rest"];
  }
  let errorHappened = false;
  const files = fileWalker(dirPath, extensions);
  for (const file of files) {
    const isPretty = await makeFilePretty(file, options.body);
    if (isPretty === false) {
      console.log(chalk.yellow(`Formatted file: ${file}`));
    } else if (isPretty === null) {
      console.log(chalk.red(`Error parsing file: ${file}`));
      errorHappened = true;
    } else {
      console.log(chalk.green(`Valid file: ${file}`));
    }
  }
  if (errorHappened) {
    process.exit(1);
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
