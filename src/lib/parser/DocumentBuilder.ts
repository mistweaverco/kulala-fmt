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

// New helper function to split GraphQL body and variables
function splitGraphQLBody(body: string): {
  query: string;
  variables: string | null;
} {
  // Split on first occurrence of two newlines followed by a JSON-like structure
  const parts = body.split(/\n\s*\n(\s*{)/);

  if (parts.length >= 2) {
    // Rejoin the JSON part if it was split
    const variables = parts.slice(1).join("");
    return {
      query: parts[0].trim(),
      variables: variables.trim(),
    };
  }

  return {
    query: body.trim(),
    variables: null,
  };
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
      const formatParser = getFormatParser(block);
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
        let body = block.request.body.trim();
        if (formatBody) {
          if (formatParser === "graphql") {
            const { query, variables } = splitGraphQLBody(body);
            try {
              // Format the GraphQL query
              const formattedQuery = await prettier.format(query, {
                parser: "graphql",
              });

              // Format the variables if they exist
              let formattedVariables = "";
              if (variables) {
                formattedVariables = await prettier.format(variables, {
                  parser: "json",
                });
              }

              // Combine the formatted parts
              body = formattedQuery.trim();
              if (formattedVariables) {
                body += "\n\n" + formattedVariables.trim();
              }
            } catch (err) {
              const error = err as Error;
              console.log(error.message);
              process.exit(1);
            }
          } else if (formatParser === "json") {
            try {
              body = await prettier.format(body, { parser: "json" });
              body = body.trim();
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

    output += "\n###\n\n";
  }
  output = output.trim();
  return output;
};

export const DocumentBuilder = {
  build,
};
