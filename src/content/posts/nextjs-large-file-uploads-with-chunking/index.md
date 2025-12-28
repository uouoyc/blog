---
title: NextJS实现大文件分片上传、断点续传与秒传
published: 2025-12-02
description: "利用队列调度实现高并发控制，通过MD5预检实现秒传与断点续传，使用流式合并确保低内存占用的大文件上传方案。"
image: "./cover.webp"
tags: ["react", "nextjs", "file uploads"]
category: "学习笔记"
draft: false
---

我们的核心思路是将大文件通过切割成无数个微小的分片（Chunk），然后上传这些分片，最后再通过合并分片，实现文件的分片上传、断点续传以及秒传等功能。

::github{repo="uouoyc/next-file-upload-demo"}

## 文件选择与队列调度

当用户通过拖拽或点击选择**一批文件**（可能是几百个）时，我们绝不能简单粗暴地同时对所有文件发起上传请求。因为瞬间爆发的大量请求不仅会**阻塞浏览器对其他关键资源的加载**，更可能导致整个 UI 线程卡顿，使用户体验极差。

因此，我们在会前端引入一个**文件上传队列**来管理并发。

### 状态初始化与入队

在前端，我们维护了一个 `queueRef` 队列作为任务池。当用户选择文件后，我们首先执行以下步骤：

1. **封装数据：** 将每个原始 `File` 对象封装成一个包含元数据的 `FileItem` 对象。
2. **初始化状态：** 将 `FileItem` 的状态初始化为 `"pending"`，进度为 `0`。
3. **推入队列：** 将新创建的 `FileItem` 推入 `queueRef` 等待调度。
4. **触发调度器：** 随后立即调用 `processQueue()` 尝试开始处理。

```ts
// hooks/useFileUpload.ts
const addFiles = useCallback(async (fileList: FileList) => {
  const newFiles: FileItem[] = Array.from(fileList).map((file) => ({
    id: crypto.randomUUID(),
    file,
    status: "pending", // 初始状态
    progress: 0,
    // ...其他属性
  }));

  setFiles((prev) => [...prev, ...newFiles]); // 更新状态
  queueRef.current.push(...newFiles); // 加入后台队列
  processQueue(); // 触发调度器
}, []);
```

### 文件级并发调度

调度器 `processQueue` 是确保系统健康运行的核心。它负责监控当前的并发数 `uploadingCountRef`，实现文件级别的流量控制。

该机制的核心逻辑是：只有当**正在上传的文件数**少于设定的阈值（例如 `MAX_CONCURRENT_FILES = 10`）时，它才会从队列头部取出一个文件开始处理。

这种机制确保了无论用户一次选择了多少文件，系统始终保持在一个**高水位但不过载**的健康状态，避免了因请求瞬间爆发导致的资源竞争和浏览器卡顿。

```ts
// hooks/useFileUpload.ts
const processQueue = useCallback(async () => {
  // 循环条件：队列不为空 且 当前并发数未满
  while (
    queueRef.current.length > 0 &&
    uploadingCountRef.current < UPLOAD_CONFIG.MAX_CONCURRENT_FILES
  ) {
    const fileItem = queueRef.current.shift();
    if (fileItem) {
      uploadingCountRef.current++; // 占用并发名额

      // 开始上传，无论成功失败，最后都要释放名额并尝试处理下一个
      uploadFile(fileItem).finally(() => {
        uploadingCountRef.current--;
        processQueue(); // 递归调用
      });
    }
  }
}, [uploadFile]);
```

## 预处理（MD5 计算）

文件一旦开始处理，并不会立即上传。为了实现“**秒传**”和“**断点续传**”这两个核心功能，我们需要给文件一个**唯一的身份标识**。文件名是用户可修改且不可靠的，所以我们采用**内容哈希（MD5）**作为文件的指纹。

### 增量计算

对于动辄几 GB 的大文件，如果一次性将整个文件读取到内存中进行 MD5 计算，不仅会**瞬间耗尽内存**，更严重的是会**卡死浏览器的 UI 线程**，导致用户界面完全无响应。

因此，我们采用**增量计算**策略：

1. 我们利用 `spark-md5` 库，它支持二进制数据的追加计算。
2. 配合 `FileReader` 的 `slice()` 方法，将大文件逻辑上切割成许多小块。
3. 逐个读取这些小块，每读完一块，就将其追加到 MD5 计算器中并释放内存，然后继续读取下一块。

这种方法将密集的 I/O 操作和计算分散开，极大地降低了单次内存占用和主线程的压力。

