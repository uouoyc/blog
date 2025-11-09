---
title: Web Worker使用教程
published: 2025-11-09
description: "了解什么是Web Worker及其工作原理，学习如何在前端项目中使用Web Worker来提升性能和用户体验。"
image: "./cover.webp"
tags: ["web worker"]
category: "学习笔记"
draft: false
---

通常情况下，网页在执行复杂任务时可能会卡住，这是因为 JavaScript 默认在主线程执行，所有计算、渲染和用户交互都在同一线程上。如果遇到耗时任务，页面就会被阻塞，导致用户界面无响应。

Web Worker 可以为 Web 应用提供一种在后台线程中运行 JavaScript 的方法，它可以独立执行耗时任务，而不影响用户界面的流畅度。

## Web Worker 的核心特性

在开始使用之前，我们需要先理解 Web Worker 的运行环境，Worker 是一个运行与主线程完全隔离的沙盒环境中，并且有以下几种特性：

- **无法操作 DOM**：Worker 无法访问主线程的 `window` 或 `document` 对象。这意味着你不能在 Worker 中进行任何 DOM 查询或界面更新。
- **独立的全局上下文**：Worker 拥有自己的全局作用域。对于专用 Worker，它是 `DedicatedWorkerGlobalScope`；对于共享 Worker，它是 `SharedWorkerGlobalScope`。在 Worker 内部，`self` 关键字指向这个全局作用域（即 `self === this`）。
- **通信方式**：唯一的通信渠道是使用 `postMessage()` 发送消息，并通过 `onmessage` 事件处理函数接收消息。
- **可用的 API**：虽然无法访问 DOM，但 Worker 内部仍然可以使用众多的 Web API，包括：
  - `Fetch` / `XMLHttpRequest`
  - `WebSocket`
  - `IndexedDB`
  - …
  - [查看 MDN 上的完整可用函数列表](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers)
- **脚本加载**：Worker 可以使用 `importScripts()` 函数同步加载外部脚本。
- **同源策略**：Worker 脚本文件必须遵守同源策略。

总的来说，Web Worker 提供了一个安全、隔离的后台环境，通过异步消息机制与主线程灵活通信，是处理耗时任务、避免 UI 阻塞的理想方案。

## 专用 Worker

这是最常用的 Worker 类型，仅由创建它的脚本访问。

### 创建与通信

Web Worker 的通信模型基于消息传递（message passing），这是一种典型的"生产者-消费者"模式：主线程是任务发起者（生产者），Worker 是任务执行者（消费者），双方通过异步消息交换数据。

#### 通信流程

1. 主线程调用 `worker.postMessage(data)`，将任务数据发送给 Worker
2. Worker 线程在 `self.onmessage` 回调中接收数据
3. Worker 处理完成后，调用 `self.postMessage(result)` 回传结果
4. 主线程通过 `worker.onmessage` 接收结果

```js
// main.js
const worker = new Worker("worker.js");
worker.postMessage({ type: "sum", numbers: [1, 2, 3, 4] });

worker.onmessage = (e) => {
  console.log("结果:", e.data);
};
```

```js
// worker.js
self.onmessage = (e) => {
  const { type, numbers } = e.data;
  if (type === "sum") {
    const result = numbers.reduce((a, b) => a + b, 0);
    self.postMessage(result);
  }
};
```

在上面的案例中，`postMessage()` 不是引用传递，而是使用[结构化克隆算法](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)对数据进行深拷贝。这意味着：

- 大对象（如 100MB 的 `ArrayBuffer`）会带来显著性能开销
- 函数、DOM 节点等类型无法传递，会抛出 `DATA_CLONE_ERR` 错误

在使用的时候，可以注意下面几点：

- 传递最小必要数据，避免发送整个大型对象
- 对于大数据（如图像、文件），优先考虑转移所有权
- 对复杂任务，建议封装为带 ID 的请求-响应协议

### 错误处理

Worker 运行时如果出错，主线程可以通过 `onerror` 事件捕获。这个错误事件包含了调试所需的关键信息：

- `message`：错误描述信息
- `filename`：出错的脚本文件路径
- `lineno`：错误发生的行号

需要注意的是，这个错误事件默认不会冒泡，但可以通过调用 `preventDefault()` 来阻止浏览器的默认错误处理行为。

