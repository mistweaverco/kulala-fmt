import yaml from 'js-yaml';

interface YamlHeader {
  name?: string;
  value?: string;
  disabled?: boolean;
}

interface YamlParam {
  name?: string;
  value?: string;
  type?: 'query' | 'path';
  disabled?: boolean;
}

interface YamlBody {
  type?: string;
  data?: string | YamlFormEntry[] | YamlMultipartEntry[];
}

interface YamlFormEntry {
  name?: string;
  value?: string;
  disabled?: boolean;
}

interface YamlMultipartEntry {
  name?: string;
  value?: string;
  type?: string;
  contentType?: string;
  disabled?: boolean;
}

interface YamlScript {
  type?: string;
  code?: string;
}

interface YamlVariable {
  name?: string;
  value?: string | { type?: string; data?: string };
  disabled?: boolean;
  local?: boolean;
}

interface YamlRequestFile {
  opencollection?: string;
  info?: {
    name?: string;
    type?: string;
    seq?: number;
  };
  http?: {
    method?: string;
    url?: string;
    headers?: YamlHeader[];
    params?: YamlParam[] | { query?: YamlParam[]; path?: YamlParam[] };
    body?: YamlBody;
  };
  runtime?: {
    scripts?: YamlScript[];
    variables?: YamlVariable[];
  };
}

interface YamlEnvironmentFile {
  name?: string;
  variables?: Array<{
    name?: string;
    value?: string | { type?: string; data?: string };
    secret?: boolean;
    disabled?: boolean;
  }>;
}

interface YamlCollectionFile {
  opencollection?: string;
  info?: {
    name?: string;
  };
}

export interface BrunoYamlRequest {
  meta?: {
    name?: string;
    url?: string;
  };
  http?: {
    method?: string;
    url?: string;
  };
  headers?: Array<{ name: string; value: string; enabled?: boolean }>;
  params?: Array<{ name: string; value: string; enabled?: boolean; type?: 'query' | 'path' }>;
  vars?: {
    req?: Array<{ name: string; value: string; local?: boolean }>;
  };
  body?: {
    json?: string;
    graphql?: { query?: string; variables?: string };
    formUrlEncoded?: Array<{ name: string; value: string; enabled?: boolean }>;
    multipartForm?: Array<{ name: string; value: string; type?: string }>;
  };
  script?: {
    req?: string;
    res?: string;
  };
  tests?: string;
}

const parseYaml = (content: string): unknown => yaml.load(content);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeYamlVariableValue = (
  value: string | { type?: string; data?: string } | undefined,
): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'data' in value) {
    return value.data ?? '';
  }
  return '';
};

const normalizeParams = (
  params: YamlRequestFile['http'] extends { params?: infer P } ? P : never,
): BrunoYamlRequest['params'] => {
  if (!params) return undefined;

  if (Array.isArray(params)) {
    return params
      .filter((param) => param.name)
      .map((param) => ({
        name: param.name!,
        value: param.value ?? '',
        type: param.type,
        enabled: param.disabled !== true,
      }));
  }

  const result: NonNullable<BrunoYamlRequest['params']> = [];
  for (const param of params.query ?? []) {
    if (!param.name) continue;
    result.push({
      name: param.name,
      value: param.value ?? '',
      type: 'query',
      enabled: param.disabled !== true,
    });
  }
  for (const param of params.path ?? []) {
    if (!param.name) continue;
    result.push({
      name: param.name,
      value: param.value ?? '',
      type: 'path',
      enabled: param.disabled !== true,
    });
  }
  return result.length > 0 ? result : undefined;
};

const normalizeBody = (body: YamlBody | undefined): BrunoYamlRequest['body'] => {
  if (!body?.type) return undefined;

  switch (body.type) {
    case 'json':
      return { json: typeof body.data === 'string' ? body.data : '' };
    case 'form-urlencoded':
      return {
        formUrlEncoded: (Array.isArray(body.data) ? body.data : [])
          .filter((entry) => entry.name)
          .map((entry) => ({
            name: entry.name!,
            value: entry.value ?? '',
            enabled: entry.disabled !== true,
          })),
      };
    case 'multipart-form':
      return {
        multipartForm: (Array.isArray(body.data) ? body.data : [])
          .filter((entry) => entry.name)
          .map((entry) => ({
            name: entry.name!,
            value: entry.value ?? '',
            type: entry.type,
          })),
      };
    case 'graphql':
      if (typeof body.data === 'string') {
        return { graphql: { query: body.data } };
      }
      return undefined;
    default:
      return undefined;
  }
};

