const fs = require("fs");
const path = require("path");

// 设定静态资源的绝对根路径，用于前端页面生成
const imageBaseUrl = "/images";
const rootDir = process.cwd();

// 目录隔离：定义源码与构建产物路径
const sourceImagesDir = path.join(rootDir, "images");
const distDir = path.join(rootDir, "dist");
const distImagesDir = path.join(distDir, "images");

// 核心规范：边缘函数必须保留在项目根目录，静态页面输出至 dist
const apiFilePath = path.join(rootDir, "functions", "api.js");
const indexHtmlPath = path.join(distImagesDir, "index.html");

const isImage = (filename) => /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(filename);

// 初始化：清理并创建隔离的 dist 目录
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distImagesDir, { recursive: true });

// 拷贝项目根目录的 API 说明页 index.html 至 dist
const rootIndexFile = path.join(rootDir, "index.html");
if (fs.existsSync(rootIndexFile)) {
  fs.copyFileSync(rootIndexFile, path.join(distDir, "index.html"));
}

// 拷贝兜底图片 notfound.jpg 至 dist/images
const notFoundImg = path.join(sourceImagesDir, "notfound.jpg");
if (fs.existsSync(notFoundImg)) {
  fs.copyFileSync(notFoundImg, path.join(distImagesDir, "notfound.jpg"));
}

// 1. 收集本地 PC 和 Phone 图片路径，并物理拷贝隔离至 dist
const walkAndCopyDir = (srcDir, destDir) => {
  const results = [];
  if (!fs.existsSync(srcDir)) return results;

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const list = fs.readdirSync(srcDir);
  list.forEach((file) => {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    const stat = fs.statSync(srcPath);

    if (stat && stat.isDirectory()) {
      results.push(...walkAndCopyDir(srcPath, destPath));
    } else {
      // 剔除可能存在的旧 index.html 产物
      if (file === "index.html") return;

      fs.copyFileSync(srcPath, destPath);

      if (isImage(file)) {
        results.push(path.relative(sourceImagesDir, srcPath).replace(/\\/g, "/"));
      }
    }
  });
  return results;
};

// 2. 读取 txt 文件中的外链图片，并同步拷贝至 dist 保持结构完整
const readExternalUrls = (filename) => {
  const srcPath = path.join(sourceImagesDir, filename);
  const destPath = path.join(distImagesDir, filename);
  if (fs.existsSync(srcPath)) {
    console.log(`📄 发现配置文件: ${filename}，正在读取外链...`);
    fs.copyFileSync(srcPath, destPath);
    const content = fs.readFileSync(srcPath, "utf-8");
    return content
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && /^https?:\/\//i.test(line));
  }
  return [];
};

const localPcImages = walkAndCopyDir(path.join(sourceImagesDir, "pc"), path.join(distImagesDir, "pc"));
const localPhoneImages = walkAndCopyDir(path.join(sourceImagesDir, "phone"), path.join(distImagesDir, "phone"));
const externalPcImages = readExternalUrls("pc.txt");
const externalPhoneImages = readExternalUrls("phone.txt");

const pcImages = [...localPcImages, ...externalPcImages];
const phoneImages = [...localPhoneImages, ...externalPhoneImages];

console.log(`📊 统计: PC图片 ${pcImages.length} 张 (本地 ${localPcImages.length}, 外链 ${externalPcImages.length})`);
console.log(`📊 统计: Phone图片 ${phoneImages.length} 张 (本地 ${localPhoneImages.length}, 外链 ${externalPhoneImages.length})`);

