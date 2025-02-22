import pkg from "./../package.json";
import { Command } from "commander";
import { check, format, convert } from "./lib/parser";
const program = new Command();

program
  .name("kulala-fmt")
  .description(
    "An opinionated 🦄 .http and .rest 🐼 files linter 💄 and formatter ⚡.",
  )
  .version(pkg.version);

program
  .command("format")
  .description("Format files")
  .argument("[files]", "files to include", null)
  .action((files) => {
    format(files);
  });

program
  .command("check")
  .description("Check if files are well formatted")
  .argument("[files]", "files to include", null)
  .option("-v, --verbose", "enable verbose mode", false)
  .action((files, options) => {
    check(options.verbose, files);
  });

program
  .command("convert")
  .description("Convert files to .http format")
  .argument("<files...>", "files to include")
  .option("--from", "source format", "openapi")
  .option("--to", "destination format", "http")
  .action((files, options) => {
    convert(options, files);
  });

program.parse();
