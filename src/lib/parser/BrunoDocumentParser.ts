import { BrunoToJSONParser } from './BrunoToJson';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { Document, Block, Header, Variable } from './DocumentParser';

interface BrunoCollection {
  version: string;
  name: string;
  type: 'collection';
  ignore?: string[];
}

interface BrunoEnvironmentVars {
  vars?: Record<string, string>;
}

interface EnvironmentInfo {
  name: string;
  vars: Record<string, string>;
}

interface BrunoParam {
  name: string;
  value: string;
  enabled?: boolean;
  type?: 'query' | 'path';
}

interface BrunoVar {
  name: string;
  value: string;
  local?: boolean;
}

interface BrunoRequest {
  meta?: {
    name?: string;
    url?: string;
  };
  http?: {
    method?: string;
    url?: string;
  };
  headers?: BrunoHeader[];
  params?: BrunoParam[];
  vars?: {
    req?: BrunoVar[];
    res?: BrunoVar[];
  };
  body?: {
    json?: string;
    graphql?: {
      query?: string;
      variables?: string;
    };
    formUrlEncoded?: Record<string, string>;
    multipartForm?: Array<{
      name: string;
      value: string;
      type?: string;
    }>;
  };
  script?: {
    req?: string;
    res?: string;
  };
  tests?: string;
}

interface ParseResult {
  documents: Document[];
  environmentNames: string[];
  collectionName: string;
}

interface BrunoHeader {
  name: string;
  value: string;
  enabled?: boolean;
}

let collectionInfo: BrunoCollection | undefined;

export class BrunoDocumentParser {
  private parseEnvironmentBruFile(content: string): BrunoEnvironmentVars {
    const lines = content.split('\n');
    const environment: BrunoEnvironmentVars = { vars: {} };
    let isInVarsBlock = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) continue;

      if (trimmedLine === 'vars {') {
        isInVarsBlock = true;
        continue;
      } else if (trimmedLine === '}' && isInVarsBlock) {
        isInVarsBlock = false;
        continue;
      }

