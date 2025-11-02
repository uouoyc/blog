---
title: Web Worker初学者指南
published: 2025-11-02
description: "了解什么是Web Worker及其工作原理，学习如何在前端项目中使用Web Worker来提升性能和用户体验。"
image: "./cover.webp"
tags: ["web-worker"]
category: "学习笔记"
draft: false
---

通常情况下，网页在执行复杂任务时可能会卡住，这是因为 JavaScript 默认在主线程执行，所有计算、渲染和用户交互都在同一线程上。如果遇到耗时任务，页面就会被阻塞，导致用户界面无响应。

Web Worker 可以为 Web 应用提供一种在 后台线程 中运行 JavaScript 的方法，它可以独立执行耗时任务，而不影响用户界面的流畅度。

Worker 线程可以执行纯计算任务，也可以发起网络请求（如 `Fetch` 或 `XMLHttpRequest`）。Worker 与主线程之间通过消息机制互相通信：主线程把任务分派给 Worker，Worker 完成后将结果发送回主线程。

## 核心限制与隔离环境

在开始使用之前，理解 Web Worker 的运行环境至关重要。Worker 运行在一个与主线程完全隔离的沙盒环境中。

- **无法操作 DOM**：Worker 无法访问主线程的 `window` 或 `document` 对象。这意味着你不能在 Worker 中进行任何 DOM 查询或界面更新。
- **独立的全局上下文**：Worker 拥有自己的全局作用域。对于专用 Worker，它是 `DedicatedWorkerGlobalScope`；对于共享 Worker，它是 `SharedWorkerGlobalScope`。在 Worker 内部，`self` 关键字指向这个全局作用域（即 `self === this`）。
- **通信方式**：唯一的通信渠道是使用 `postMessage()` 发送消息，并通过 `onmessage` 事件处理函数接收消息。
- **可用的 API**：虽然无法访问 DOM，但 Worker 内部仍然可以使用众多 Web API，包括：
  - `Fetch` / `XMLHttpRequest`
  - `WebSocket`
  - `IndexedDB`
  - ......
  - [查看 MDN 上的完整可用函数列表](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers)
- **脚本加载**：Worker 可以使用 `importScripts()` 函数同步加载外部脚本。
- **同源策略**：Worker 脚本文件必须遵守同源策略。

总的来说，Web Worker 提供了一个安全、隔离的后台环境，通过异步消息机制与主线程灵活通信，是处理耗时任务、避免 UI 阻塞的理想方案。

## 基本用法

### 专用 Worker

专用 worker 是指只能被创建它的那个主脚本所访问的 worker。创建专用 worker 的方法很简单，只需要调用 `Worker()` 构造函数即可：

```js
const myWorker = new Worker("worker.js");
```

你可以通过 `postMessage()` 方法向 worker 发送消息，并通过 `onmessage` 事件处理函数接收来自 worker 的消息。

我们将用一个密集型计算任务（计算 1 到 N 的累加和）来展示 Worker 的价值。

**index.html:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Web Worker</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
      }
      button {
        padding: 10px 20px;
        font-size: 16px;
      }
      #result,
      #main-counter {
        margin-top: 10px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <h1>计算 1 到 N 的累加和</h1>

    <button id="compute-btn">开始耗时计算</button>
    <div id="result">计算结果会显示在这里</div>
    <div id="main-counter">主线程计数器: 0</div>

    <script src="main.js"></script>
  </body>
</html>
```

**main.js:**

```js
const computeButton = document.getElementById("compute-btn");
const resultDisplay = document.getElementById("result");
const mainThreadCounter = document.getElementById("main-counter");

// 创建 Worker 实例
const myWorker = new Worker("calc-worker.js");

// 向 Worker 分配任务
computeButton.onclick = () => {
  const largeNumber = 10000000000;
  console.log("Main: 正在向 Worker 发送任务...");
  resultDisplay.textContent = "Worker 正在计算中...";
  myWorker.postMessage(largeNumber);
};

// 接收来自 Worker 的结果
myWorker.onmessage = (e) => {
  console.log("Main: 从 Worker 收到消息");
  resultDisplay.textContent = `计算结果: ${e.data}`;
};

// 在主线程上运行一个计数器，证明 Worker 运行时 UI 未被阻塞
let count = 0;
setInterval(() => {
  mainThreadCounter.textContent = `主线程计数器: ${count++}`;
}, 1000);
```

**calc-worker.js:**

```js
console.log("Worker: 脚本已加载，等待消息...");

