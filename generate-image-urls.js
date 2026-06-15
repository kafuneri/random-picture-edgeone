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
// 将数据结构化，按文件夹类别进行归类
const fileData = {
  "pc": localPcImages.map(p => ({ url: `${imageBaseUrl}/${p}`, name: p })),
  "phone": localPhoneImages.map(p => ({ url: `${imageBaseUrl}/${p}`, name: p })),
  "ext-pc": externalPcImages.map(p => ({ url: p, name: p })),
  "ext-phone": externalPhoneImages.map(p => ({ url: p, name: p }))
};

let html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>CDN 文件索引</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f9f9f9; }
    h1 { margin-bottom: 0.5rem; }
    
    /* 导航样式 */
    #breadcrumb { margin-bottom: 2rem; font-size: 1.1rem; color: #555; }
    #breadcrumb a { color: #0066cc; text-decoration: none; }
    #breadcrumb a:hover { text-decoration: underline; }

    ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; list-style: none; padding: 0; }
    li { background: white; padding: 1rem; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); overflow: hidden; word-break: break-all; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: transform 0.2s; }
    li:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    
    /* 文件夹专属样式 */
    .folder-icon { font-size: 4rem; line-height: 1; margin-bottom: 0.8rem; text-align: center; }
    .folder-link { text-decoration: none; color: #333; text-align: center; font-weight: bold; width: 100%; display: block; padding: 20px 0; }

    /* 图片预览样式 */
    .preview { text-decoration: none; color: inherit; width: 100%; cursor: zoom-in; }
    .preview img {
      width: 100%;
      height: 140px;
      object-fit: cover;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }
    .preview img:hover { transform: scale(1.03); }
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

    /* JS 模态框样式 */
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
  </style>
</head>
<body>
  <h1>🖼️ 图片索引 (PC: ${pcImages.length} / Phone: ${phoneImages.length})</h1>
  <div id="breadcrumb"></div>
  <ul id="gallery"></ul>

  <div class="modal" id="modal">
    <img id="modal-img" src="" alt="预览大图">
  </div>

  <script>
    // 注入结构化数据
    const fileData = ${JSON.stringify(fileData)};
    
    const gallery = document.getElementById('gallery');
    const breadcrumb = document.getElementById('breadcrumb');
    const modal = document.getElementById('modal');
    const modalImg = document.getElementById('modal-img');

    // 文件夹中文映射配置
    const folderConfig = {
      "pc": "📁 pc",
      "phone": "📱 phone",
      "ext-pc": "🔗 外链pc",
      "ext-phone": "🔗 外链phone"
    };

    // 路由渲染逻辑
    function renderView(hash) {
      gallery.innerHTML = '';
      
      // 首页：展示四大文件夹
      if (!hash || hash === '/' || hash === '') {
        breadcrumb.innerHTML = '🏠 根目录';
        Object.keys(folderConfig).forEach(key => {
          // 只渲染包含图片的文件夹
          if (fileData[key].length > 0) {
            gallery.innerHTML += \`
              <li>
                <a href="#/\${key}" class="folder-link">
                  <div class="folder-icon">\${folderConfig[key].substring(0,2)}</div>
                  <div>\${folderConfig[key].substring(3)} (\${fileData[key].length})</div>
                </a>
              </li>
            \`;
          }
        });
      } 
      // 子目录：展示该类目下的所有图片
      else {
        const folderKey = hash.replace(/^\\//, '');
        const folderName = folderConfig[folderKey] ? folderConfig[folderKey].substring(3) : folderKey;
        breadcrumb.innerHTML = \`<a href="#/">🏠 根目录</a> / \${folderName}\`;
        
        const files = fileData[folderKey] || [];
        files.forEach(file => {
          gallery.innerHTML += \`
            <li>
              <a class="preview" href="#" data-full="\${file.url}">
                <img src="\${file.url}" alt="\${file.name}" loading="lazy" />
                <div>\${file.name}</div>
              </a>
            </li>
          \`;
        });
      }
    }

    // 事件代理：处理图片预览
    document.body.addEventListener('click', (e) => {
      const previewLink = e.target.closest('.preview[data-full]');
      if (previewLink) {
        e.preventDefault(); // 阻止 a 标签默认的锚点跳转行为
        modalImg.src = previewLink.dataset.full;
        modal.style.display = 'flex';
      }
    });

    // 关闭模态框
    modal.addEventListener('click', () => {
      modal.style.display = 'none';
      modalImg.src = '';
    });

    // 监听 Hash 路由变化
    window.addEventListener('hashchange', () => {
      const hashPath = decodeURIComponent(window.location.hash.substring(2));
      renderView(hashPath);
    });

    // 首次进入渲染
    const initialPath = window.location.hash.length > 2 ? decodeURIComponent(window.location.hash.substring(2)) : '';
    renderView(initialPath);
  </script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(indexHtmlPath), { recursive: true });
fs.writeFileSync(indexHtmlPath, html);
console.log("✅ 生成 images/index.html 成功，含分类导航");