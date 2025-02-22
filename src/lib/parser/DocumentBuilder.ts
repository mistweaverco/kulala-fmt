import type { Document } from "./DocumentParser";

function headerToPascalCase(str: string) {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");
}

const build = (document: Document): string => {
  let output = "";
  for (const variable of document.variables) {
    output += `@${variable.key} = ${variable.value}\n`;
  }
  output += "\n\n";
  for (const block of document.blocks) {
    if (block.comments.length > 0) {
      for (const comment of block.comments) {
        output += `${comment}`;
      }
    }
    if (block.preRequestScripts.length > 0) {
      for (const script of block.preRequestScripts) {
        output += `< ${script.script}\n`;
      }
    }
    if (block.metadata.length > 0) {
      for (const metadata of block.metadata) {
        output += `# @${metadata.key} ${metadata.value}\n`;
      }
    }
    if (block.request) {
      output += `${block.request.method} ${block.request.url} ${block.request.httpVersion}\n`;
      for (const header of block.request.headers) {
        let headerKey = header.key;
        switch (block.request.httpVersion) {
          case "HTTP/1.0":
            headerKey = headerToPascalCase(header.key);
            break;
          case "HTTP/1.1":
            headerKey = headerToPascalCase(header.key);
            break;
          case "HTTP/2":
            headerKey = header.key.toLowerCase();
            break;
          case "HTTP/3":
            headerKey = header.key.toLowerCase();
            break;
        }
        output += `${headerKey}: ${header.value}\n`;
      }
      if (block.request.body) {
        output += `\n${block.request.body.trim()}\n`;
      }
    }
    if (block.postRequestScripts.length > 0) {
      for (const script of block.postRequestScripts) {
        output += `\n> ${script.script}\n`;
      }
    }
    if (block.responseRedirect) {
      output += `\n${block.responseRedirect}\n`;
    }

    output += "\n###\n\n";
  }
  output = output.trim();
  return output;
};

export const DocumentBuilder = {
  build,
};