onmessage = (e) => {
  console.log("Worker: 收到来自主脚本的消息");
  const maxNum = e.data;

  // 执行耗时计算
  let sum = 0;
  for (let i = 0; i < maxNum; i++) {
    sum += i;
  }

  // 计算完成，将结果发回主线程
  console.log("Worker: 计算完成，正在发回结果...");
  postMessage(sum);
};
```

在这个例子中，即使用户点击按钮执行了百亿次的循环，主线程的计数器依然会正常运行，证明了 UI 没有被阻塞。

> 在主线程中使用时，`onmessage` 和 `postMessage()` 必须挂在 `worker` 实例对象上 (如 `myWorker.onmessage`)。而在 worker 内部使用时，它们是全局作用域的一部分（即 `self.onmessage`）。
> 当一个消息在主线程和 worker 之间传递时，它默认被复制，而不是共享。

### 终止 worker

当 worker 完成任务以后，主线程可以调用 `terminate()` 方法来立即终止它，以释放资源。

```js
myWorker.terminate();
```

Worker 也可以在内部通过调用 `self.close()` 来自行终止。

### 处理错误

当 worker 出现运行中错误时，它的 `onerror` 事件处理函数会被调用。它会收到一个扩展了 `ErrorEvent` 接口的名为 `error` 的事件。

该事件不会冒泡并且可以被取消；为了防止触发默认动作，worker 可以调用错误事件的 `preventDefault()` 方法。

错误事件有以下三个关键字段：

- **message**：可读性良好的错误消息。
- **filename**：发生错误的脚本文件名。
- **lineno**：发生错误时所在脚本文件的行号。

### 生成 Subworker

如果需要，worker 能够生成更多的 worker，这就是所谓的 subworker。它们必须托管在同源的父页面内。并且，subworker 解析 URI 时会相对于父 worker 的地址而不是自身页面的地址。

### 引入脚本与库

Worker 线程能够访问一个全局函数 `importScripts()` 来引入脚本，该函数接受 0 个或者多个 URI 作为参数来引入资源；以下例子都是合法的：

```js
importScripts(); /* 什么都不引入 */
importScripts("foo.js"); /* 只引入 "foo.js" */
importScripts("foo.js", "bar.js"); /* 引入两个脚本 */
importScripts("//example.com/hello.js"); /* 你可以从其他来源导入脚本 */
```

浏览器同步加载并运行每一个列出的脚本。每个脚本中的全局对象都能够被 worker 使用。如果脚本无法加载，将抛出 `NETWORK_ERROR` 异常，接下来的代码也无法执行。

> 脚本的下载顺序不固定，但执行时会按照传入 `importScripts()` 中的文件名顺序进行。这个过程是同步完成的；直到所有脚本都下载并运行完毕，`importScripts()` 才会返回。

## 共享 Worker

一个共享 worker (Shared Worker) 可以被多个浏览上下文使用——即使这些脚本来自不同的 window、iframe，甚至是其他 worker。

> 如果共享 worker 可以被多个浏览上下文调用，所有这些浏览上下文必须属于同源（相同的协议，主机和端口号）。

### 生成一个共享 Worker

生成一个新的共享 worker 与生成一个专用 worker 非常相似，只是构造器的名字不同：

```js
const myWorker = new SharedWorker("worker.js");
```

一个非常大的区别在于，与一个共享 worker 通信必须通过一个 `port` 对象。这就像一个显式的通信“端口”。在专用 worker 中，这个端口是隐式创建和使用的。

在传递消息之前，端口连接必须被显式地打开，打开方式是使用 `onmessage` 事件处理函数（隐式打开）或者 `start()` 方法（显式打开）。

> 只有当你使用 `addEventListener()` 方式监听 `message` 事件时，才必须手动调用 `port.start()`。如果直接使用 `port.onmessage` 赋值，端口会自动打开。

### 共享 Worker 中消息的接收和发送

我们将用一个跨标签页状态同步的例子来演示。

**index.html:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Web Worker</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
      }
      button {
        padding: 10px 20px;
        font-size: 16px;
      }
      #status {
        margin-top: 10px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <h1>跨标签页状态同步示例</h1>

    <button id="update-btn">更新状态</button>
    <div id="status">状态显示在这里</div>

    <script src="main.js"></script>
  </body>
</html>
```

**main.js:**

