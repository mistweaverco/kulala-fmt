<div align="center">

![Kulala-fmt Logo][logo]

# kulala-fmt

[![npm][badge-npm]][link-npm]
[![latest release][badge-github]][link-github]
[![Discord][badge-discord]][discord]

[Install](#install) •
[Usage](#usage) •
[Configuration](#configuration) •
[Development](#development)

<p></p>

An opinionated 🦄 .http and .rest 🐼 files linter 💄 and formatter ⚡.

<p></p>

</div>

## Install

You can install kulala-fmt globally using `npm`, `bun`, `yarn` or `pnpm`:

```sh
npm install -g @mistweaverco/kulala-fmt
bun add -g @mistweaverco/kulala-fmt
yarn global add @mistweaverco/kulala-fmt
pnpm add -g @mistweaverco/kulala-fmt
```

You can also run it directly without installation using

`npx`, `bunx`, `yarn dlx` or `pnpx`:

```sh
npx @mistweaverco/kulala-fmt fix file.http
bunx @mistweaverco/kulala-fmt fix file.http
yarn dlx @mistweaverco/kulala-fmt fix file.http
pnpx @mistweaverco/kulala-fmt fix file.http
```

On install, kulala-fmt downloads a matching [kulala-core](https://github.com/mistweaverco/kulala-core) binary automatically. If install scripts are disabled (for example `npm install --ignore-scripts`), the binary is downloaded on first use instead.

To use your own kulala-core binary, set `KULALA_CORE_PATH`:

```sh
export KULALA_CORE_PATH=/path/to/kulala-core
```

## Usage

kulala-fmt can `fix`(alias `format`) and `check` `.http` and `.rest` files.

It can also `convert` between `.http` files and other API formats (OpenAPI, Postman, Bruno).

### Format / Fix

Format all `.http` and `.rest` files in the current directory and its subdirectories:

```sh
kulala-fmt fix
```

Format files in a specific directory:

```sh
kulala-fmt fix path/to/requests
```

or

```sh
kulala-fmt format
```

Format specific `.http` and `.rest` files:

```sh
kulala-fmt fix file1.http file2.rest http/*.http
```

Skip formatting request bodies:

```sh
kulala-fmt fix --no-body file.http
```

Format stdin input:

```sh
cat SOMEFILE.http | kulala-fmt fix --stdin
```

### Check

Check if all `.http` and `.rest` files in the current directory and
its subdirectories are formatted (shows a diff for files that need formatting):

```sh
kulala-fmt check
```

Check a specific directory:

```sh
kulala-fmt check path/to/requests
```

Check without diff output:

```sh
kulala-fmt check --quiet
```

Check if specific `.http` and `.rest` files are formatted:

```sh
kulala-fmt check file1.http file2.rest http/*.http
```

Check stdin input:

```sh
cat SOMEFILE.http | kulala-fmt check --stdin
```

### Convert

kulala-fmt supports bidirectional conversion between `.http` files and several API formats.
Use `--from` and `--to` to select the source and destination format (defaults: `openapi` → `http`).

#### OpenAPI / Swagger to `.http`

Convert OpenAPI 3.x or Swagger 2.0 `.yaml`, `.yml` or `.json` files to `.http` files.
Query, path, header, and request body parameters are included; Swagger 2.0 `definitions` and `in: body` parameters are supported.

```sh
kulala-fmt convert --from openapi openapi.yaml
kulala-fmt convert swagger.json
```

#### Postman collection to `.http`

Convert Postman collection `.json` files to `.http` files:

```sh
kulala-fmt convert --from postman postman.json
```

#### `.http` to Postman collection

Convert one or more `.http` / `.rest` files (or a directory) to a Postman Collection v2.1 `.json` file.
Directory structure is preserved as Postman folders.

```sh
kulala-fmt convert --from http --to postman requests.http
kulala-fmt convert --from http --to postman ./api/
kulala-fmt convert --from http --to postman *.http -o my-collection.json
```

Inject variables from an environment file:

```sh
kulala-fmt convert --from http --to postman requests.http --env .env
kulala-fmt convert --from http --to postman requests.http --env http-client.env.json
```

#### Bruno to `.http`

Convert Bruno collections to `.http` files.
Request variables (`vars:pre-request`), environment variables, query/path params, and scripts are preserved.

```sh
kulala-fmt convert --from bruno path/to/bruno/collection
```

## Configuration

kulala-fmt reads `kulala-fmt.yaml` from the current working directory. Create one with:

```sh
kulala-fmt init
```

Example configuration:

```yaml
# yaml-language-server: $schema=https://kulala.app/kulala-fmt.schema.json
defaults:
  http_method: GET
  http_version: HTTP/1.1
body:
  format:
    indent: 2
    line_width: 80
    expand_tabs: true
```

All fields are optional.
See [`config.schema.json`](./config.schema.json)
or the published schema at
https://kulala.app/kulala-fmt.schema.json for the full reference.

`defaults.http_version` can also be set to `false` to
omit the HTTP version from request lines.

## What does it do?

- Checks if the file is formatted and valid
- Removes extraneous newlines
- Lowercases all headers (when HTTP/2 or HTTP/3) else
  it'll uppercase the first letter
- Puts all metadata right before the request line

So a perfect request would look like this:

```http
@SOME_DOCUMENT_VARIABLE1 = some value

### REQUEST_NAME_ONE

# This is a comment
# @kulala-curl--insecure
# This is another comment

POST https://echo.kulala.app/post HTTP/1.1
Content-Type: application/json

{
  "key": "{{ SOME_DOCUMENT_VARIABLE1 }}"
}
```

or this:

```http
@SOME_DOCUMENT_VARIABLE1 = some value

### REQUEST_NAME_ONE

# This is a comment
# @kulala-curl--insecure
# This is another comment

POST https://echo.kulala.app/post HTTP/2
content-type: application/json

{
  "key": "{{ SOME_DOCUMENT_VARIABLE1 }}"
}
```

## Development

Clone the repository and install dependencies with [pnpm](https://pnpm.io/):

```sh
pnpm install
pnpm run build
```

Other useful commands:

```sh
pnpm run lint
node dist/cli.cjs --help
```

## Use it with conform.nvim

```lua
return {
  "stevearc/conform.nvim",
  config = function()
    require("conform").setup({
      formatters_by_ft = {
        http = { "kulala-fmt" },
      },
      format_on_save = true,
    })
  end,
}
```

[logo]: https://raw.githubusercontent.com/mistweaverco/kulala-fmt/main/logo.svg
[discord]: https://mistweaverco.com/discord
[badge-discord]: https://mistweaverco.com/assets/badges/discord.svg
[badge-github]: https://img.shields.io/github/v/release/mistweaverco/kulala-fmt?style=for-the-badge
[link-github]: https://github.com/mistweaverco/kulala-fmt/releases/latest
[badge-npm]: https://img.shields.io/npm/v/@mistweaverco/kulala-fmt?style=for-the-badge
[link-npm]: https://www.npmjs.com/package/@mistweaverco/kulala-fmt