// === 3. 生成 functions/api.js ===
const apiJsContent = `
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

function handleRandomPicture(context) {
  const pc = ${JSON.stringify(pcImages)};
  const phone = ${JSON.stringify(phoneImages)};

  // 解析当前请求的上下文信息
  const requestUrl = new URL(context.request.url);
  const typeParam = (requestUrl.searchParams.get("type") || "").toLowerCase();
  const currentOrigin = requestUrl.origin;

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
  let url;
  if (list.length === 0) {
    url = currentOrigin + "/images/notfound.jpg";
  } else {
    const randomItem = list[Math.floor(Math.random() * list.length)];
    // 绝对外链与本地资源的差异化处理
    url = /^https?:\\/\\//i.test(randomItem)
      ? randomItem
      : currentOrigin + "/images/" + encodeURI(randomItem);
  }

  // 手动构造 302 响应以保留防缓存与跨域头（Response.redirect 生成的响应头不可变且缺失自定义策略）
  return new Response(null, {
    status: 302,
    headers: {
      ...CORS_HEADERS,
      "Location": url,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "X-Frame-Options": "DENY",
    },
  });
}

export function onRequestGet(context) {
  return handleRandomPicture(context);
}

export function onRequestHead(context) {
  return handleRandomPicture(context);
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
`.trim();

if (!fs.existsSync(path.dirname(apiFilePath))) {
  fs.mkdirSync(path.dirname(apiFilePath), { recursive: true });
}
fs.writeFileSync(apiFilePath, apiJsContent);
console.log("✅ 生成 functions/api.js 成功 (保留在根目录以便节点读取)");

