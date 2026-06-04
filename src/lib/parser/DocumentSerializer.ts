import type { Document } from "./DocumentParser";

function replaceCommentPrefix(comment: string): string {
  return comment.replace(/^(\/\/)/, "#");
}

/** Serialize a local Document to rough .http text for kulala-core to format. */
export function documentToHttp(document: Document): string {
  let output = "";

  for (const variable of document.variables) {
    output += `@${variable.key} = ${variable.value}\n`;
  }
  if (document.variables.length > 0) {
    output += "\n";
  }

  for (const block of document.blocks) {
    const requestSeparatorText = block.requestSeparator.text
      ? ` ${block.requestSeparator.text}`
      : "";
    output += `\n###${requestSeparatorText}\n\n`;

    for (const comment of block.comments) {
      output += `${replaceCommentPrefix(comment)}`;
    }

    for (const script of block.preRequestScripts) {
      output += `< ${script.script}\n`;
    }

    for (const metadata of block.metadata) {
      output += `# @${metadata.key} ${metadata.value}\n`;
    }

    if (block.request) {
      output += `${block.request.method} ${block.request.url}`;
      if (
        block.request.httpVersion !== "" &&
        !["WS", "WSS"].includes(block.request.method.toUpperCase())
      ) {
        output += ` ${block.request.httpVersion}\n`;
      } else {
        output += "\n";
      }

      for (const header of block.request.headers) {
        output += `${header.key}: ${header.value}\n`;
      }

      if (block.request.body) {
        output += `\n${block.request.body.trim()}\n`;
      }
    }

    for (const script of block.postRequestScripts) {
      output += `\n> ${script.script}\n`;
    }

    if (block.responseRedirect) {
      output += `\n${block.responseRedirect.trim()}\n`;
    }
  }

  return output.trim() + "\n";
}