```js
// main.js
const worker = new Worker("worker.js");

worker.onerror = (err) => {
  console.error(`Worker 错误: ${err.message}`);
  console.error(`文件: ${err.filename}`);
  console.error(`行号: ${err.lineno}`);

  err.preventDefault();
};

worker.postMessage({ type: "calculate", value: 100 });
```

```js
// worker.js
self.onmessage = (e) => {
  const { type, value } = e.data;

  if (type === "calculate") {
    throw new Error("计算过程中发生错误");
  }
};
```

### 关闭 Worker

Worker 提供两种关闭方式：

- `worker.terminate()`（主线程）：立即终止，不等待当前任务。这是一种强制性的终止方式，会立即停止 Worker 的执行，即使它正在处理任务。
- `self.close()`（Worker 内）：执行完当前 Event Loop 后关闭。这是一种优雅的关闭方式，允许 Worker 完成当前的消息处理后再退出。

建议任务完成后主动关闭 Worker，避免内存泄漏。

### 加载外部脚本

使用 `importScripts()` 同步加载传统脚本：

```js
// worker.js
importScripts("utils.js");

self.onmessage = (e) => {
  const { numbers } = e.data;

  const result = {
    sum: sum(numbers),
    average: average(numbers),
  };

  self.postMessage(result);
};
```

```js
// utils.js
function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function average(arr) {
  return sum(arr) / arr.length;
}
```

注意事项：

- `importScripts()` 是同步执行的，会阻塞 Worker 线程
- 支持跨域（需服务器允许 CORS）
- 可以同时加载多个脚本，按顺序执行
- 不支持 ES Module 语法

## 共享 Worker

共享 Worker 是一种特殊类型的 Web Worker，它允许多个浏览器上下文（如多个标签页、iframe、甚至其他 Worker）共享同一个后台线程。这使得它非常适合用于：

- 多页面状态同步
- 共享 WebSocket 连接
- 集中式数据缓存或计算服务

需要注意的是，Shared Worker 并非主流方案，浏览器兼容性相对较差。使用前务必评估兼容性需求。

### 创建与连接机制

与专用 Worker 不同，Shared Worker 的生命周期不由单个页面控制，而是由所有连接它的上下文共同维护。它的核心在于 `MessagePort` 通信端口，每个连接都获得一个独立的端口，彼此隔离。

#### 连接流程详解

1. 主线程执行 `new SharedWorker('shared.js')`，浏览器检查是否已有同源同脚本的 Shared Worker 实例
2. 若存在，则复用该实例；若不存在，则启动新线程
3. 触发 Worker 内的 `self.onconnect` 事件，传入一个 `MessagePort` 对象
4. 主线程通过 `sharedWorker.port` 获取该端口，并建立双向通信

```js
// main.js
const sharedWorker = new SharedWorker("shared-worker.js");
const port = sharedWorker.port;

// 使用 onmessage 会自动启动端口
port.onmessage = (e) => {
  console.log("收到:", e.data);
};

port.postMessage("Hello from page");

// 若使用 addEventListener，则必须手动启动
// port.addEventListener("message", (e) => {
//   console.log("收到:", e.data);
// });
// port.start(); // 必须调用
```

```js
// shared-worker.js
const ports = [];

self.onconnect = (e) => {
  const port = e.ports[0];
  ports.push(port);

  port.onmessage = (msg) => {
    // 广播给所有连接
    ports.forEach((p) => p.postMessage(`[广播] ${msg.data}`));
  };
};
```

为什么需要 `port.start()`？

当使用 `port.addEventListener('message', ...)` 时，浏览器不会自动启动消息通道，必须显式调用 `port.start()` 才能激活接收。而 `port.onmessage = ...` 是一种"赋值式监听"，浏览器会自动启动。

#### 安全与限制

- 同源策略严格：所有连接页面必须协议、域名、端口完全一致
- 无法访问 DOM：与专用 Worker 一样，Shared Worker 也无法操作页面
- 调试困难：无法通过普通 DevTools 查看日志，需使用 `chrome://inspect/#workers`

### 生命周期与清理

Shared Worker 的生命周期管理相对复杂：

- Worker 在至少有一个活跃端口时运行
- 所有端口关闭后，Worker 自动终止
- 建议监听 `port.onmessageerror` 清理失效端口，防止内存泄漏

```js
// shared-worker.js
const ports = new Set();

self.onconnect = (e) => {
  const port = e.ports[0];
  ports.add(port);

  port.onmessage = (msg) => {
    ports.forEach((p) => {
      try {
        p.postMessage(msg.data);
      } catch (err) {
        // 端口已关闭，从集合中移除
        ports.delete(p);
      }
    });
  };

  // 监听端口关闭
  port.onmessageerror = () => {
    ports.delete(port);
  };
};
```

