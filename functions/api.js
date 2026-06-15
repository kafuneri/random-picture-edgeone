/*
 * 注意：请勿直接手动修改此文件！
 * 本文件 (functions/api.js) 仅作为构建系统输出的 临时构建产物。
 * 它是通过运行 npm run build 命令，由根目录下的 generate-image-urls.js 脚本动态生成的
 * 在此处所做的任何直接修改，都会在构建时被彻底抹除并覆盖。
 * * 若需调整业务逻辑（如修改路由参数、调整跨域策略等），
 * 请务必前往修改 generate-image-urls.js 内部的 字符串模板。
 *
 * =========================================================
 * 以下代码仅用于演示边缘函数的 API 请求分发机制
 * =========================================================
 */

export function onRequestGet(context) {
  // 1. 模拟由构建脚本动态注入的硬编码图库数据源
  const pc = ["pc/demo-desktop-wallpaper.webp"];
  const phone = ["phone/demo-mobile-wallpaper.webp"];
  
  // 2. 解析请求上下文，提取动态域名与查询参数
  const requestUrl = new URL(context.request.url);
  const typeParam = requestUrl.searchParams.get("type"); // 拦截形如 ?type=pc 的参数
  const currentOrigin = requestUrl.origin; // 动态获取实际访问的请求源头 (Origin)

  let list;

  // 3. 核心分发路由树
  // [高优先级] 强制参数匹配分支
  if (typeParam === "pc") {
    list = pc;
  } else if (typeParam === "phone") {
    list = phone;
  } else {
    // [低优先级] 设备自适应嗅探分支
    const userAgent = context.request.headers.get("user-agent") || "";
    // 通过正则表达式提取常见移动端特征词
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    list = isMobile ? phone : pc;
  }

  // 4. 兜底防御与资源抽取
  if (list.length === 0) {
    // 如果列表为空，重定向至当前域名下的默认占位图
    return Response.redirect(currentOrigin + "/images/notfound.jpg", 302);
  }
  
  // 通过 Math.random 算法从数组中抽取随机项
  const randomItem = list[Math.floor(Math.random() * list.length)];

  // 5. 目标 URL 组装与外链识别
  // 判断资源是否自带 http 协议头，如果没有则拼接当前域名的前缀
  const url = randomItem.startsWith("http")
    ? randomItem
    : currentOrigin + "/images/" + randomItem;

  // 6. 终点：签发 HTTP 302 临时重定向指令
  return Response.redirect(url, 302);
}