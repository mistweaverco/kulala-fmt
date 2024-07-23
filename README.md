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

 - [Linux](https://github.com/mistweaverco/kulala-fmt/releases/latest/download/kulala-fmt-linux)
 - [Mac](https://github.com/mistweaverco/kulala-fmt/releases/latest/download/kulala-fmt-macos)
 - [Windows](https://github.com/mistweaverco/kulala-fmt/releases/latest/download/kulala-fmt.exe)

## Usage

Format all `.http` and `.rest` files in the current directory and its subdirectories:

```sh
kulala-fmt
```

Format all `.http` and `.rest` files in the current directory and its subdirectories and
prints the written output to the console:

```sh
kulala-fmt --verbose
```


Check if all `.http` and `.rest` files in the current directory and its subdirectories are formatted:

```sh
kulala-fmt --check
```

Check if all `.http` and `.rest` files in the current directory and
its subdirectories are formatted and
prints the desired output to the console:

```sh
kulala-fmt --check --verbose
```
