<div align="center">

![Kulala-fmt Logo](logo.svg)

# kulala-fmt

[![NPM](https://img.shields.io/npm/v/@mistweaverco/kulala-fmt?style=for-the-badge)](https://www.npmjs.com/package/@mistweaverco/kulala-fmt)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=FFF)](https://www.typescriptlang.org/)
[![Rollup](https://img.shields.io/badge/Rollup-bd0f0f.svg?style=for-the-badge&logo=rollup.js&logoColor=FFF)](https://rollupjs.org/)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/mistweaverco/kulala-fmt?style=for-the-badge)](https://github.com/mistweaverco/kulala-fmt/releases/latest)
[![Discord](https://img.shields.io/badge/discord-join-7289da?style=for-the-badge&logo=discord)](https://discord.gg/QyVQmfY4Rt)

[Install](#install) • [Usage](#usage)

<p></p>

An opinionated 🦄 .http and .rest 🐼 files linter 💄 and formatter ⚡.

<p></p>

</div>

## Install

Via npm:

```sh
npm install -g @mistweaverco/kulala-fmt
```

You can also run it directly without installation using npx:

```sh
# From npm registry
npx @mistweaverco/kulala-fmt format file.http

# Directly from GitHub
npx github:mistweaverco/kulala-fmt format file.http
```

## Usage

kulala-fmt can `format` and `check` `.http` and `.rest` files.

It can also `convert` OpenAPI `.yaml`, `.yml` or `.json` files to `.http` files.

### Format

Format all `.http` and `.rest` files in the current directory and its subdirectories:

```sh
kulala-fmt format
```

Format specific `.http` and `.rest` files.

```sh
kulala-fmt format file1.http file2.rest http/*.http
```

Format stdin input:

```sh
cat SOMEFILE.http | kulala-fmt format --stdin
```

### Check

Check if all `.http` and `.rest` files in the current directory and its subdirectories are formatted:

```sh
kulala-fmt check
```

Check if specific `.http` and `.rest` files are formatted:

```sh
kulala-fmt check file1.http file2.rest http/*.http
```

Check if all `.http` and `.rest` files in the current directory and
its subdirectories are formatted and
prints the desired output to the console:

```sh
kulala-fmt check --verbose
```

Check if specific `.http` and `.rest` files are formatted and
prints the desired output to the console:

```sh
kulala-fmt check --verbose file1.http file2.rest http/*.http
```

Check stdin input:

```sh
cat SOMEFILE.http | kulala-fmt format --stdin
```

### Convert

#### OpenAPI to `.http`

Convert OpenAPI `.yaml`, `.yml` or `.json` files to `.http` files:

```sh
kulala-fmt convert --from openapi openapi.yaml
```

#### Postman collection to `.http`

Convert Postman collection `.json` files to `.http` files:

```sh
kulala-fmt convert --from postman postman.json
```

#### Bruno to `.http`

Convert Bruno collections to `.http` files:

```sh
kulala-fmt convert --from bruno path/to/bruno/collection
```

## What does it do?

- Checks if the file is formatted and valid
- Removes extraneous newlines
- Makes sure document variables are at the top of the file
- Lowercases all headers (when HTTP/2 or HTTP/3) else it will uppercase the first letter
- Puts all metadata right before the request line
- Ensures all comments are at the top of the request

So a perfect request would look like this:

```http
@variables1 = value1


### REQUEST_NAME_ONE

# This is a comment
# This is another comment
# @someother metatag
GET http://localhost:8080/api/v1/health HTTP/1.1
Content-Type: application/json

{
  "key": "value"
}
```

or this:

```http
@variables1 = value1


### REQUEST_NAME_ONE

# This is a comment
# This is another comment
# @someother metatag
GET http://localhost:8080/api/v1/health HTTP/2
content-type: application/json

{
  "key": "value"
}
```

## Use it with conform.nvim

```lua
return {
  "stevearc/conform.nvim",
  config = function()
    require("conform").setup({
      formatters = {
        kulala = {
          command = "kulala-fmt",
          args = { "format", "$FILENAME" },
          stdin = false,
        },
      },
      formatters_by_ft = {
        http = { "kulala" },
      },
      format_on_save = true,
    })
  end,
}
```
