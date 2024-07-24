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

Just grab the latest release:

 - [Linux](https://github.com/mistweaverco/kulala-fmt/releases/download/latest/kulala-fmt-linux)
 - [Mac](https://github.com/mistweaverco/kulala-fmt/releases/download/latest/kulala-fmt-macos)
 - [Windows](https://github.com/mistweaverco/kulala-fmt/releases/download/latest/kulala-fmt.exe)

## Usage

Format all `.http` and `.rest` files in the current directory and its subdirectories:

```sh
kulala-fmt
```

Format specific `.http` and `.rest` files.

```sh
kulala-fmt file1.http file2.rest http/*.http
```

Format all `.http` and `.rest` files in the current directory and its subdirectories and
prints the written output to the console:

```sh
kulala-fmt --verbose
```
Format specific `.http` and `.rest` files and
prints the written output to the console:

```sh
kulala-fmt --verbose file1.http file2.rest http/*.http
```

Check if all `.http` and `.rest` files in the current directory and its subdirectories are formatted:

```sh
kulala-fmt --check
```

Check if specific `.http` and `.rest` files are formatted:

```sh
kulala-fmt --check file1.http file2.rest http/*.http
```

Check if all `.http` and `.rest` files in the current directory and
its subdirectories are formatted and
prints the desired output to the console:

```sh
kulala-fmt --check --verbose
```

Check if specific `.http` and `.rest` files are formatted and
prints the desired output to the console:

```sh
kulala-fmt --check --verbose file1.http file2.rest http/*.http
```

## What does it do?

- Checks if the file is formatted and valid
- Removes extraneous newlines
- Makes sure document variables are at the top of the file
- Lowercases all headers
- Puts all metadata right after the headers
- Ensures all comments are using `#` and not `//`

If run on all files it also warns when it finds both `.env` and `http-client.env.json`
files in the same directory, because that might cause unexpected behavior.
