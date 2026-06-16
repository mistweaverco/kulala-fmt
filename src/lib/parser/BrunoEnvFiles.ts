export interface BrunoEnvironment {
  name: string;
  vars: Record<string, string>;
  secrets: Record<string, string>;
}

const HTTP_CLIENT_ENV_SCHEMA = 'https://kulala.app/http-client.env.schema.json';
const HTTP_CLIENT_PRIVATE_ENV_SCHEMA = 'https://kulala.app/http-client.private.env.schema.json';

type HttpClientEnvFile = Record<string, Record<string, string>> & {
  $schema?: string;
};

export function buildHttpClientEnvJson(environments: BrunoEnvironment[]): HttpClientEnvFile {
  const file: HttpClientEnvFile = {
    $schema: HTTP_CLIENT_ENV_SCHEMA,
  };

  for (const environment of environments) {
    if (Object.keys(environment.vars).length > 0) {
      file[environment.name] = { ...environment.vars };
    }
  }

  return file;
}

export function buildHttpClientPrivateEnvJson(
  environments: BrunoEnvironment[],
): HttpClientEnvFile | null {
  const file: HttpClientEnvFile = {
    $schema: HTTP_CLIENT_PRIVATE_ENV_SCHEMA,
  };

  let hasSecrets = false;

  for (const environment of environments) {
    if (Object.keys(environment.secrets).length > 0) {
      file[environment.name] = { ...environment.secrets };
      hasSecrets = true;
    }
  }

  return hasSecrets ? file : null;
}
