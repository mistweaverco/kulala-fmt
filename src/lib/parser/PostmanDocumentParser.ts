import type { Document, Block } from "./DocumentParser";

interface PostmanVariable {
  key: string;
  value: string;
  enabled?: boolean;
  type?: string;
}

interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanRequest {
  method: string;
  header: PostmanHeader[];
  url: {
    raw: string;
    protocol?: string;
    host?: string[];
    path?: string[];
    query?: Array<{
      key: string;
      value: string;
      disabled?: boolean;
    }>;
  };
  body?: {
    mode: "raw" | "formdata" | "urlencoded" | "file" | "graphql";
    raw?: string;
    options?: {
      raw?: {
        language: string;
      };
    };
  };
  description?: string;
  name?: string;
}

interface PostmanItem {
  name: string;
  request: PostmanRequest;
  response: unknown[];
}

interface PostmanItemGroup {
  name: string;
  item: (PostmanItem | PostmanItemGroup)[];
  description?: string;
}

interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    version?: string;
  };
  item: (PostmanItem | PostmanItemGroup)[];
  variable?: PostmanVariable[];
}

interface ParseResult {
  document: Document;
  collectionName: string;
}

export class PostmanDocumentParser {
  private buildRequestBlock(item: PostmanItem): Block {
    const block: Block = {
      requestSeparator: {
        text: null,
      },
      metadata: [],
      comments: [],
      request: {
        method: item.request.method,
        url: item.request?.url?.raw,
        httpVersion: "HTTP/1.1",
        headers: [],
        body: null,
      },
      preRequestScripts: [],
      postRequestScripts: [],
      responseRedirect: null,
    };

    // Add name and description as comments
    if (item.name) {
      block.comments.push(`# ${item.name}\n`);
    }
    if (item.request.description) {
      block.comments.push(`# ${item.request.description}\n`);
    }

    // Add name as metadata
    if (item.name) {
      block.metadata.push({
        key: "name",
        value: item.name.replace(/\s+/g, "_").toUpperCase(),
      });
    }

    // Handle headers
    if (item.request.header) {
      item.request.header
        .filter((header) => !header.disabled)
        .forEach((header) => {
          if (block.request) {
            block.request.headers.push({
              key: header.key,
              value: header.value,
            });
          }
        });
    }

    // Handle request body
    if (item.request.body?.mode === "raw" && item.request.body.raw) {
      if (block.request) {
        block.request.body = item.request.body.raw;

        // Add Content-Type header if not present
        const contentType =
          item.request.body.options?.raw?.language || "text/plain";
        if (
          !block.request.headers.some(
            (h) => h.key.toLowerCase() === "content-type",
          )
        ) {
          block.request.headers.push({
            key: "Content-Type",
            value: this.getContentType(contentType),
          });
        }
      }
    }

    return block;
  }

  private getContentType(language: string): string {
    switch (language.toLowerCase()) {
      case "json":
        return "application/json";
      case "xml":
        return "application/xml";
      case "javascript":
        return "application/javascript";
      default:
        return "text/plain";
    }
  }

  private processItems(
    items: (PostmanItem | PostmanItemGroup)[],
    document: Document,
    parentPath: string = "",
  ): void {
    for (const item of items) {
      if (this.isItemGroup(item)) {
        // Process folder
        const newPath = parentPath ? `${parentPath}/${item.name}` : item.name;
        if (item.description) {
          document.blocks.push({
            requestSeparator: {
              text: null,
            },
            metadata: [],
            comments: [`# Folder: ${newPath}\n`, `# ${item.description}\n`],
            request: null,
            preRequestScripts: [],
            postRequestScripts: [],
            responseRedirect: null,
          });
        }
        this.processItems(item.item, document, newPath);
      } else {
        // Process request
        const block = this.buildRequestBlock(item);
        document.blocks.push(block);
      }
    }
  }

  private isItemGroup(
    item: PostmanItem | PostmanItemGroup,
  ): item is PostmanItemGroup {
    return "item" in item;
  }

  parse(collection: PostmanCollection): ParseResult {
    const document: Document = {
      variables: [],
      blocks: [],
    };

    // Add collection variables
    if (collection.variable) {
      collection.variable
        .filter((v) => v.enabled !== false)
        .forEach((v) => {
          document.variables.push({
            key: v.key,
            value: v.value,
          });
        });
    }

    // Process all requests in the collection
    this.processItems(collection.item, document);

    return {
      document: document,
      collectionName: collection.info.name,
    };
  }
}
