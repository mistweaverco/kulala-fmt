import type { Document, Block } from './DocumentParser';
import type { BrunoEnvironment } from './BrunoEnvFiles';
import {
  applyPostmanAuth,
  collectAuthHeaderSecretVars,
  collectBlockText,
  convertPostmanOAuth2,
  extractTemplateVariables,
  type PostmanAuth,
} from './postmanAuth';

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
  auth?: PostmanAuth;
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
    mode: 'raw' | 'formdata' | 'urlencoded' | 'file' | 'graphql';
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
  auth?: PostmanAuth;
}

interface ParseResult {
  document: Document;
  collectionName: string;
  environments: BrunoEnvironment[];
}

export class PostmanDocumentParser {
  private buildRequestBlock(item: PostmanItem, inheritedAuth?: PostmanAuth): Block {
    const block: Block = {
      requestSeparator: {
        text: null,
      },
      metadata: [],
      comments: [],
      request: {
        method: item.request.method,
        url: item.request?.url?.raw,
        httpVersion: 'HTTP/1.1',
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
        key: 'name',
        value: item.name.replace(/\s+/g, '_').toUpperCase(),
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

    const effectiveAuth = item.request.auth ?? inheritedAuth;
    applyPostmanAuth(block, effectiveAuth);

    // Handle request body
    if (item.request.body?.mode === 'raw' && item.request.body.raw) {
      if (block.request) {
        block.request.body = item.request.body.raw;

        // Add Content-Type header if not present
        const contentType = item.request.body.options?.raw?.language || 'text/plain';
        if (!block.request.headers.some((h) => h.key.toLowerCase() === 'content-type')) {
          block.request.headers.push({
            key: 'Content-Type',
            value: this.getContentType(contentType),
          });
        }
      }
    }

    return block;
  }

  private getContentType(language: string): string {
    switch (language.toLowerCase()) {
      case 'json':
        return 'application/json';
      case 'xml':
        return 'application/xml';
      case 'javascript':
        return 'application/javascript';
      default:
        return 'text/plain';
    }
  }

  private processItems(
    items: (PostmanItem | PostmanItemGroup)[],
    document: Document,
    inheritedAuth?: PostmanAuth,
    parentPath: string = '',
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
        this.processItems(item.item, document, inheritedAuth, newPath);
      } else {
        // Process request
        const block = this.buildRequestBlock(item, inheritedAuth);
        document.blocks.push(block);
      }
    }
  }

  private isItemGroup(item: PostmanItem | PostmanItemGroup): item is PostmanItemGroup {
    return 'item' in item;
  }

  private collectAuths(collection: PostmanCollection): PostmanAuth[] {
    const auths: PostmanAuth[] = [];
    if (collection.auth) {
      auths.push(collection.auth);
    }

    const walk = (items: (PostmanItem | PostmanItemGroup)[]): void => {
      for (const item of items) {
        if (this.isItemGroup(item)) {
          walk(item.item);
        } else if (item.request.auth) {
          auths.push(item.request.auth);
        }
      }
    };

    walk(collection.item);
    return auths;
  }

  private buildEnvironments(collection: PostmanCollection, document: Document): BrunoEnvironment[] {
    const vars: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    const auth: BrunoEnvironment['auth'] = {};
    const authPrivate: BrunoEnvironment['authPrivate'] = {};

    if (collection.variable) {
      collection.variable
        .filter((variable) => variable.enabled !== false)
        .forEach((variable) => {
          vars[variable.key] = variable.value;
        });
    }

    for (const postmanAuth of this.collectAuths(collection)) {
      const oauth = convertPostmanOAuth2(postmanAuth);
      if (!oauth) continue;

      auth[oauth.authId] = oauth.publicConfig;
      if (Object.keys(oauth.privateConfig).length > 0) {
        authPrivate[oauth.authId] = oauth.privateConfig;
      }
    }

    const authHeaderSecrets = collectAuthHeaderSecretVars(document.blocks);
    const referencedVars = new Set<string>();

    for (const block of document.blocks) {
      for (const text of collectBlockText(block)) {
        for (const variable of extractTemplateVariables(text)) {
          referencedVars.add(variable);
        }
      }
    }

    for (const variable of referencedVars) {
      if (authHeaderSecrets.has(variable)) {
        secrets[variable] = secrets[variable] ?? '';
        continue;
      }

      if (!(variable in vars) && !(variable in secrets)) {
        vars[variable] = '';
      }
    }

    const hasContent =
      Object.keys(vars).length > 0 ||
      Object.keys(secrets).length > 0 ||
      Object.keys(auth ?? {}).length > 0 ||
      Object.keys(authPrivate ?? {}).length > 0;

    if (!hasContent) {
      return [];
    }

    return [
      {
        name: collection.info.name || 'default',
        vars,
        secrets,
        auth,
        authPrivate,
      },
    ];
  }

  parse(collection: PostmanCollection): ParseResult {
    const document: Document = {
      variables: [],
      blocks: [],
    };

    // Process all requests in the collection
    this.processItems(collection.item, document, collection.auth);

    const environments = this.buildEnvironments(collection, document);

    return {
      document: document,
      collectionName: collection.info.name,
      environments,
    };
  }
}
