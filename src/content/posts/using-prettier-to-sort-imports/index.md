---
title: 使用Prettier对Import进行排序
published: 2025-08-24
description: "使用Prettier来自动排序JavaScript/TypeScript文件中的import语句。"
image: "./cover.webp"
tags: ["prettier"]
category: "学习笔记"
draft: false
---

在日常开发中，为了使项目中的代码整洁有序，我们除了格式化代码，也需要对 `import` 进行一个格式化。

这里我们用到的包是 `@trivago/prettier-plugin-sort-imports`，它是一个 `Prettier` 插件，可以帮助我们自动排序 `import` 语句。

## 安装插件

我们先在项目中安装下面的依赖：

```bash
pnpm add -D prettier @trivago/prettier-plugin-sort-imports
```

## 配置规则

然后在项目根目录下创建 `.prettierrc` 这样一个文件，之后就可以对规则进行配置：

```json
// .prettierrc
{
  "plugins": ["@trivago/prettier-plugin-sort-imports"],
  "tabWidth": 2,
  "trailingComma": "all",
  "singleQuote": false,
  "jsxSingleQuote": false,
  "semi": true,
  "endOfLine": "lf",
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true,
  "importOrder": [
    "^react",
    "^next",
    "<THIRD_PARTY_MODULES>",
    "@/app/(.*)",
    "@/components/(.*)",
    "@/libs/(.*)",
    "@/.*",
    "^./(.*)",
    "^../(.*)",

    ".(css|less|scss|sass|stylus)$"
  ]
}
```

这里主要介绍下面几个配置项：

**importOrder**：这是一个正则表达式数组，用于定义你 `import` 语句的排序规则和分组顺序，这里的规则是：

1. 以 `react` 开头的导入语句排在最前面。
2. 接着是以 `next` 开头的导入语句。
3. 然后是所有第三方模块（`<THIRD_PARTY_MODULES>` 是一个特殊的占位符，表示所有未被其他规则匹配的第三方模块）。
4. 接下来是以 `@/app/`、`@/components/`、`@/libs/` 和 `@/` 开头的导入语句，分别对应项目中的不同目录。
5. 再之后是相对路径的导入语句，先是当前目录（`./`）的导入，然后是上级目录（`../`）的导入。
6. 最后是样式文件的导入（如 `.css`, `.less`, `.scss`, `.sass`, `.stylus`）。

**importOrderSeparation**：会在你定义的每个导入分组之间添加一个空行。

- 当值为 `true` 时：

```tsx
import { useState } from "react";

import Link from "next/link";

import axios from "axios";
import dayjs from "dayjs";

import Header from "@/components/Header";
```

- 当值为`false`时：

```tsx
import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import dayjs from "dayjs";
import Header from "@/components/Header";
```

**importOrderSortSpecifiers**：会按字母顺序对单个导入语句中的命名导入进行排序。

- 当值为 `true` 时：

```tsx
import { useEffect, useRef, useState, useTransition } from "react";
```

- 当值为 `false` 时：

```tsx
import { useRef, useState, useEffect, useTransition } from "react";
```

## 使用注意

当项目中使用了 `prettier-plugin-tailwindcss` 的话，需要把这个插件放在最下面，否则这个类名排序插件和其他的 `Prettier` 插件可能会有一个兼容性问题。

```json
// .prettierrc
{
  "plugins": [
    "@trivago/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss"
  ]
}
```
