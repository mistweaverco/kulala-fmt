import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import type { Document, Block, Header } from "./DocumentParser";

interface BrunoCollection {
  version: string;
  name: string;
  type: "collection";
  ignore?: string[];
}

interface BrunoEnvironmentVars {
  vars?: Record<string, string>;
}

interface BrunoRequestMeta {
  name?: string;
  type?: string;
  seq?: number;
}

interface BrunoRequestDetails {
  method: string;
  url: string;
  body?: string | "none";
  auth?: string | "none";
}

interface BrunoRequestParams {
  query?: Record<string, string>;
  headers?: Record<string, string>;
}

interface MethodContent {
  url: string;
  body?: string | "none";
  auth?: string | "none";
}

interface BrunoRequest {
  meta?: BrunoRequestMeta;
  request?: BrunoRequestDetails;
  params?: BrunoRequestParams;
  body?: string;
  tests?: string;
  script?: string;
  get?: MethodContent;
  post?: MethodContent;
  put?: MethodContent;
  delete?: MethodContent;
  patch?: MethodContent;
}

interface ParseResult {
  documents: Document[];
  environmentNames: string[];
  collectionName: string;
}

let collectionInfo: BrunoCollection | undefined;

export class BrunoDocumentParser {
  private parseBrunoJson(content: string): BrunoCollection {
    return JSON.parse(content) as BrunoCollection;
  }