      if (isInVarsBlock && environment.vars) {
        const [key, ...valueParts] = trimmedLine.split(':').map((part) => part.trim());
        const value = valueParts.join(':').replace(/^"(.*)"$/, '$1');
        if (key && value) {
          environment.vars[key] = value;
        }
      }
    }

    return environment;
  }

  private applyParams(url: string, params: BrunoParam[]): string {
    let result = url;

    for (const param of params.filter((p) => p.enabled !== false)) {
      if (param.type === 'path') {
        result = result
          .replace(`:${param.name}`, param.value)
          .replace(`{${param.name}}`, param.value);
      }
    }

    const queryParams = params.filter((p) => p.type === 'query' && p.enabled !== false);
    if (queryParams.length > 0) {
      const queryParts = queryParams.map((p) => {
        const value = p.value.match(/^{{.*}}$/) ? p.value : encodeURIComponent(p.value);
        return `${encodeURIComponent(p.name)}=${value}`;
      });
      const separator = result.includes('?') ? '&' : '?';
      result += separator + queryParts.join('&');
    }

    return result;
  }

  private applyVariables(block: Block, document: Document, vars: BrunoVar[] | undefined): void {
    if (!vars?.length) return;

    for (const variable of vars) {
      const entry: Variable = {
        key: variable.name,
        value: variable.value,
      };

      if (variable.local) {
        if (!block.variables) {
          block.variables = [];
        }
        block.variables.push(entry);
      } else if (!document.variables.some((v) => v.key === entry.key)) {
        document.variables.push(entry);
      }
    }
  }

  private buildRequestBlock(
    bruRequest: BrunoRequest,
    folderPath: string,
    document: Document,
  ): Block {
    const request = {
      method: (bruRequest.http?.method || 'POST').toUpperCase(),
      url: bruRequest.http?.url || bruRequest.meta?.url || '',
      httpVersion: 'HTTP/1.1',
      headers: [] as Header[],
      body: null as string | null,
    };

    if (bruRequest.params?.length) {
      request.url = this.applyParams(request.url, bruRequest.params);
    }

    const block: Block = {
      requestSeparator: {
        text: null,
      },
      metadata: [],
      comments: [],
      request,
      preRequestScripts: [],
      postRequestScripts: [],
      responseRedirect: null,
    };

    if (folderPath) {
      block.comments.push(`# Folder: ${folderPath}\n`);
    }
    if (bruRequest.meta?.name) {
      block.comments.push(`# ${bruRequest.meta.name}\n`);
      block.metadata.push({
        key: 'name',
        value: bruRequest.meta.name.replace(/\s+/g, '_').toUpperCase(),
      });
    }

    this.applyVariables(block, document, bruRequest.vars?.req);

    if (Array.isArray(bruRequest.headers)) {
      bruRequest.headers
        .filter((header) => header.enabled !== false)
        .forEach((header) => {
          request.headers.push({
            key: header.name,
            value: header.value,
          });
        });
    }

    if (bruRequest.body?.graphql) {
      request.headers.push(
        { key: 'Accept', value: 'application/json' },
        { key: 'Content-Type', value: 'application/json' },
        { key: 'X-REQUEST-TYPE', value: 'GraphQL' },
      );

      const query = bruRequest.body.graphql.query;
      const variables = bruRequest.body.graphql.variables;

      if (query) {
        request.body = query;
        if (variables) {
          request.body += '\n\n' + variables;
        }
      }
    } else if (bruRequest.body?.json) {
      request.body = bruRequest.body.json;

      if (!request.headers.some((h) => h.key.toLowerCase() === 'content-type')) {
        request.headers.push({
          key: 'Content-Type',
          value: 'application/json',
        });
      }
    } else if (bruRequest.body?.formUrlEncoded) {
      const formEntries = bruRequest.body.formUrlEncoded;
      const formParts: string[] = [];

      if (Array.isArray(formEntries)) {
        formEntries
          .filter((entry) => entry.enabled !== false)
          .forEach((entry) => {
            if (entry.name && entry.value !== undefined && entry.value !== null) {
              const value = String(entry.value);
              const encodedValue = value.match(/^{{.*}}$/) ? value : encodeURIComponent(value);
              formParts.push(`${encodeURIComponent(entry.name)}=${encodedValue}`);
            }
          });
      }

      request.body = formParts.join('&');

      request.headers.push({
        key: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
      });
    } else if (bruRequest.body?.multipartForm) {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
      const parts: string[] = [];

      bruRequest.body.multipartForm.forEach((field) => {
        parts.push(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${field.name}"\r\n` +
            (field.type ? `Content-Type: ${field.type}\r\n` : '') +
            `\r\n${field.value}\r\n`,
        );
      });
      parts.push(`--${boundary}--\r\n`);

      request.body = parts.join('');
      request.headers.push({
        key: 'Content-Type',
        value: `multipart/form-data; boundary=${boundary}`,
      });
    }

    if (bruRequest.script?.req) {
      block.preRequestScripts.push({
        script: bruRequest.script.req.trim(),
        inline: true,
      });
    }

    if (bruRequest.tests) {
      block.postRequestScripts.push({
        script: bruRequest.tests.trim(),
        inline: true,
      });
    }

    return block;
  }

  private processDirectory(dirPath: string, document: Document): void {
    const items = readdirSync(dirPath);

    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);

      if (item === 'environments') {
        continue;
      }

      if (stat.isDirectory()) {
        this.processDirectory(fullPath, document);
      } else if (item.endsWith('.bru')) {
        const content = readFileSync(fullPath, 'utf-8');
        const bruRequest = BrunoToJSONParser.parse(content) as BrunoRequest;
        const relativePath = relative(dirPath, fullPath).replace('.bru', '');

        const block = this.buildRequestBlock(bruRequest, relativePath, document);
        document.blocks.push(block);
      }
    }
  }

  private getEnvironments(dirPath: string): EnvironmentInfo[] {
    const environments: EnvironmentInfo[] = [];
    const environmentsDir = join(dirPath, 'environments');

    if (statSync(environmentsDir, { throwIfNoEntry: false })?.isDirectory()) {
      const envFiles = readdirSync(environmentsDir);

      for (const file of envFiles) {
        if (file.endsWith('.bru')) {
          const envContent = readFileSync(join(environmentsDir, file), 'utf-8');
          const environment = this.parseEnvironmentBruFile(envContent);

          environments.push({
            name: file.replace('.bru', ''),
            vars: environment.vars || {},
          });
        }
      }
    }

    return environments;
  }

  private readCollectionInfo(dirPath: string): BrunoCollection | undefined {
    try {
      const brunoJsonPath = join(dirPath, 'bruno.json');
      const content = readFileSync(brunoJsonPath, 'utf-8');
      return JSON.parse(content) as BrunoCollection;
    } catch {
      return undefined;
    }
  }

  parse(collectionPath: string): ParseResult {
    collectionInfo = this.readCollectionInfo(collectionPath);
    const environments = this.getEnvironments(collectionPath);

    if (environments.length === 0) {
      const document: Document = { variables: [], blocks: [] };
      this.processDirectory(collectionPath, document);
      return {
        documents: [document],
        environmentNames: ['default'],
        collectionName: collectionInfo?.name || 'bruno-collection',
      };
    }

    const documents = environments.map((env) => {
      const doc: Document = { variables: [], blocks: [] };
      this.processDirectory(collectionPath, doc);

      for (const [key, value] of Object.entries(env.vars)) {
        if (!doc.variables.some((v) => v.key === key)) {
          doc.variables.push({ key, value });
        }
      }

      return doc;
    });

    return {
      documents,
      environmentNames: environments.map((env) => env.name),
      collectionName: collectionInfo?.name || 'bruno-collection',
    };
  }
}