```js
const updateBtn = document.getElementById("update-btn");
const statusDiv = document.getElementById("status");

// 创建 Worker 实例
const myWorker = new SharedWorker("shared-worker.js");

// 通过 port 对象发送消息
updateBtn.onclick = () => {
  const newMessage = `状态已更新: ${new Date().toLocaleTimeString()}`;
  myWorker.port.postMessage(newMessage);
};

// 通过 port 对象接收消息
myWorker.port.onmessage = (e) => {
  console.log("Main: 收到广播消息");
  statusDiv.textContent = e.data;
};
```

**shared-worker.js:**

```js
// 存储所有连接的端口
const connectedPorts = [];

// 1. 当一个新的上下文连接时，触发 'onconnect'
onconnect = (e) => {
  // 2. 获取这个新连接的端口
  const port = e.ports[0];

  // 3. 将端口存入列表
  connectedPorts.push(port);
  console.log(`Worker: 新连接加入, 总数: ${connectedPorts.length}`);

  // 4. 监听来自这个特定端口的消息
  port.onmessage = (e) => {
    const message = e.data;

    // 5. 广播！将收到的消息发送给所有连接的端口
    connectedPorts.forEach((p) => {
      p.postMessage(message);
    });
  };
};
```

现在，如果你打开多个相同的页面，在一个页面上点击更新按钮，所有其他页面的状态都会被这个共享 Worker 同步更新。

## 关于线程安全

Worker 接口会生成真正的操作系统级别的线程。在传统的多线程编程中，开发者需要手动处理内存同步、锁和竞态条件，这极易出错。

然而，对于 web worker 来说，与其他线程的通信点被严格控制。你无法访问非线程安全的组件（如 DOM），也没有共享的内存（默认情况下）。所有数据都通过序列化（复制）来传递。这意味着你很难在 Web Worker 中引起并发问题。

## 内容安全策略 (CSP)

有别于创建它的 document 对象，worker 有它自己的执行上下文。因此普遍来说，worker 并不受限于创建它的 document（或者父级 worker）的[内容安全策略](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CSP)。

例如，假设一个 document 有如下头部声明：

```js
Content-Security-Policy: script-src 'self'
```

这个声明会禁止页面内的脚本使用 `eval()`。然而，如果该脚本创建了一个 worker，在 worker 上下文中执行的代码仍然可以使用 `eval()`。

为了给 worker 指定内容安全策略，必须为发送 worker 代码的请求本身（即 `worker.js` 文件）设置 `Content-Security-Policy` 响应标头。

> worker 脚本的源如果是一个全局性的唯一的标识符（例如，它的 URL 协议为 `data:` 或 `blob:`），worker 则会继承创建它的 document 或者 worker 的 CSP。

## 数据的接收与发送

在主页面与 `worker` 之间传递的数据是通过**拷贝**，而不是共享来完成的。传递给 `worker` 的对象需要经过序列化，接下来在另一端还需要反序列化。页面与 `worker` 不会共享同一个实例，最终的结果就是在每次通信结束时生成了数据的一个副本。

### 结构化克隆

大部分浏览器使用[结构化克隆](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)算法来实现该特性。

这与 `JSON.stringify/JSON.parse` 不同，结构化克隆要强大得多。`JSON` 无法处理 `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer` 等类型，也无法处理循环引用。而结构化克隆可以正确地复制这些复杂对象。

> 结构化克隆无法复制 `Error` 对象和 `Function` 对象。

与 `JSON.stringify` 不同（它无法处理 `Date`、`Map` 等类型），结构化克隆可以保留复杂的数据类型。这里提供一个例子来证明结构化克隆的能力：

**index.html:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Worker 结构化克隆测试</title>
  </head>
  <body>
    <h1>查看控制台结果</h1>

    <script src="main.js"></script>
  </body>
</html>
```

**main.js:**

```js
const myWorker = new Worker("worker.js");

const complexData = {
  text: "你好",
  date: new Date(),
  map: new Map([
    ["a", 1],
    ["b", 2],
  ]),
  set: new Set([1, 2, 3]),
};

// 添加循环引用
complexData.self = complexData;

myWorker.postMessage(complexData);
```

**worker.js:**

```js
onmessage = (e) => {
  const data = e.data;

  // 验证数据类型是否保留
  console.log("接收到数据：", data);
  console.log(data.text);
  console.log(data.date instanceof Date);
  console.log(data.map.get("a"));
  console.log(data.set.has(3));
  console.log(data.self === data);
};
```

这个例子证明了数据是被深度复制，并且保留了其复杂的类型和结构。

### 构建基于 Promise 的通信系统

普通的 `postMessage()` / `onmessage` 通信是事件驱动式的，不太符合现代异步编程习惯。我们可以用 Promise 封装它，使主线程可以像调用异步函数一样与 Worker 交互。

**index.html:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Web Worker</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
      }
    </style>
  </head>
  <body>
    <h1>基于 Promise 的 Web Worker 示例</h1>
    <p>打开浏览器控制台查看输出结果</p>

    <script src="main.js"></script>
  </body>
</html>
```

