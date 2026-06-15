const fs = require("fs");
const path = require("path");

// 设定静态资源的绝对根路径，用于前端页面生成
const imageBaseUrl = "/images"; 
const apiFilePath = path.join("functions", "api.js");
const indexHtmlPath = path.join("images", "index.html");
const rootDir = path.join(process.cwd(), "images");

const isImage = (filename) => /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);

// 1. 收集本地 PC 和 Phone 图片路径
const walkDir = (dir) => {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results.push(...walkDir(filePath));
    } else if (isImage(file)) {
      results.push(path.relative(rootDir, filePath).replace(/\\/g, "/"));
    }
  });
  return results;
};

// 2. 读取 txt 文件中的外链图片
const readExternalUrls = (filename) => {
  const filePath = path.join(rootDir, filename);
  if (fs.existsSync(filePath)) {
    console.log(`📄 发现配置文件: ${filename}，正在读取外链...`);
    const content = fs.readFileSync(filePath, "utf-8");
    return content
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.startsWith("http"));
  }
  return [];
};

const localPcImages = walkDir(path.join(rootDir, "pc"));
const localPhoneImages = walkDir(path.join(rootDir, "phone"));
const externalPcImages = readExternalUrls("pc.txt");
const externalPhoneImages = readExternalUrls("phone.txt");

const pcImages = [...localPcImages, ...externalPcImages];
const phoneImages = [...localPhoneImages, ...externalPhoneImages];

console.log(`📊 统计: PC图片 ${pcImages.length} 张 (本地 ${localPcImages.length}, 外链 ${externalPcImages.length})`);
console.log(`📊 统计: Phone图片 ${phoneImages.length} 张 (本地 ${localPhoneImages.length}, 外链 ${externalPhoneImages.length})`);

// === 3. 生成 functions/api.js ===
// 核心逻辑注入：动态 Origin 获取与 URLSearchParams 参数解析
const apiJsContent = `
export function onRequestGet(context) {
  const pc = ${JSON.stringify(pcImages)};
  const phone = ${JSON.stringify(phoneImages)};
  
  // 解析当前请求的上下文信息
  const requestUrl = new URL(context.request.url);
  const typeParam = requestUrl.searchParams.get("type");
  const currentOrigin = requestUrl.origin; // 获取客户端实际访问的域名 (如 https://image.api.kafuchino.top)
  
  let list;

  // 终端强制分发策略
  if (typeParam === "pc") {
    list = pc;
  } else if (typeParam === "phone") {
    list = phone;
  } else {
    // 默认 User-Agent 嗅探策略
    const userAgent = context.request.headers.get("user-agent") || "";
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    list = isMobile ? phone : pc;
  }

  // 兜底防御机制
  if (list.length === 0) {
    return Response.redirect(currentOrigin + "/images/notfound.jpg", 302);
  }

  const randomItem = list[Math.floor(Math.random() * list.length)];

  // 绝对外链与本地资源的差异化处理
  const url = randomItem.startsWith("http")
    ? randomItem
    : currentOrigin + "/images/" + randomItem;

  return Response.redirect(url, 302);
}
`.trim();

fs.mkdirSync(path.dirname(apiFilePath), { recursive: true });
fs.writeFileSync(apiFilePath, apiJsContent);
console.log("✅ 生成 functions/api.js 成功");

// === 4. 生成 images/index.html ===
let html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>CDN 文件索引</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f9f9f9; }
    ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; list-style: none; padding: 0; }
    li { background: white; padding: 1rem; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); overflow: hidden; word-break: break-all; display: flex; flex-direction: column; align-items: center; }
    .preview img {
      width: 100%;
      height: 140px;
      object-fit: cover;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      cursor: zoom-in;
      transition: transform 0.2s;
    }
    .preview img:hover {
      transform: scale(1.03);
    }
    .preview div {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: #333;
      text-align: center;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0; top: 0;
      width: 100vw; height: 100vh;
      background-color: rgba(0, 0, 0, 0.8);
      justify-content: center;
      align-items: center;
    }
    .modal img {
      max-width: 90vw;
      max-height: 90vh;
      border-radius: 10px;
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
    }
    .modal:target {
      display: flex;
    }
  </style>
</head>
<body>
  <h1>🖼️ 图片索引 (PC: ${pcImages.length} / Phone: ${phoneImages.length})</h1>
  <ul>
`;

[...pcImages, ...phoneImages].forEach((imgPath, index) => {
  const isHttp = imgPath.startsWith("http");
  // 前端页面直接使用绝对路径 /images/...，依赖浏览器自动拼接当前访问域名
  const fullUrl = isHttp ? imgPath : `${imageBaseUrl}/${imgPath}`;
  const modalId = `modal-${index}`;
  const displayName = isHttp ? "🔗 外链图片" : imgPath;

  html += `
    <li>
      <a class="preview" href="#${modalId}">
        <img src="${fullUrl}" alt="${displayName}" loading="lazy" />
        <div>${displayName}</div>
      </a>
    </li>
    <div class="modal" id="${modalId}" onclick="location.hash='';">
      <img src="${fullUrl}" alt="${displayName}" />
    </div>
  `;
});

html += `
  </ul>
</body>
</html>
`;

fs.mkdirSync(path.dirname(indexHtmlPath), { recursive: true });
fs.writeFileSync(indexHtmlPath, html);
console.log("✅ 生成 images/index.html 成功");