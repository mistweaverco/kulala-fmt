import Parser, { SyntaxNode, type Language } from "tree-sitter";
import Kulala from "@mistweaverco/tree-sitter-kulala";

// Define types
interface Request {
  method: string;
  url: string;
  httpVersion: string;
  headers: string[] | null;
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

interface Variable {
  key: string;
  value: string;
}

interface Block {
  metadata: Metadata[];
  comments: string[];
  request: Request | null;
  preRequestScripts: PreRequestScript[];
  postRequestScripts: PostRequestScript[];
  responseRedirect: string | null;
}

interface Document {
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

const parse = (content: string): Document => {
  const parser = new Parser();
  const language = Kulala as Language;
  parser.setLanguage(language);

  const tree = parser.parse(content);
  const rootNode = tree.rootNode;

  const variables: Variable[] = [];
  const blocks: Block[] = [];

  traverseNodes(rootNode, (node) => {
    const headers: string[] = [];
    let method: string = "";
    let url: string = "";
    let httpVersion: string = "";
    let body: string | null = null;
    let responseRedirect: string | null = null;

    const preRequestScripts: PreRequestScript[] = [];
    const postRequestScripts: PostRequestScript[] = [];
    const metadata: Metadata[] = [];
    const comments: string[] = [];

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
        preRequestScripts.push(preRequestScript);
      }
    }
    if (node.type === "res_handler_script") {
      let postRequestScript: PostRequestScript | null = null;
      node.children.forEach((child) => {
        switch (child.type) {
          case "script":
            postRequestScript = {
              script: child.text,
              inline: true,
            };
            break;
          case "path":
            postRequestScript = {
              script: child.text,
              inline: false,
            };
            break;
        }
      });
      if (postRequestScript) {
        postRequestScripts.push(postRequestScript);
      }
    }

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

    if (node.type === "comment") {
      // normal comment
      if (node.children.length === 0) {
        comments.push(node.text);
      }
      let metaData: Metadata | null = null;
      // metadata comments like `# @key value`
      node.children.forEach((child) => {
        switch (child.type) {
          case "identifier":
            metaData = {
              key: child.text,
              value: "",
            };
            break;
          case "value":
            if (metaData) {
              metaData.value = child.text;
            }
            break;
        }
      });
      if (metaData) {
        metadata.push(metaData);
      }
    }

    if (node.type === "request") {
      node.children.forEach((child) => {
        switch (child.type) {
          case "method":
            method = child.text;
            break;
          case "target_url":
            url = child.text;
            break;
          case "http_version":
            httpVersion = child.text;
            break;
          case "header":
            headers.push(child.text);
            break;
          case "res_redirect":
            responseRedirect = child.text;
            break;
        }
        if (child.type.endsWith("_body")) {
          body = child.text;
        }
      });

      const request: Request = {
        method,
        url,
        httpVersion,
        headers,
        body,
      };

      blocks.push({
        metadata,
        comments,
        request,
        preRequestScripts,
        postRequestScripts,
        responseRedirect,
      });
    }
  });

  return { blocks, variables };
};

export const DocumentParser = {
  parse,
};
