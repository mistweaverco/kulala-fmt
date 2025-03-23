import * as fs from "fs";
import path from "path";
import yaml from "js-yaml";
import chalk from "chalk";
import readline from "readline";

const CONFIG_FILENAME = "kulala-fmt.yaml";

export interface Config {
  defaults: {
    http_method: string;
    http_version: string;
  };
}

const DEFAULT_CONFIG: Config = {
  defaults: {
    http_method: "GET",
    http_version: "HTTP/1.1",
  },
};

const init = (): void => {
  const file = path.join(process.cwd(), CONFIG_FILENAME);
  const configHeader = `# yaml-language-server: $schema=https://fmt.getkulala.net/schema.json\n---\n`;
  if (fs.existsSync(file)) {
    console.log(chalk.red(`🦄 Config file already exists: ${file}`));
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      `Do you want to overwrite the file? (y/N) `,
      (answer: string) => {
        if (answer.toLowerCase() === "y") {
          fs.writeFileSync(file, configHeader + yaml.dump(DEFAULT_CONFIG));
          console.log(chalk.green(`🦄 Config file written: ${file}`));
        } else if (answer.toLowerCase() === "n") {
          console.log(chalk.yellow("🦄 Exiting..."));
        } else {
          console.log(chalk.red("🦄 Invalid input"));
        }
        rl.close();
      },
    );
  } else {
    fs.writeFileSync(file, configHeader + yaml.dump(DEFAULT_CONFIG));
    console.log(chalk.green(`🦄 Config file written: ${file}`));
  }
};

const parse = (): Config => {
  const file = path.join(process.cwd(), CONFIG_FILENAME);
  if (!fs.existsSync(file)) {
    return DEFAULT_CONFIG;
  }
  const content = fs.readFileSync(file, "utf8");
  const json = yaml.load(content) as Config;
  return { ...DEFAULT_CONFIG, ...json };
};

export const configparser = {
  init,
  parse,
};