const normalizeVariables = (variables: YamlVariable[] | undefined): BrunoYamlRequest['vars'] => {
  if (!variables?.length) return undefined;

  const req = variables
    .filter((variable) => variable.name)
    .map((variable) => {
      let value = '';
      if (typeof variable.value === 'string') {
        value = variable.value;
      } else if (variable.value && typeof variable.value === 'object' && 'data' in variable.value) {
        value = variable.value.data ?? '';
      }

      return {
        name: variable.name!,
        value,
        local: variable.local === true,
      };
    });

  return req.length > 0 ? { req } : undefined;
};

const normalizeScripts = (
  scripts: YamlScript[] | undefined,
): Pick<BrunoYamlRequest, 'script' | 'tests'> => {
  if (!scripts?.length) return {};

  const result: Pick<BrunoYamlRequest, 'script' | 'tests'> = {};

  for (const script of scripts) {
    if (!script.code) continue;
    if (script.type === 'before-request') {
      result.script = { ...result.script, req: script.code };
    } else if (script.type === 'after-response') {
      result.script = { ...result.script, res: script.code };
    } else if (script.type === 'tests') {
      result.tests = script.code;
    }
  }

  return result;
};

const isRequestYaml = (parsed: unknown, filename: string): parsed is YamlRequestFile => {
  if (!isRecord(parsed)) return false;
  if ('opencollection' in parsed) return false;
  if (filename === 'folder.yml' || filename === 'folder.yaml') return false;
  if ('variables' in parsed && !('info' in parsed) && !('http' in parsed)) return false;

  const info = parsed.info;
  if (isRecord(info) && info.type === 'folder') return false;
  if (isRecord(info) && info.type === 'script') return false;

  return isRecord(parsed.info) && parsed.info.type === 'http' && isRecord(parsed.http);
};

export const BrunoYamlParser = {
  isOpenCollectionCollection(content: string): boolean {
    const parsed = parseYaml(content);
    return isRecord(parsed) && 'opencollection' in parsed;
  },

  parseCollection(content: string): { name: string } | undefined {
    const parsed = parseYaml(content) as YamlCollectionFile;
    if (!parsed?.info?.name) return undefined;
    return { name: parsed.info.name };
  },

  parseEnvironment(
    content: string,
    filename = 'environment.yml',
  ): {
    name: string;
    vars: Record<string, string>;
    secrets: Record<string, string>;
  } {
    const parsed = parseYaml(content) as YamlEnvironmentFile;
    const vars: Record<string, string> = {};
    const secrets: Record<string, string> = {};

    for (const variable of parsed.variables ?? []) {
      if (!variable.name) continue;

      if ('secret' in variable && variable.secret === true) {
        secrets[variable.name] = '';
      } else {
        vars[variable.name] = normalizeYamlVariableValue(variable.value);
      }
    }

    const fallbackName = filename.replace(/\.ya?ml$/, '');
    return {
      name: parsed.name ?? fallbackName,
      vars,
      secrets,
    };
  },

  parseRequest(content: string, filename = 'request.yml'): BrunoYamlRequest | null {
    const parsed = parseYaml(content);
    if (!isRequestYaml(parsed, filename)) {
      return null;
    }

    const headers = (parsed.http?.headers ?? [])
      .filter((header) => header.name)
      .map((header) => ({
        name: header.name!,
        value: header.value ?? '',
        enabled: header.disabled !== true,
      }));

    const scripts = normalizeScripts(parsed.runtime?.scripts);

    return {
      meta: {
        name: parsed.info?.name,
      },
      http: {
        method: parsed.http?.method,
        url: parsed.http?.url,
      },
      headers,
      params: normalizeParams(parsed.http?.params),
      vars: normalizeVariables(parsed.runtime?.variables),
      body: normalizeBody(parsed.http?.body),
      script: scripts.script,
      tests: scripts.tests,
    };
  },
};