### 调试技巧

Shared Worker 的 `console.log` 不会出现在主页面控制台。

正确的调试方式：

**Chrome / Edge：**

1. 在地址栏访问 `chrome://inspect/#workers`
2. 找到你的 Shared Worker，点击 "inspect"
3. 在打开的 DevTools 中查看日志和调试信息

**Firefox：**

1. 在地址栏访问 `about:debugging#workers`
2. 找到对应的 Shared Worker 进行调试

## 高级用法

### 基于 Promise 的封装

将事件驱动通信转为异步函数调用，更符合现代编程习惯。这种封装方式可以让 Worker 的使用更加直观，避免回调地狱，并且可以使用 async/await 语法。

```js
// main.js
class WorkerPromise {
  constructor(url) {
    this.worker = new Worker(url);
    this.handlers = new Map();
    this.id = 0;

    this.worker.onmessage = ({ data }) => {
      const { id, result, error } = data;
      const handler = this.handlers.get(id);
      if (handler) {
        this.handlers.delete(id);
        error ? handler.reject(new Error(error)) : handler.resolve(result);
      }
    };

    this.worker.onerror = (err) => {
      console.error("Worker 错误:", err);
      // 拒绝所有待处理的 Promise
      this.handlers.forEach((h) => h.reject(err));
      this.handlers.clear();
    };
  }

  call(payload) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.handlers.set(id, { resolve, reject });
      this.worker.postMessage({ id, payload });
    });
  }

  terminate() {
    this.worker.terminate();
    this.handlers.clear();
  }
}

// 使用示例
const wp = new WorkerPromise("worker.js");

// 可以使用 async/await
async function calculate() {
  try {
    const result = await wp.call(12345);
    console.log("平方结果:", result);
  } catch (err) {
    console.error("计算失败:", err);
  }
}
```

```js
// worker.js
self.onmessage = (e) => {
  const { id, payload: n } = e.data;

  try {
    const result = n * n;
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
```

这种封装的优势：

- 支持 async/await 语法，代码更清晰
- 自动管理消息 ID，避免响应混乱
- 统一的错误处理机制
- 易于扩展和维护

### 转移所有权

处理大文件（如图像、视频）时，结构化克隆的性能开销非常大。对于一个 100MB 的 `ArrayBuffer`，克隆可能需要数百毫秒，这会严重影响性能。

使用[可转移对象](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Transferable_objects)可以实现零拷贝传递，将数据的所有权直接转移给接收方，而不是创建副本。

```js
// main.js
const buffer = new ArrayBuffer(100 * 1024 * 1024); // 100MB

// 第二个参数是要转移的对象数组
worker.postMessage(buffer, [buffer]);

// 转移后，原始 buffer 不可再使用
console.log(buffer.byteLength); // 0
```

```js
// worker.js
self.onmessage = (e) => {
  const buf = e.data;
  console.log("收到的 buffer 大小:", buf.byteLength);

  // 处理数据...
  const view = new Uint8Array(buf);
  for (let i = 0; i < view.length; i++) {
    view[i] = i % 256;
  }

  // 可以转移回主线程
  self.postMessage(buf, [buf]);
};
```

注意事项：

- 转移后，发送方将无法再访问该对象
- 转移是单向的，每次只能属于一个上下文
- 适用于大数据传输，小数据不必使用
- 转移是同步的，不涉及序列化

### ES Module 模式

传统 Worker 只支持全局脚本（classic script），无法使用现代 JavaScript 的 `import/export` 语法。这导致代码难以模块化、复用和 tree-shaking。

#### 启用方式

只需在创建 Worker 时传入 `{ type: 'module' }`：

```js
// main.js
const worker = new Worker("worker.js", { type: "module" });
```

```js
// utils.js
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);

export const multiply = (a, b) => a * b;
```

```js
// worker.js
import { sum, multiply } from "./utils.js";

self.onmessage = (e) => {
  const { type, data } = e.data;

  if (type === "sum") {
    self.postMessage(sum(data));
  } else if (type === "multiply") {
    self.postMessage(multiply(data[0], data[1]));
  }
};
```

#### 注意事项

