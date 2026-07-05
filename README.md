# EdgeOne Random Picture

基于腾讯云 EdgeOne Pages 的 Serverless 随机图片 API。
支持设备自适应（PC/移动端），支持本地图片与外部链接混合分发，内置图库预览页面。

## ✨ 特性

- **Serverless 架构**：无需服务器，利用 EdgeOne 边缘函数实现极速响应。
- **设备自适应**：根据访问者的 User-Agent 自动返回 PC 或手机适配的图片。
- **双模式图源**：支持直接上传图片文件，也支持使用 TXT 配置外链图片。
- **自动化构建**：构建时自动扫描资源并生成 API 逻辑与预览索引页。

## 🚀 快速部署
### 方式一：一键部署
无需手动配置，点击下方按钮即可直接将本项目部署到腾讯云 EdgeOne Pages：

[![Deploy to EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/pages/new?repository-url=https://github.com/kafuneri/random-picture-edgeone)

### 方式二：手动部署
1. **Fork 本仓库**
   点击右上角的 `Fork` 按钮，将项目复制到您的 GitHub 账户。

2. **创建 EdgeOne Pages 项目**
   前往 [腾讯云 EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages)，点击 `创建项目` > `连接 Git 仓库`，选择您刚刚 Fork 的仓库。

3. **构建设置**
   在配置页面中，需修改 **构建命令**和**输出目录**，其余保持默认：
   - 框架预设:	`Other`
   - 输出目录：`dist`
   - 构建命令：`npm run build`   
   > 仓库已内置 `edgeone.json` 配置文件，EdgeOne 会自动读取 `dist` 输出目录与 `npm run build` 构建命令，如您修改了构建逻辑，注意需改动`edgeone.json`
   <img width="2041" height="1136" alt="image" src="https://github.com/user-attachments/assets/1a7fb8cc-148c-4f89-8b11-1779da34d8fc" />

4. **部署上线**
   点击 `开始部署`，等待几十秒即可完成。部署完成后，您可以绑定个人域名（中国大陆区域需备案）。
## 📂 目录结构

```text
├── dist/                  # 构建输出目录（执行 build 后自动生成）
├── functions/             # API 边缘函数代码（执行 build 后自动生成）
├── images/                # 核心资源目录
│   ├── pc/                # 存放本地 PC 端图片
│   ├── phone/             # 存放本地移动端图片
│   ├── pc.txt             # PC 端外链图片配置文件
│   └── phone.txt          # 移动端外链图片配置文件
├── edgeone.json           # EdgeOne 网络路由与缓存策略配置
├── generate-image-urls.js # 自动化构建核心脚本
└── package.json           
```

## 🖼️ 如何添加图片

本项目支持**本地文件**和**外部链接**两种方式添加图片，脚本在构建时会自动合并这两种来源。

### 方法一：上传本地图片
直接将图片文件上传到项目目录中，适合存储少量高质量壁纸。  
**注：Edgeone限制项目总大小不超过5GB，总文件数不超过20,000 个，单个文件限制大小25MB以下**
* **PC 端图片**：放入 `images/pc/` 文件夹。
* **移动端图片**：放入 `images/phone/` 文件夹。

> 支持格式：jpg, jpeg, png, gif, webp

### 方法二：使用外链图片（推荐）
如果你希望使用第三方图床（如微博、B站、SM.MS 等）的图片，或者不想占用仓库体积，可以使用此方法。

1. 在 `images/` 目录下创建 `pc.txt` 或 `phone.txt` 文件。
2. 在文件中填入图片直链（以 http/https 开头），**每行一个 URL**。

**示例 (`images/pc.txt`)：**
```text
https://photo.api.kafuchino.top/pixiv/0000.webp
https://photo.api.kafuchino.top/pixiv/0001.webp
https://photo.api.kafuchino.top/pixiv/0002.webp
```

## 🛠️ API 使用说明
假设您的项目域名为 https://example.com

- **获取自适应图片**：访问 `https://example.com/api`（根据设备 UA 自动跳转到一张随机图片）
- **获取电脑端图片**：访问 `https://example.com/api?type=pc`（强制跳转电脑壁纸）
- **获取手机端图片**：访问 `https://example.com/api?type=phone`（强制跳转手机壁纸）
- **查看图库预览**：访问 `https://example.com/images` 即可浏览所有已收录的图片。

## ⚠️ 免责声明 (Disclaimer)
**图片版权**：本项目仅作为技术展示与个人学习使用。项目默认包含或通过配置文件引用的所有图片资源均收集自互联网，版权归原作者所有。

**使用限制**：使用者请勿将本项目用于商业用途。如果您在使用的过程中侵犯了第三方的知识产权，请自行承担相关法律责任。

**内容合规**：请勿在列表中添加违反当地法律法规的图片链接（如色情、暴力、反动等内容），违者后果自负。
