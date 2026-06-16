import { BrunoToJSONParser } from './BrunoToJson';
import { BrunoYamlParser, type BrunoYamlRequest } from './BrunoYamlToJson';
import type { BrunoEnvironment } from './BrunoEnvFiles';
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
  secrets?: Record<string, string>;
}

interface ParseResult {
  document: Document;
  environments: BrunoEnvironment[];
  collectionName: string;
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
    formUrlEncoded?: Array<{ name: string; value: string; enabled?: boolean }>;
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

type BrunoParsedRequest = BrunoRequest | BrunoYamlRequest;

interface BrunoHeader {
  name: string;
  value: string;
  enabled?: boolean;
}

let collectionInfo: BrunoCollection | undefined;

export class BrunoDocumentParser {
  private parseEnvironmentBruFile(content: string): BrunoEnvironmentVars {
    const environment: BrunoEnvironmentVars = { vars: {}, secrets: {} };
    let isInVarsBlock = false;

    const secretListMatch = content.match(/vars:secret\s*\[([\s\S]*?)\]/);
    if (secretListMatch?.[1]) {
      for (const entry of secretListMatch[1].split(',')) {
        const name = entry.trim().replace(/^~/, '');
        if (name) {
          environment.secrets![name] = '';
        }
      }
    }

    for (const line of content.split('\n')) {
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
    bruRequest: BrunoParsedRequest,
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
        text: bruRequest.meta?.name ?? folderPath ?? null,
      },
      metadata: [],
      comments: [],
      request,
      preRequestScripts: [],
      postRequestScripts: [],
      responseRedirect: null,
    };

    if (folderPath) {
      block.comments.push(`# Converted from Bruno: ${folderPath}\n`);
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

  private isRequestFile(filename: string): boolean {
    if (filename.endsWith('.bru')) return true;
    if (filename === 'opencollection.yml' || filename === 'opencollection.yaml') return false;
    if (filename === 'folder.yml' || filename === 'folder.yaml') return false;
    return filename.endsWith('.yml') || filename.endsWith('.yaml');
  }

  private parseRequestFile(content: string, filename: string): BrunoParsedRequest | null {
    if (filename.endsWith('.bru')) {
      return BrunoToJSONParser.parse(content) as BrunoRequest;
    }

    return BrunoYamlParser.parseRequest(content, filename);
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
      } else if (this.isRequestFile(item)) {
        const content = readFileSync(fullPath, 'utf-8');
        const bruRequest = this.parseRequestFile(content, item);
        if (!bruRequest) continue;

        const relativePath = relative(dirPath, fullPath).replace(/\.(bru|ya?ml)$/, '');

        const block = this.buildRequestBlock(bruRequest, relativePath, document);
        document.blocks.push(block);
      }
    }
  }

  private getEnvironments(dirPath: string): BrunoEnvironment[] {
    const environments: BrunoEnvironment[] = [];
    const environmentsDir = join(dirPath, 'environments');

    if (statSync(environmentsDir, { throwIfNoEntry: false })?.isDirectory()) {
      const envFiles = readdirSync(environmentsDir);

      for (const file of envFiles) {
        if (file.endsWith('.bru')) {
          const envContent = readFileSync(join(environmentsDir, file), 'utf-8');
          const environment = this.parseEnvironmentBruFile(envContent);

          environments.push({
            name: file.replace(/\.bru$/, ''),
            vars: environment.vars || {},
            secrets: environment.secrets || {},
          });
        } else if (file.endsWith('.yml') || file.endsWith('.yaml')) {
          const envContent = readFileSync(join(environmentsDir, file), 'utf-8');
          const environment = BrunoYamlParser.parseEnvironment(envContent, file);

          environments.push(environment);
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
      try {
        const openCollectionPath = join(dirPath, 'opencollection.yml');
        const content = readFileSync(openCollectionPath, 'utf-8');
        const collection = BrunoYamlParser.parseCollection(content);
        if (!collection) return undefined;
        return {
          version: '1',
          name: collection.name,
          type: 'collection',
        };
      } catch {
        return undefined;
      }
    }
  }

  parse(collectionPath: string): ParseResult {
    collectionInfo = this.readCollectionInfo(collectionPath);
    const environments = this.getEnvironments(collectionPath);
    const document: Document = { variables: [], blocks: [] };
    this.processDirectory(collectionPath, document);

    return {
      document,
      environments,
      collectionName: collectionInfo?.name || 'bruno-collection',
    };
  }
}
