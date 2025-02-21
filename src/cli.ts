import pkg from "./../package.json";
import { Command } from "commander";
import { parse } from "./lib/parser";
const program = new Command();

program
  .name("kulala-fmt")
  .description(
    "An opinionated 🦄 .http and .rest 🐼 files linter 💄 and formatter ⚡.",
  )
  .version(pkg.version);

program
  .command("check")
  .description("Check if files are well formatted")
  .argument("[files]", "files to include", null)
  .option("-v, --verbose", "enable verbose mode", false)
  .action((files, options) => {
    const parsed = parse(files);
    if (options.verbose) {
      console.log("verbose mode is on");
    }
    console.log(parsed);
  });

program.parse();
