import type { Document, Block, Header } from "./DocumentParser";

interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<
    string,
    {
      default: string;
      description?: string;
      enum?: string[];
    }
  >;
}

interface OpenAPIParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  example?: string | number | boolean;
  schema?: OpenAPISchema;
}

interface OpenAPISchema {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  description?: string;
  example?: OpenAPISchemaExample;
}

type OpenAPISchemaExample =
  | string
  | number
  | boolean
  | null
  | OpenAPISchemaExample[]
  | { [key: string]: OpenAPISchemaExample };

interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<
    string,
    {
      schema?: OpenAPISchema;
      example?: OpenAPISchemaExample;
    }
  >;
}

interface OpenAPIOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<
    string,
    {
      description: string;
      content?: Record<
        string,
        {
          schema: OpenAPISchema;
          example?: OpenAPISchemaExample;
        }
      >;
    }
  >;
}

interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
    parameters?: Record<string, OpenAPIParameter>;
    requestBodies?: Record<string, OpenAPIRequestBody>;
    responses?: Record<string, OpenAPIOperation["responses"]>;
  };
}

interface OpenAPIParser {
  parse(openAPISpec: OpenAPISpec): ParseResult;
}

interface ParseResult {
  documents: Document[];
  serverUrls: string[];
}

export class OpenAPIDocumentParser implements OpenAPIParser {
  private buildRequestBlock(
    path: string,
    method: string,
    operation: OpenAPIOperation,
  ): Block {
    const block: Block = {
      metadata: [],
      comments: [],
      request: {
        method: method.toUpperCase(),
        url: path,
        httpVersion: "HTTP/1.1",
        headers: [],
        body: null,
      },
      preRequestScripts: [],
      postRequestScripts: [],
      responseRedirect: null,
    };

    // Add operation summary/description as comments
    if (operation.summary) {
      block.comments.push(`# ${operation.summary}\n`);
    }
    if (operation.description) {
      block.comments.push(`# ${operation.description}\n`);
    }

    // Add operationId as metadata
    if (operation.operationId) {
      block.metadata.push({
        key: "name",
        value: operation.operationId,
      });
    }

    // Since we know block.request is initialized above, we can assert it's non-null
    if (operation.requestBody?.content) {
      const content = operation.requestBody.content;
      const contentType = Object.keys(content)[0];

      if (block.request) {
        // TypeScript guard
        block.request.headers.push({
          key: "Content-Type",
          value: contentType,
        });

        const mediaTypeObject = content[contentType];
        if (mediaTypeObject.example) {
          block.request.body = JSON.stringify(mediaTypeObject.example, null, 2);
        } else if (mediaTypeObject.schema) {
          block.request.body = this.generateExampleFromSchema(
            mediaTypeObject.schema,
          );
        }
      }
    }

    // Handle parameters
    if (operation.parameters && block.request) {
      // TypeScript guard
      for (const param of operation.parameters) {
        if (param.in === "header") {
          const header: Header = {
            key: param.name,
            value: param.example?.toString() || `{{${param.name}}}`,
          };
          block.request.headers.push(header);
        }
      }
    }

    return block;
  }

  private generateExampleFromSchema(schema: OpenAPISchema): string {
    const example: Record<string, unknown> = {};
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        example[key] = prop.example || this.getDefaultValueForType(prop.type);
      }
    }
    return JSON.stringify(example, null, 2);
  }

  private getDefaultValueForType(type: OpenAPISchema["type"]): unknown {
    switch (type) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return 0;
      case "boolean":
        return false;
      case "array":
        return [];
      case "object":
        return {};
      default:
        return null;
    }
  }

  private extractServerIdentifier(server: OpenAPIServer): string {
    // Remove protocol prefix (http:// or https://)
    let identifier = server.url.replace(/^https?:\/\//, "");

    // Replace variable patterns with their default values or placeholder
    if (server.variables) {
      Object.entries(server.variables).forEach(([key, variable]) => {
        identifier = identifier.replace(
          `{${key}}`,
          variable.default || `[${key}]`,
        );
      });
    }

    // Remove port and path for cleaner identifier
    identifier = identifier.split(":")[0].split("/")[0];

    return identifier;
  }

  parse(openAPISpec: OpenAPISpec): ParseResult {
    // If no servers are specified, create a single document with relative URLs
    if (!openAPISpec.servers || openAPISpec.servers.length === 0) {
      return {
        documents: [this.createDocument(openAPISpec)],
        serverUrls: ["default"],
      };
    }

    // Create a document for each server
    const documents = openAPISpec.servers.map((server, index) =>
      this.createDocument(openAPISpec, server, index),
    );

    // Extract server identifiers in matching order
    const serverUrls = openAPISpec.servers.map((server) =>
      this.extractServerIdentifier(server),
    );

    return {
      documents,
      serverUrls,
    };
  }

  private buildFullUrl(
    path: string,
    server?: OpenAPIServer,
    serverIndex?: number,
  ): string {
    if (!server) {
      return path;
    }

    // Remove leading slash from path
    const cleanPath = path.replace(/^\//, "");

    let url = server.url;

    // Replace server variables with double curly brace format
    if (server.variables) {
      Object.keys(server.variables).forEach((key) => {
        url = url.replace(`{${key}}`, `{{${key}}}`);
      });
    }

    // Replace the entire server URL with baseUrl variable
    url = `{{baseUrl${serverIndex || ""}}}/${cleanPath}`;

    return url;
  }

  private createDocument(
    openAPISpec: OpenAPISpec,
    server?: OpenAPIServer,
    serverIndex?: number,
  ): Document {
    const document: Document = {
      variables: [],
      blocks: [],
    };

    // Add server URL as a variable if it exists
    if (server) {
      let serverUrl = server.url.replace(/\/$/, ""); // Remove trailing slash

      // Replace server variables with double curly braces in the URL
      if (server.variables) {
        Object.keys(server.variables).forEach((key) => {
          serverUrl = serverUrl.replace(`{${key}}`, `{{${key}}}`);
        });
      }

      document.variables.push({
        key: `baseUrl${serverIndex || ""}`,
        value: serverUrl,
      });

      // Add server variables if they exist
      if (server.variables) {
        Object.entries(server.variables).forEach(([key, variable]) => {
          document.variables.push({
            key: key,
            value: variable.default,
          });
        });
      }
    }

    // Parse paths into blocks
    for (const [path, pathItem] of Object.entries(openAPISpec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (["get", "post", "put", "delete", "patch"].includes(method)) {
          const block = this.buildRequestBlock(
            this.buildFullUrl(path, server, serverIndex),
            method,
            operation as OpenAPIOperation,
          );

          // Add server description as a comment if it exists
          if (server?.description) {
            block.comments.unshift(`# Server: ${server.description}\n`);
          }

          document.blocks.push(block);
        }
      }
    }

    return document;
  }
}