```ts
// libs/md5.ts
const spark = new SparkMD5.ArrayBuffer();
const fileReader = new FileReader();

// 定义读取时的分片大小 (2MB)
// 注意：这个大小只影响读取时内存占用，不影响最终上传的分片大小
const chunkSize = 2 * 1024 * 1024;

let currentChunk = 0;
const chunks = Math.ceil(file.size / chunkSize);

fileReader.onload = (e) => {
  // 将读取到的二进制数据追加到 MD5 计算器中
  spark.append(e.target.result);
  currentChunk++;

  if (currentChunk < chunks) {
    loadNext(); // 继续读取下一片
  } else {
    resolve(spark.end()); // 全部读取完成，返回最终的 MD5 字符串
  }
};
```

> 即使采用了增量计算，哈希计算仍然是计算密集型任务，默认在主线程运行。为了彻底消除计算过程对 UI 的影响，实现真正的非阻塞用户体验，建议将整个 MD5 计算逻辑转移到 **[Web Worker](https://blog.zsdy.dev/posts/web-worker-beginners-guide)** 中执行。Worker 独立于主线程运行，可以确保计算期间 UI 依然流畅，并能更好地利用多核 CPU 的性能。

## 预检查（秒传与断点续传）

在获得文件唯一的 MD5 指纹后，前端会立即向服务器发起一个轻量级的 **`check` 预检请求**。这个请求是整个上传流程的**核心分岔路口**，它将根据服务器的存储状态，决定接下来是“秒传”还是“断点续传”。

### 路径一：秒传

服务器收到 MD5 后，首先查询**文件索引**（`index.json`）。如果发现这个 MD5 已经对应一个存在的物理文件，直接返回 `exists: true`。

前端收到响应后，直接将进度条拉满到 100%，显示“**秒传成功**”。用户就会感觉文件瞬间传完了，实际上是因为服务器已经有了一份一模一样的文件了。

这就是我们追求的最优路径。服务器接收到 MD5 后，会执行以下步骤：

1. **查询文件索引：** 服务器首先查询全局的**文件索引**（`index.json`），查找是否有文件与该 MD5 匹配。
2. **存在性验证：** 如果 MD5 命中，服务器需要快速验证该索引指向的**物理文件确实存在**且可访问（防止索引与实际文件不同步）。

如果验证通过，服务器将直接返回 `exists: true`。前端收到响应后，立即将该文件状态标记为 `success`，进度条拉满到 **100%**。

```ts
// app/api/upload/check/route.ts
const existingPath = await findInIndex(md5);
if (existingPath) {
  // ... 验证文件存在性 ...
  return NextResponse.json({ exists: true, path: existingPath });
}
```

### 路径二：断点续传

如果 MD5 未命中秒传，意味着这是一个全新的文件，或者说是一个未完全上传的文件。此时，服务器会进一步检查该 MD5 对应的**临时目录**：

1. **检查临时切片：** 服务器遍历该 MD5 对应的临时存储目录，查找所有已上传的 `.chunk` 文件（例如 `0.chunk`, `1.chunk` 等）。
2. **返回已上传列表：** 将这些已存在的切片索引列表（`uploadedChunks`）返回给前端。

前端拿到这个列表后，就能实现**断点续传**：

- 它将总切片数与服务器已有的切片列表进行比对。
- 过滤掉已经上传的部分，只将剩余的切片索引加入待上传队列。

通过这种方式，我们避免了重复上传已有的数据块，实现了真正的**续传**功能。同时，前端可以根据已有的切片数量初始化进度条，为用户提供准确的当前进度。

```ts
// hooks/useFileUpload.ts
const checkResult = await checkFile(md5, file.name);
// 获取服务器已有的分片列表
const uploadedChunks = checkResult.uploadedChunks || [];
const totalChunks = fileItem.totalChunks;
// 过滤出还需要上传的分片索引
const chunksToUpload = Array.from({ length: totalChunks }, (_, i) => i).filter(
  (i) => !uploadedChunks.includes(i)
);

// 执行并发上传
await uploadChunksWithConcurrency(chunksToUpload, md5);
```

## 分片上传

如果未触发秒传，真正的上传工作现在才开始。前端会使用 `File.slice()` API 将文件物理切割成固定大小（推荐 **5MB**）的切片，并准备将它们逐一上传到服务器的临时目录。

### 分片级并发控制

我们面临第二个并发控制的挑战：对于单个 GB 级的大文件，如果一次性对几百个切片发起请求，同样会瞬间挤爆用户的网络带宽，造成严重的请求拥塞。

为了高效利用带宽并实现负载均衡，我们不使用简单的 `Promise.all`，而是实现了一个**“拉取式”并发池**：

1. **定义 Worker 数量：** 我们设定一个较小的并发数（例如 `concurrency = 3`），创建 3 个独立的 Worker。
2. **共享任务指针：** 这些 Worker 共享一个任务索引 `index`，该指针指向待上传切片数组的下一个任务。
3. **拉取机制：** 每个 Worker 就像流水线上的工人，完成一个任务（上传一个分片）后，就自动去指针处领取下一个任务 (`index++`)。

这种“**拉取式**”机制比简单的 `Promise.all` 更高效：网速快的 Worker 会处理更多分片，网速慢的则处理较少，自动实现了负载均衡。

```ts
// hooks/useFileUpload.ts
const uploadChunksWithConcurrency = async (chunks: number[], md5: string) => {
  const concurrency = 3;
  let index = 0; // 共享任务指针

  const uploadNext = async () => {
    // 只要还有任务，就持续领取并执行
    while (index < chunks.length) {
      // 获取当前要处理的 chunkIndex
      const chunkIndex = chunks[index++];
      await uploadChunk(file, { md5, chunkIndex, ... });
    }
  };

  // 启动 3 个并发 Worker
  await Promise.all(Array.from({ length: concurrency }, uploadNext));
};
```

## 分片合并与索引更新

当所有分片都成功上传至服务器的临时目录后，前端会发送最后一个完成通知的请求：`POST /api/upload/merge`。

### 流式合并

服务器收到合并请求后，需要将成百上千个小切片拼接成一个完整的大文件。如果使用传统的文件读取和写入方式，面对一个 10GB 甚至更大的文件，会瞬间造成服务器内存溢出（OOM）。

我们可以使用 Node.js 的 **Stream（流）** 来实现**无阻塞、低内存**的流式合并：

1. **创建目标文件流：** 创建一个指向最终存储路径的**可写流** (`writeStream`)。
2. **管道传输：** 依次为每个切片创建**可读流** (`readStream`)，并通过 `pipe()` 方法将数据传输到可写流中。

> `pipe()` 默认会在源流（`readStream`）结束时关闭目标流（`writeStream`）。由于我们需要连续写入多个切片，必须在 `pipe` 时设置 `{ end: false }`，保持可写流一直打开，直到最后一个切片传输完毕后，再进行**手动关闭** (`writeStream.end()`)。

```ts
// app/api/upload/merge/route.ts
const writeStream = fs.createWriteStream(targetPath);

for (let i = 0; i < totalChunks; i++) {
  const chunkPath = path.join(tempDir, `${i}.chunk`);
  await new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(chunkPath);
    // 写流，{ end: false } 防止读流结束时自动关闭写流
    readStream.pipe(writeStream, { end: false });
    // 读流结束，表示当前 chunk 写入完成，resolve 进入下一个循环
    rs.on("end", resolve);
    // 读流发生错误
    rs.on("error", (err) => {
      writeStream.destroy(err);
      reject(err);
    });
  });
}

writeStream.end(); // 手动关闭
```

### 索引并发锁

文件合并完成后，我们需要将新文件的 MD5 及其存储路径记录到全局的 `index.json` 中，以便未来的**秒传**功能可以命中。

这里存在一个**隐蔽的并发安全问题**：

如果 10 个大文件同时合并完成，它们会几乎同时执行“读取 $\to$ 修改 $\to$ 写入” `index.json` 的操作。这会导致**竞态条件**，后写入的操作可能会覆盖或丢失前一个操作的数据。

我们利用 **Promise 链** 实现了一个**内存互斥锁**：

所有的 `addToIndex` 操作都被强制串行化，形成一个等待队列。每一个新的写入操作都必须等待前一个操作的 Promise 完成后才能开始，从而彻底保证了 `index.json` 写入的原子性和数据安全。

```ts
// libs/file-index.ts
let indexWritePromise: Promise<void> = Promise.resolve();

export async function addToIndex(md5: string, filePath: string): Promise<void> {
  const newOperation = indexWritePromise
    .then(async () => {
      // 1. 读取
      const index = await readFileIndex();

      // 2. 修改
      index[md5] = filePath;

      // 3. 写入
      await writeFileIndex(index);
    })
    .catch((error) => {
      console.error("写入索引失败:", error);
    });

  // 更新全局 Promise 链，确保下一个 addToIndex 等待当前这个操作完成
  indexWritePromise = newOperation;

  return newOperation;
}
```