**main.js:**

```js
class PromisedWorker {
  constructor(workerUrl) {
    this.worker = new Worker(workerUrl);
    this.messageHandlers = new Map(); // 存储 { id: { resolve, reject } }
    this.nextMessageId = 0;

    this.worker.onmessage = (e) => {
      const { id, status, result, error } = e.data;
      if (!this.messageHandlers.has(id)) return;

      const { resolve, reject } = this.messageHandlers.get(id);
      if (status === "success") {
        resolve(result);
      } else {
        reject(new Error(error));
      }
      this.messageHandlers.delete(id); // 完成后删除处理器
    };
  }

  // 发送任务并返回一个 Promise
  post(task, payload) {
    const id = this.nextMessageId++;
    return new Promise((resolve, reject) => {
      this.messageHandlers.set(id, { resolve, reject });
      this.worker.postMessage({ id, task, payload });
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

// --- 使用 ---
const myProWorker = new PromisedWorker("worker.js");

async function runTasks() {
  try {
    console.log("Main: 请求 'sum'...");
    const sumResult = await myProWorker.post("sum", [1, 2, 3, 4]);
    console.log("Main: 'sum' 结果:", sumResult);

    console.log("Main: 请求 'delay'...");
    const delayResult = await myProWorker.post("delay", 1000);
    console.log("Main: 'delay' 结果:", delayResult);
  } catch (err) {
    console.error("Main: Worker 任务失败", err);
  } finally {
    myProWorker.terminate();
  }
}
runTasks();
```

**worker.js:**

```js
const tasks = {
  sum: (payload) => payload.reduce((a, b) => a + b, 0),

  delay: (payload) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`Delayed for ${payload}ms`);
      }, payload);
    });
  },
};

onmessage = async (e) => {
  const { id, task, payload } = e.data;

  if (tasks[task]) {
    try {
      const result = await Promise.resolve(tasks[task](payload));
      postMessage({ id, status: "success", result });
    } catch (err) {
      postMessage({ id, status: "error", error: err.message });
    }
  } else {
    postMessage({ id, status: "error", error: `未知任务: ${task}` });
  }
};
```

这个实例实现了一种远程过程调用（RPC）的目标，并且代码更符合现代异步编程的习惯。

### 转移所有权

结构化克隆（复制）在处理大数据（如几百 MB 的 `ArrayBuffer`）时，性能开销会非常大。为此，现代浏览器包含另一种性能更高的方法：转移所有权。

[可转移对象](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Transferable_objects)从一个上下文转移到另一个上下文，而不会经过任何拷贝操作。

`postMessage` 的第二个参数是一个数组，用于指定哪些对象应该被转移。

**index.html:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Web Worker</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
      }
    </style>
  </head>
  <body>
    <h1>转移所有权</h1>
    <p>打开浏览器控制台查看输出结果</p>

    <script src="main.js"></script>
  </body>
</html>
```

**main.js:**

```js
const worker = new Worker("worker.js");

// 创建一个 32MB 的 ArrayBuffer
const uInt8Array = new Uint8Array(1024 * 1024 * 32);
for (let i = 0; i < uInt8Array.length; i++) {
  uInt8Array[i] = i % 256; // 填充一些内容
}

const buffer = uInt8Array.buffer;

console.log("Main: 转移前 buffer.byteLength =", buffer.byteLength);

// 将 buffer 转移给 worker
worker.postMessage(buffer, [buffer]);

console.log("Main: 转移后 buffer.byteLength =", buffer.byteLength);

// 监听 Worker 返回的数据
worker.onmessage = (e) => {
  const returnedBuffer = e.data;
  console.log(
    "Main: 收到 Worker 返回的 buffer.byteLength =",
    returnedBuffer.byteLength
  );
};
```

**worker.js:**

```js
onmessage = (e) => {
  const receivedBuffer = e.data;
  console.log("Worker: 收到 buffer.byteLength =", receivedBuffer.byteLength);

  // 再转回主线程
  postMessage(receivedBuffer, [receivedBuffer]);
};
```

这种方式几乎是瞬时完成的，因为它只涉及内存所有权的交接。这是处理大型二进制数据（如文件、图像数据）时的首选方案。
