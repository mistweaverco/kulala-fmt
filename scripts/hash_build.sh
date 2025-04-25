#!/usr/bin/env bash

FMT_DIR=./

echo "Saving hash to .build_hash"
tar -C $FMT_DIR -cf - --sort=name src package.json | sha256sum | cut -d' ' -f1 | tr -d $'\n' > $FMT_DIR/.build_hash