  private parseKeyValueSection(lines: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of lines) {
      if (line.trim()) {
        const [key, ...valueParts] = line.split(":").map((part) => part.trim());
        const value = valueParts.join(":");
        if (key && value) {
          result[key] = value.replace(/^"(.*)"$/, "$1"); // Remove quotes if present
        }
      }
    }
    return result;
  }

  private parseBruFile(content: string): BrunoRequest {
    const lines = content.split("\n");
    const request: BrunoRequest = {};
    let currentSection: string | null = null;
    let currentContent: string[] = [];
    let isBodyJson = false;
    let jsonBraceCount = 0;
    const baseIndentation = 2;

    for (const line of lines) {
      if (!line.trim() && !isBodyJson) continue;

      // Handle section markers
      if (line.trim().endsWith(" {")) {
        currentSection = line.trim().slice(0, -2).trim();
        isBodyJson = currentSection === "body:json";
        currentContent = [];
        continue;
      } else if (line.trim() === "}") {
        if (isBodyJson && jsonBraceCount > 0) {
          jsonBraceCount--;
          continue;
        }
        if (currentSection) {
          // Process the collected content based on section
          switch (currentSection) {
            case "meta":
              request.meta = this.parseKeyValueSection(
                currentContent,
              ) as BrunoRequestMeta;
              break;
            case "get":
            case "post":
            case "put":
            case "delete":
            case "patch": {
              const methodContent = this.parseKeyValueSection(currentContent);
              if (!methodContent.url) {
                throw new Error(
                  `URL is required for ${currentSection} request`,
                );
              }
              request[currentSection] = {
                url: methodContent.url,
                body: methodContent.body,
                auth: methodContent.auth,
              } as MethodContent;
              break;
            }
            case "headers":
              if (!request.params) request.params = {};
              request.params.headers =
                this.parseKeyValueSection(currentContent);
              break;
            case "params:query":
              if (!request.params) request.params = {};
              request.params.query = this.parseKeyValueSection(currentContent);
              break;
            case "body:json":
              if (currentContent.length > 0) {
                const formattedJson = [
                  "{",
                  ...currentContent
                    .filter((line) => line.trim())
                    .map((line) => " ".repeat(baseIndentation) + line.trim()),
                  "}",
                ].join("\n");
                request.body = formattedJson;
              }
              break;
            case "tests":
              request.tests = currentContent.join("\n");
              break;
            case "script":
              request.script = currentContent.join("\n");
              break;
          }
          currentSection = null;
          isBodyJson = false;
          jsonBraceCount = 0;
        }
        continue;
      }

      if (currentSection) {
        if (isBodyJson) {
          if (line.trim().startsWith("{")) {
            jsonBraceCount++;
            continue;
          } else if (line.trim()) {
            jsonBraceCount += (line.match(/{/g) || []).length;
            jsonBraceCount -= (line.match(/}/g) || []).length;
            currentContent.push(line.trim());
          }
        } else {
          currentContent.push(line.trim());
        }
      }
    }

    return request;
  }

  private parseEnvironmentBruFile(content: string): BrunoEnvironmentVars {
    const lines = content.split("\n");
    const environment: BrunoEnvironmentVars = {};
    let currentSection: string | null = null;
    let currentContent: string[] = [];

    for (let line of lines) {
      line = line.trim();

      if (!line) continue;

      // Handle section markers
      if (line === "vars {") {
        currentSection = "vars";
        currentContent = [];
        continue;
      } else if (line === "}" && currentSection === "vars") {
        environment.vars = this.parseKeyValueSection(currentContent);
        currentSection = null;
        continue;
      }

      if (currentSection) {
        currentContent.push(line);
      }
    }

    return environment;
  }

  private buildRequestBlock(
    bruRequest: BrunoRequest,
    folderPath: string,
  ): Block {
    if (!bruRequest.request) {
      // Extract method and URL from the request sections
      const methodSections = ["get", "post", "put", "delete", "patch"] as const;
      for (const section of methodSections) {
        const content = bruRequest[section] as MethodContent | undefined;
        if (content) {
          bruRequest.request = {
            method: section.toUpperCase(),
            url: content.url,
            body: content.body,
            auth: content.auth,
          };
          break;
        }
      }

      if (!bruRequest.request) {
        throw new Error("No request information found in .bru file");
      }
    }

    const request = {
      method: bruRequest.request.method,
      url: bruRequest.request.url,
      httpVersion: "HTTP/1.1",
      headers: [] as Header[],
      body: null as string | null,
    };

    const block: Block = {
      metadata: [],
      comments: [],
      request,
      preRequestScripts: [],
      postRequestScripts: [],
      responseRedirect: null,
    };

    // Add folder path and name as comments
    if (folderPath) {
      block.comments.push(`# Folder: ${folderPath}\n`);
    }
    if (bruRequest.meta?.name) {
      block.comments.push(`# ${bruRequest.meta.name}\n`);
      block.metadata.push({
        key: "name",
        value: bruRequest.meta.name.replace(/\s+/g, "_").toUpperCase(),
      });
    }

    // Handle headers
    if (bruRequest.params?.headers) {
      Object.entries(bruRequest.params.headers).forEach(([key, value]) => {
        request.headers.push({ key, value });
      });
    }

    // Add Content-Type header for JSON body if not present
    if (bruRequest.body && !bruRequest.params?.headers?.["Content-Type"]) {
      request.headers.push({
        key: "Content-Type",
        value: "application/json",
      });
    }

    // Handle body
    if (bruRequest.body && bruRequest.body !== "none") {
      request.body = bruRequest.body.trim();
    }

    // Handle scripts
    if (bruRequest.script) {
      block.preRequestScripts.push({
        script: bruRequest.script,
        inline: true,
      });
    }

    if (bruRequest.tests) {
      block.postRequestScripts.push({
        script: bruRequest.tests,
        inline: true,
      });
    }

    return block;
  }

  private processDirectory(
    dirPath: string,
    environment?: { name: string; vars: Record<string, string> },
  ): Document {
    const document: Document = {
      variables: [],
      blocks: [],
    };

    // Add environment variables if provided
    if (environment) {
      Object.entries(environment.vars).forEach(([key, value]) => {
        document.variables.push({ key, value });
      });
    }

    const items = readdirSync(dirPath);

    // First try to find and parse bruno.json
    const brunoJsonFile = items.find((item) => item === "bruno.json");
    if (brunoJsonFile) {
      const content = readFileSync(join(dirPath, brunoJsonFile), "utf-8");
      collectionInfo = this.parseBrunoJson(content);
    }

    // Then process all .bru files (excluding those in environments directory)
    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && item !== "environments") {
        // Recursively process subdirectories (except environments)
        const subDocument = this.processDirectory(fullPath, environment);
        document.blocks.push(...subDocument.blocks);
      } else if (item.endsWith(".bru") && !fullPath.includes("environments")) {
        const content = readFileSync(fullPath, "utf-8");
        const bruRequest = this.parseBruFile(content);
        const relativePath = relative(dirPath, fullPath).replace(".bru", "");
        const block = this.buildRequestBlock(bruRequest, relativePath);
        document.blocks.push(block);
      }
    }

    return document;
  }

  private getEnvironments(
    dirPath: string,
  ): Array<{ name: string; vars: Record<string, string> }> {
    const environments: Array<{ name: string; vars: Record<string, string> }> =
      [];
    const environmentsDir = join(dirPath, "environments");

    if (statSync(environmentsDir, { throwIfNoEntry: false })?.isDirectory()) {
      const envFiles = readdirSync(environmentsDir);

      for (const file of envFiles) {
        if (file.endsWith(".bru")) {
          const envContent = readFileSync(join(environmentsDir, file), "utf-8");
          const environment = this.parseEnvironmentBruFile(envContent);
          if (environment.vars) {
            environments.push({
              name: file.replace(".bru", ""),
              vars: environment.vars,
            });
          }
        }
      }
    }

    return environments;
  }

  parse(collectionPath: string): ParseResult {
    const environments = this.getEnvironments(collectionPath);

    // If no environments found, create a default document
    if (environments.length === 0) {
      return {
        documents: [this.processDirectory(collectionPath)],
        environmentNames: ["default"],
        collectionName: collectionInfo?.name || "bruno-collection",
      };
    }

    // Create a document for each environment
    const documents = environments.map((env) =>
      this.processDirectory(collectionPath, env),
    );

    return {
      documents,
      environmentNames: environments.map((env) => env.name),
      collectionName: collectionInfo?.name || "bruno-collection",
    };
  }
}
