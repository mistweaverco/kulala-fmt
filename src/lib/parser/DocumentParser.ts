import Parser, { SyntaxNode, type Language } from "tree-sitter";
import Kulala from "@mistweaverco/tree-sitter-kulala";

export interface Header {
  key: string;
  value: string;
}

interface Request {
  method: string;
  url: string;
  httpVersion: string;
  headers: Header[];
  body: string | null;
}

interface Metadata {
  key: string;
  value: string;
}

interface PreRequestScript {
  script: string;
  inline: boolean;
}

interface PostRequestScript {
  script: string;
  inline: boolean;
}

export interface Variable {
  key: string;
  value: string;
}

export interface BlockRequestSeparator {
  text: string | null;
}

export interface Block {
  requestSeparator: BlockRequestSeparator;
  metadata: Metadata[];
  comments: string[];
  request: Request | null;
  preRequestScripts: PreRequestScript[];
  postRequestScripts: PostRequestScript[];
  responseRedirect: string | null;
}

export interface Document {
  variables: Variable[];
  blocks: Block[];
}

const traverseNodes = (
  node: SyntaxNode,
  callback: (node: SyntaxNode) => void,
): void => {
  callback(node);
  node.children.forEach((child) => traverseNodes(child, callback));
};

// formatUrl takes a URL string and retuns an formatted string
// with the URL parts separated by new lines
// For example, given the URL `https://httpbin.org/get?foo=bar&baz=qux`
// the function should return:
// ```
// https://httpbin.org/get
//   ?foo=bar
//   &baz=qux
// ```
const formatUrl = (url: string): string => {
  const parts = url.split("?");
  if (parts.length === 1) {
    return parts[0];
  }
  const [base, query] = parts;
  return `${base}?${query.split("&").join("\n  &")}`.replace(/\n\s*\n/g, "\n");
};

const parse = (content: string): Document => {
  const parser = new Parser();
  const language = Kulala as Language;
  parser.setLanguage(language);

  const tree = parser.parse(content);
  const documentNode = tree.rootNode;

  const variables: Variable[] = [];
  const blocks: Block[] = [];

  const blockNodes = documentNode.children.filter(
    (node) => node.type === "section",
  );

  blockNodes.forEach((bn) => {
    const block: Block = {
      requestSeparator: {
        text: null,
      },
      metadata: [],
      comments: [],
      request: null,
      preRequestScripts: [],
      postRequestScripts: [],
      responseRedirect: null,
    };

    const headers: Header[] = [];
    let method: string = "";
    let url: string = "";
    let httpVersion: string = "";
    let body: string | null = null;

    bn.children.forEach((node) => {
      if (node.type === "pre_request_script") {
        let preRequestScript: PreRequestScript | null = null;
        node.children.forEach((child) => {
          switch (child.type) {
            case "script":
              preRequestScript = {
                script: child.text,
                inline: true,
              };
              break;
            case "path":
              preRequestScript = {
                script: child.text,
                inline: false,
              };
              break;
          }
        });
        if (preRequestScript) {
          block.preRequestScripts.push(preRequestScript);
        }
      }
      if (node.type === "request_separator") {
        // without text
        if (node.children.length === 0) {
          block.requestSeparator.text = null;
        }
        node.children.forEach((child) => {
          switch (child.type) {
            case "value":
              block.requestSeparator.text = child.text;
              break;
          }
        });
      }
      if (node.type === "comment") {
        // normal comment
        if (node.children.length === 0) {
          block.comments.push(node.text);
        }
        let md: Metadata | null = null;
        // metadata comments like `# @key value`
        node.children.forEach((child) => {
          switch (child.type) {
            case "identifier":
              md = {
                key: child.text,
                value: "",
              };
              break;
            case "value":
              if (md) {
                md.value = child.text;
              }
              break;
          }
        });
        if (md) {
          block.metadata.push(md);
        }
      }

      if (node.type === "request") {
        node.children.forEach((child) => {
          let postRequestScript: PostRequestScript | null = null;
          let parts, key, value;
          switch (child.type) {
            case "method":
              method = child.text;
              break;
            case "target_url":
              url = formatUrl(child.text);
              break;
            case "http_version":
              httpVersion = child.text;
              break;
            case "header":
              // a header string is in the format `key: value`
              // for example, `Content-Type: application/json`
              parts = child.text.split(":");
              key = parts[0].trim();
              // also make sure to take all parts after the first colon
              value = parts.slice(1).join(":").trim();
              headers.push({ key, value });
              break;
            case "res_redirect":
              block.responseRedirect = child.text;
              break;
            case "res_handler_script":
              child.children.forEach((c) => {
                switch (c.type) {
                  case "script":
                    postRequestScript = {
                      script: c.text,
                      inline: true,
                    };
                    break;
                  case "path":
                    postRequestScript = {
                      script: c.text,
                      inline: false,
                    };
                    break;
                }
              });
              if (postRequestScript) {
                block.postRequestScripts.push(postRequestScript);
              }
              break;
          }
          if (child.type.endsWith("_body")) {
            body = child.text;
          }
        });

        if (method === "") {
          method = "GET";
        }

        if (httpVersion === "") {
          httpVersion = "HTTP/1.1";
        }
      }
      block.request = {
        method,
        url,
        httpVersion,
        headers,
        body,
      };
    });
    if (
      block.request?.url.length ||
      block.metadata.length > 0 ||
      block.comments.length > 0
    ) {
      blocks.push(block);
    }
  });

  traverseNodes(documentNode, (node) => {
    if (node.type === "variable_declaration") {
      let variable: Variable | null = null;
      // variables like `@key = value`
      node.children.forEach((child) => {
        switch (child.type) {
          case "identifier":
            variable = {
              key: child.text,
              value: "",
            };
            break;
          case "value":
            if (variable) {
              variable.value = child.text;
            }
            break;
        }
      });
      if (variable) {
        variables.push(variable);
      }
    }
  });

  return { blocks, variables };
};

export const DocumentParser = {
  parse,
};