- 不能混用 `importScripts()`：ESM Worker 中调用 `importScripts()` 会抛出错误
- 路径必须显式：`import './utils.js'` 不能省略 `./`
- CORS 限制：模块文件必须满足 CORS 要求

动态路径处理：

```js
// 使用 new URL 确保路径在打包后仍正确
const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});
```

## 关于线程安全

Web Worker 使用真正的操作系统线程，但能通过以下机制避免并发问题：

### 安全机制

- 无共享内存（默认情况下）
- 通信仅通过消息复制
- 无法访问非线程安全资源（如 DOM）
- 每个 Worker 拥有独立的事件循环

因此，在正常使用 Web Worker 时，几乎不会出现竞态条件或数据竞争，开发者无需担心传统多线程编程中的锁、互斥量等复杂概念。

### SharedArrayBuffer 的特殊情况

`SharedArrayBuffer` 是一个例外，它允许在主线程和 Worker 之间共享内存。使用时需要注意：

- 必须使用 `Atomics` API 进行原子操作
- 需要处理潜在的竞态条件
- 需要特殊的 COOP 和 COEP HTTP 头才能使用

#### 为什么需要特殊的 HTTP 头

由于 Spectre 安全漏洞的影响，从 2018 年开始，浏览器禁用了共享内存功能。2020 年，通过引入跨域隔离（cross-origin isolation）机制，浏览器重新启用了这一功能。

要使用 `SharedArrayBuffer`，你的文档必须满足以下条件：

1. **处于安全上下文**：HTTPS
2. **跨域隔离**：设置以下 HTTP 响应头

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

这两个头的作用：

- `Cross-Origin-Opener-Policy: same-origin`（COOP）：确保文档与其他跨域文档隔离在不同的浏览器上下文组中
- `Cross-Origin-Embedder-Policy: require-corp`（COEP）：要求所有跨域资源必须明确允许被加载（通过 CORS 或 CORP 头）

你可以通过 `crossOriginIsolated` 属性检查文档是否已跨域隔离：

```js
// main.js
const myWorker = new Worker("worker.js");

if (crossOriginIsolated) {
  // 可以使用 SharedArrayBuffer
  const buffer = new SharedArrayBuffer(16);
  myWorker.postMessage(buffer);
} else {
  // 回退到普通 ArrayBuffer
  const buffer = new ArrayBuffer(16);
  myWorker.postMessage(buffer);
}
```

#### 使用示例

```js
// main.js
const sab = new SharedArrayBuffer(1024);
const view = new Int32Array(sab);

worker.postMessage(sab);

// 原子操作
Atomics.add(view, 0, 5);
console.log(Atomics.load(view, 0)); // 5
```

```js
// worker.js
self.onmessage = (e) => {
  const sab = e.data;
  const view = new Int32Array(sab);

  // 原子操作
  Atomics.add(view, 0, 10);
  console.log(Atomics.load(view, 0)); // 15
};
```

注意事项：`SharedArrayBuffer` 本身不是可转移对象，它通过 `postMessage` 传递时会在接收端创建一个新的 `SharedArrayBuffer` 对象，但两者引用的是同一块共享内存。

## 内容安全策略（CSP）

Web Worker 拥有独立的内容安全策略（CSP）上下文，与创建它的 Document 对象完全隔离。因此，其 CSP 不会继承自父文档或父 Worker，而是单独由 Worker 脚本资源（worker.js）的 HTTP 响应头或 Blob URL 所定义的 CSP 头决定。

### CSP 的应用规则

**普通 Worker（通过 URL 加载）：**

- CSP 策略仅由 Worker 脚本自身的 HTTP 响应头决定
- 主页面的 `<meta http-equiv="Content-Security-Policy">` 对 Worker 无效
- 若 Worker 脚本未设置 CSP，则默认无限制（可执行 `eval()`、内联脚本等）

**Blob/Data URL Worker（如 `new Worker(URL.createObjectURL(...))`）：**

- 继承创建者文档的 CSP 策略
- 因此受限于主页面的 `script-src` 指令

### 实际示例

假设主页面设置了严格的 CSP：

```http
Content-Security-Policy: script-src 'self'
```

这会阻止主页面使用 `eval()`，但如果 Worker 脚本（worker.js）没有设置自己的 CSP 头，Worker 内部仍然可以使用 `eval()`：

```js
// worker.js
self.onmessage = (e) => {
  // 这在 Worker 中是允许的（如果 worker.js 没有设置 CSP）
  const result = eval(e.data);
  self.postMessage(result);
};
```

