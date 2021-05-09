<div align="center">

# Fushra MEML

Write simpler code to target the web

[![forthebadge](https://forthebadge.com/images/badges/built-by-developers.svg)](https://forthebadge.com)
[![forthebadge](https://forthebadge.com/images/badges/made-with-typescript.svg)](https://forthebadge.com)

</div>

## Installation and usage

Before you install, make sure you have both `node` and `npm` on your computer. Create a folder that you want your MEML project to be in and run `npm init` to set it up.

Then install the development version of MEML by running:

```sh
npm install fushra/meml
```

You can then run it with

```sh
npx memlc --file [fileName]
```

## Source and out directories

There are very few cases where you want the output of memlc to be dumped in the same folder as your source files. To handle this, memlc offers both `--src` and `--out` flags. When you set both of these flags, `--file` will now be relative to `--src` and the outputs will be dumped in `--out`. For example:

```sh
npx memlc --file ./src/index.meml # Will output in ./src/index.html
# Becomes
npx memlc --src ./src/ --file index.meml --out ./public/ # Will output in ./public/index.html
```

## Fushra MEML vs Fivnex MEML

Fushra is part of Fivnex, the company responsible for maintaining the MEML standard. At the time of writing Fivnex doesn't have a functional MEML implementation. They plan to have a MEML implementation, but it depends on the creation of their keter programing language. Fushra MEML fills the gap, creating a MEML implementation that can be used today whilst developing the MEML standard.

## Boring legal stuff

MemlC Copyright (C) 2021 Fushra & Fivnex

This program comes with ABSOLUTELY NO WARRANTY. This is free software, and you are welcome to redistribute it under certain conditions. For more information see the [license](./LIVENSE) file.
