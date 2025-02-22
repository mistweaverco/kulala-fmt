<div align="center">

![Kulala-fmt Logo](logo.svg)

# kulala-fmt

[![Go](https://img.shields.io/badge/Made%20with%20Go-00ADD8.svg?style=for-the-badge&logo=go&logoColor=ffffff)](https://golang.org)
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

## Usage

Format all `.http` and `.rest` files in the current directory and its subdirectories:

```sh
kulala-fmt format
```

Format specific `.http` and `.rest` files.

```sh
kulala-fmt format file1.http file2.rest http/*.http
```

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


# This is a comment
# This is another comment
# @someother metatag
# @name REQUEST_NAME_ONE
GET http://localhost:8080/api/v1/health HTTP/1.1
Content-Type: application/json

{
  "key": "value"
}

###
```

or this:

```http
@variables1=value1


# This is a comment
# This is another comment
# @someother metatag
# @name REQUEST_NAME_ONE
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