### 安全建议

为 Worker 脚本单独设置 CSP：

```http
Content-Security-Policy: script-src 'self'; worker-src 'self'
```

其中 `worker-src` 指令用于控制 Worker、Shared Worker、Service Worker 的加载源。若未设置，则回退到 `child-src`，再回退到 `default-src`。

### 主页面控制 Worker 加载

主页面可以通过 `worker-src` 指令限制可以加载哪些 Worker：

```http
Content-Security-Policy: worker-src 'self' https://example.com
```

这样只有同源或来自 `https://example.com` 的 Worker 脚本才能被加载。

## 实际应用场景

### 图像处理

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>图像处理</title>
  </head>

  <body>
    <h1>图像处理</h1>
    <p>使用 Worker 进行图像灰度化处理</p>
    <div>
      <button onclick="loadImage()">加载示例图像</button>
      <button onclick="processImage()">灰度化处理</button>
    </div>
    <div class="canvas-container">
      <div>
        <h3>原图</h3>
        <canvas id="original" width="400" height="300"></canvas>
      </div>
      <div>
        <h3>处理后</h3>
        <canvas id="processed" width="400" height="300"></canvas>
      </div>
    </div>

    <script src="main.js"></script>
  </body>
</html>
```

```js
// main.js
const worker = new Worker("worker.js");
const originalCanvas = document.getElementById("original");
const processedCanvas = document.getElementById("processed");
const originalCtx = originalCanvas.getContext("2d");
const processedCtx = processedCanvas.getContext("2d");

worker.onmessage = (e) => {
  const processed = e.data;
  processedCtx.putImageData(processed, 0, 0);
};

function loadImage() {
  // 创建一个彩色渐变图像作为示例
  const width = originalCanvas.width;
  const height = originalCanvas.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = (x / width) * 255;
      const g = (y / height) * 255;
      const b = 128;
      originalCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      originalCtx.fillRect(x, y, 1, 1);
    }
  }
}

function processImage() {
  const imageData = originalCtx.getImageData(
    0,
    0,
    originalCanvas.width,
    originalCanvas.height
  );

  worker.postMessage({ imageData: imageData }, [imageData.data.buffer]);
}
```

```js
// worker.js
self.onmessage = (e) => {
  const imageData = e.data.imageData;
  const data = imageData.data;

  // 灰度化处理
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg;
    data[i + 1] = avg;
    data[i + 2] = avg;
  }

  self.postMessage(imageData, [imageData.data.buffer]);
};
```

### 大数据计算

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>大数据计算</title>
  </head>
  <body>
    <h1>质数计算</h1>
    <p>使用 Worker 计算质数，不阻塞主线程</p>
    <div>
      <input type="number" id="maxInput" value="100000" placeholder="最大值" />
      <button onclick="calculatePrimes()">计算质数</button>
    </div>
    <div id="result" style="white-space: pre-line; margin-top: 10px"></div>

    <script src="main.js"></script>
  </body>
</html>
```

```js
// main.js
const worker = new Worker("worker.js", { type: "module" });
const resultEl = document.getElementById("result");

async function calculatePrimes() {
  const max = parseInt(document.getElementById("maxInput").value);

  resultEl.textContent = `正在计算 ${max} 以内的质数...\n（主线程不会被阻塞，你可以继续操作页面）`;

  const start = performance.now();

  worker.postMessage({ task: "primes", max });

  worker.onmessage = (e) => {
    const primes = e.data;
    const time = performance.now() - start;

    resultEl.textContent = `找到 ${primes.length} 个质数\n`;
    resultEl.textContent += `耗时: ${time.toFixed(2)}ms\n\n`;
    resultEl.textContent += `前 20 个质数: ${primes
      .slice(0, 20)
      .join(", ")}...\n`;
    resultEl.textContent += `最后 10 个质数: ${primes.slice(-10).join(", ")}`;
  };
}
```

```js
// worker.js
function findPrimes(max) {
  const primes = [];
  const isPrime = new Array(max + 1).fill(true);

  for (let i = 2; i <= max; i++) {
    if (isPrime[i]) {
      primes.push(i);
      for (let j = i * i; j <= max; j += i) {
        isPrime[j] = false;
      }
    }
  }

  return primes;
}

self.onmessage = (e) => {
  const { task, max } = e.data;

  if (task === "primes") {
    const result = findPrimes(max);
    self.postMessage(result);
  }
};
```