// === 4. 生成 dist/images/index.html (包含真实懒加载与分批无限滚动) ===
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CDN 文件索引</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ctext y='50' font-size='48'%3E%F0%9F%96%BC%EF%B8%8F%3C/text%3E%3C/svg%3E">
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f9f9f9; margin: 0; }
    h1 { margin-bottom: 0.5rem; }
    
    /* 导航样式 */
    #breadcrumb { margin-bottom: 2rem; font-size: 1.1rem; color: #555; }
    #breadcrumb a { color: #0066cc; text-decoration: none; }
    #breadcrumb a:hover { text-decoration: underline; }

    ul#gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; list-style: none; padding: 0; margin: 0; }
    li.gallery-item { background: white; padding: 1rem; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); overflow: hidden; word-break: break-all; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: transform 0.2s, box-shadow 0.2s; }
    li.gallery-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    
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
      display: block;
      background-color: #eee;
      transition: transform 0.2s, opacity 0.3s ease;
    }
    .preview img.lazy-img {
      opacity: 0.3;
    }
    .preview img.lazy-img.loaded,
    .preview img.lazy-img.error {
      opacity: 1;
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

    /* 滚动哨兵及加载提示样式 */
    .sentinel-item {
      grid-column: 1 / -1;
      text-align: center;
      padding: 20px 0;
      color: #888;
      font-size: 0.9rem;
      list-style: none;
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

    const BATCH_SIZE = 36;
    const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 10'%3E%3Crect width='100%25' height='100%25' fill='%23ebebeb'/%3E%3C/svg%3E";

    let currentFiles = [];
    let renderedCount = 0;

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function safeUrl(rawUrl) {
      return /^https?:\\/\\//i.test(rawUrl) ? rawUrl : encodeURI(rawUrl);
    }

    // 1. 媒体资源懒加载器：只在快进入视口 200px 内时才给 src 赋值并请求资源
    const mediaObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.dataset.src) {
            el.src = el.dataset.src;
            el.removeAttribute('data-src');
            el.onload = () => el.classList.add('loaded');
            el.onerror = () => {
              el.onerror = null;
              el.classList.add('error');
              el.src = '/images/notfound.jpg';
            };
          }
          observer.unobserve(el);
        }
      });
    }, {
      rootMargin: '200px 0px 200px 0px'
    });

    // 2. 滚动哨兵监听器：触底前 300px 自动追加下一批卡片
    const sentinelObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          renderNextBatch();
        }
      });
    }, {
      rootMargin: '300px 0px 300px 0px'
    });

    // 单张卡片 HTML 生成
    function createCardHtml(file) {
      const encodedUrl = escapeHtml(safeUrl(file.url));
      const safeName = escapeHtml(file.name);
      return \`
        <li class="gallery-item">
          <a class="preview" href="#" data-full="\${encodedUrl}">
            <img src="\${PLACEHOLDER_SVG}" data-src="\${encodedUrl}" alt="\${safeName}" class="lazy-img" />
            <div>\${safeName}</div>
          </a>
        </li>\`;
    }

    // 分批渲染逻辑
    function renderNextBatch() {
      const oldSentinel = document.getElementById('sentinel');
      if (oldSentinel) {
        sentinelObserver.unobserve(oldSentinel);
        oldSentinel.remove();
      }

      if (renderedCount >= currentFiles.length) {
        if (currentFiles.length > BATCH_SIZE) {
          gallery.insertAdjacentHTML('beforeend', \`<li class="sentinel-item">🎉 已加载全部资源 (\${currentFiles.length} 项)</li>\`);
        }
        return;
      }

      const nextBatch = currentFiles.slice(renderedCount, renderedCount + BATCH_SIZE);
      const batchHtml = nextBatch.map(createCardHtml).join('');
      gallery.insertAdjacentHTML('beforeend', batchHtml);

      // 对新增的图片注册懒加载监听
      const newItems = gallery.querySelectorAll('img.lazy-img[data-src]');
      newItems.forEach(el => mediaObserver.observe(el));

      renderedCount += nextBatch.length;

      // 如果还有未加载项，追加新哨兵
      if (renderedCount < currentFiles.length) {
        gallery.insertAdjacentHTML('beforeend', '<li id="sentinel" class="sentinel-item">⏳ 正在加载更多...</li>');
        const sentinel = document.getElementById('sentinel');
        if (sentinel) {
          sentinelObserver.observe(sentinel);
        }
      }
    }

    // 文件夹中文映射配置
    const folderConfig = {
      "pc": "📁 pc",
      "phone": "📱 phone",
      "ext-pc": "🔗 外链pc",
      "ext-phone": "🔗 外链phone"
    };

    // 路由渲染逻辑
    function renderView(hash) {
      mediaObserver.disconnect();
      sentinelObserver.disconnect();
      gallery.innerHTML = '';
      renderedCount = 0;

      // 首页：展示四大文件夹
      if (!hash || hash === '/' || hash === '') {
        breadcrumb.innerHTML = '🏠 根目录';
        currentFiles = [];
        const folderCards = Object.keys(folderConfig)
          .filter(key => fileData[key] && fileData[key].length > 0)
          .map(key => \`
            <li class="gallery-item">
              <a href="#/\${encodeURIComponent(key)}" class="folder-link">
                <div class="folder-icon">\${folderConfig[key].substring(0,2)}</div>
                <div>\${escapeHtml(folderConfig[key].substring(3))} (\${fileData[key].length})</div>
              </a>
            </li>
          \`).join('');
        gallery.innerHTML = folderCards;
      } 
      // 子目录：分批渲染该类目下的所有图片
      else {
        const folderKey = hash.replace(/^\\//, '');
        const folderName = folderConfig[folderKey] ? folderConfig[folderKey].substring(3) : folderKey;
        breadcrumb.innerHTML = \`<a href="#/">🏠 根目录</a> / \${escapeHtml(folderName)}\`;
        
        currentFiles = fileData[folderKey] || [];
        if (currentFiles.length > 0) {
          renderNextBatch();
        }
      }
    }

    function closeModal() {
      modal.style.display = 'none';
      modalImg.src = '';
    }

    // 事件代理：处理图片预览
    document.body.addEventListener('click', (e) => {
      const previewLink = e.target.closest('.preview[data-full]');
      if (previewLink) {
        e.preventDefault();
        modalImg.src = previewLink.dataset.full;
        modal.style.display = 'flex';
      }
    });

    // 点击遮罩或按 Esc 关闭模态框
    modal.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });

    function getHashPath() {
      const raw = window.location.hash.replace(/^#\\/?/, '');
      try {
        return decodeURIComponent(raw);
      } catch {
        return '';
      }
    }

    // 监听 Hash 路由变化
    window.addEventListener('hashchange', () => {
      renderView(getHashPath());
    });

    // 首次进入渲染
    renderView(getHashPath());
  </script>
</body>
</html>
`;

fs.writeFileSync(indexHtmlPath, html);
console.log("✅ 生成 dist/images/index.html 成功，已输出至隔离目录");
