import * as prettier from "prettier";
import type { Document, Block, Header } from "./DocumentParser";

function headerToPascalCase(str: string) {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");
}

// Get header value based on case insensitive key
function getHeader(headers: Header[], key: string) {
  const header = headers.find(
    (header) => header.key.toLowerCase() === key.toLowerCase(),
  );
  return header?.value.toLowerCase();
}

const getFormatParser = (block: Block): null | "graphql" | "json" => {
  const headers = block.request?.headers || [];
  if (getHeader(headers, "x-request-type") === "graphql") {
    return "graphql";
  }
  if (getHeader(headers, "content-type") === "application/json") {
    return "json";
  }
  return null;
};

function replaceCommentPrefix(comment: string): string {
  return comment.replace(/^(\/\/)/, "#");
}

function preservePlaceholders(body: string) {
  const placeholderRegex = /(?<!")({{\$?\w+}})(?!")/g;
  const placeholders = new Map<string, string>();
  let replacedBody = body;

  replacedBody = replacedBody.replace(placeholderRegex, (match) => {
    const key = `__KULALA_FMT_PLACEHOLDER_${placeholders.size}__`;
    placeholders.set(key, match);
    return `"${key}"`;
  });
  replacedBody = replacedBody.replace(/""/g, "");

  return { replacedBody, placeholders };
}

function restorePlaceholders(
  formattedBody: string,
  placeholders: Map<string, string>,
) {
  let restoredBody = formattedBody;
  const placeholdersLength = placeholders.size;
  let idx = 0;
  placeholders.forEach((original, key) => {
    let firstQuote = "";
    let lastQuote = "";
    if (idx === 0) {
      firstQuote = '"';
    }
    if (idx === placeholdersLength - 1) {
      lastQuote = '"';
    }
    restoredBody = restoredBody.replace(
      `${firstQuote}${key}${lastQuote}`,
      original,
    );
    idx++;
  });
  return restoredBody;
}

const build = async (
  document: Document,
  formatBody: boolean = true,
): Promise<string> => {
  let output = "";

  for (const variable of document.variables) {
    output += `@${variable.key} = ${variable.value}\n`;
  }
  output += "\n\n";

  for (const block of document.blocks) {
    const requestSeparatorText = block.requestSeparator.text
      ? ` ${block.requestSeparator.text}`
      : "";
    output += `\n###${requestSeparatorText}\n\n`;

    if (block.comments.length > 0) {
      for (const comment of block.comments) {
        output += `${replaceCommentPrefix(comment)}`;
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
      const formatParser = getFormatParser(block);
      output += `${block.request.method} ${block.request.url} ${block.request.httpVersion}\n`;
      for (const header of block.request.headers) {
        let headerKey = header.key;
        switch (block.request.httpVersion) {
          case "HTTP/1.0":
          case "HTTP/1.1":
            headerKey = headerToPascalCase(header.key);
            break;
          case "HTTP/2":
          case "HTTP/3":
            headerKey = header.key.toLowerCase();
            break;
        }
        output += `${headerKey}: ${header.value}\n`;
      }
      if (block.request.body) {
        let body = block.request.body.trim();
        if (formatBody) {
          if (formatParser === "graphql" || formatParser === "json") {
            try {
              const { replacedBody, placeholders } = preservePlaceholders(body);

              body = await prettier.format(replacedBody, {
                parser: formatParser,
              });

              body = restorePlaceholders(body, placeholders).trim();
            } catch (err) {
              const error = err as Error;
              console.log(error.message);
              process.exit(1);
            }
          }
        }
        output += `\n${body}\n`;
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
  }
  output = output.trim() + "\n";
  return output;
};

export const DocumentBuilder = {
  build,
};
