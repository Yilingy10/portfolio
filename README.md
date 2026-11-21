# PLEASE TOUCH — Yiling Yang 作品集网站

一个**不需要安装任何东西**的静态网站：HTML + CSS + JavaScript，3D 部分用 Three.js（从免费 CDN 自动加载）。
设计说明见 `DESIGN.md`。

---

## 1. 在自己电脑上打开

浏览器出于安全原因不允许直接双击 `index.html` 运行这种网站，需要一个本地服务器（二选一）：

**方法 A（最简单）** —— 用 VS Code 打开这个文件夹，安装扩展 *Live Server*，右键 `index.html` → *Open with Live Server*。

**方法 B（Mac 终端）**
```bash
cd 这个文件夹的路径
python3 -m http.server 8000
```
然后浏览器打开 http://localhost:8000

改完文件后刷新浏览器即可看到效果。

## 2. 上线（免费）

- **Netlify Drop**：打开 https://app.netlify.com/drop ，把整个文件夹拖进去，几秒后就有网址。
- **GitHub Pages**：把文件夹上传到一个 GitHub 仓库 → Settings → Pages → 选择 main 分支。
- **Vercel / Cloudflare Pages** 也可以，直接选"静态站点"，不需要 build 命令。

---

## 3. 文件结构

```
please-touch/
├── index.html              ← 入口（一般不用改）
├── css/
│   ├── theme.css           ← ★ 颜色、字体、字号
│   └── site.css            ← 布局与组件样式
├── js/
│   ├── data/
│   │   ├── projects.js     ← ★ 所有项目（标题、年份、文字、图片）
│   │   ├── playground.js   ← ★ 首页 3D 物体的排列
│   │   └── site.js         ← ★ 名字、简介、联系方式
│   ├── views/              ← 页面：home / archive / project / about
│   ├── components/         ← 翻书、图片查看器、3D 模型查看器
│   ├── three/              ← 首页 3D 场景与物体
│   └── lib/util.js         ← 小工具
└── assets/
    ├── work/<项目名>/      ← ★ 每个项目的图片
    └── models/             ← ★ 放你的 .glb / .gltf 模型
```
带 ★ 的就是你日常会改的地方。

---

## 4. 常见修改

### 增加一个项目
1. 在 `assets/work/` 里新建文件夹，比如 `my-new-project`，把图片放进去（jpg/png/webp 都行）。
2. 打开 `js/data/projects.js`，复制任意一个 `{ ... },` 块，粘贴到合适的年份位置，修改：
   ```js
   {
     slug: 'my-new-project',          // 必须和文件夹名一样
     title: 'My New Project',
     year: 2026,
     categories: ['Graphic', 'Objects'],
     medium: 'Risograph, 24 pages',
     summary: '一句话英文简介',
     cover: 'cover.jpg',              // 封面
     overview: '...', concept: '', process: '', outcome: '',   // 留空就不显示
     blocks: [
       { type: 'image', src: 'photo-1.jpg', layout: 'full' },
       { type: 'row', images: ['photo-2.jpg', 'photo-3.jpg'] },
     ],
   },
   ```
3. 保存、刷新。编号（YY.26.xx）、Archive、筛选、"Next" 链接都会自动更新。

### 可用的版块（blocks）
| type | 写法 | 效果 |
|---|---|---|
| `chapter` | `{ type:'chapter', title:'Process', text:'可选说明' }` | 章节标题 |
| `image` | `{ type:'image', src:'a.jpg', layout:'full' }` | 单图；layout 可选 `full` / `wide` / `inset` / `bleed`（通栏，左右顶到屏幕边） |
| `duo` | `{ type:'duo', images:['big.jpg','small.jpg'], flip:true }` | 一大一小、错位摆放；`flip` 左右互换 |
| `mosaic` | `{ type:'mosaic', images:['big.jpg','s1.jpg','s2.jpg'] }` | 左边一张大图，右边一列小图 |
| `pinboard` | `{ type:'pinboard', images:[...], text:'可选提示' }` | 一叠照片：拖走/点箭头看下一张，旁边有缩略图索引 |
| `storms` | `{ type:'storms', start:'Katrina' }` | 飓风索引：地图 + 雕塑卡 + 年份轴（数据在 js/data/storms.js） |
| `blinds` | 见 between-museum-and-park 的邀请函 | 百叶窗：翻转叶片显示另一面 |
| `object` | `{ type:'object', shape:'spiralbook', cover:'…stl', back:'…stl', page:'page-01.webp' }` | 用首页同一套 3D 物体做的可旋转展示 |
| `row` | `{ type:'row', images:['a.jpg','b.jpg'], tall:true }` | 一排等高图片（横竖混排都行）；`tall` 适合很高的海报 |
| `grid` | `{ type:'grid', columns:3, images:[...] }` | 方格（适合很多张单页/卡片） |
| `strip` | `{ type:'strip', images:[...] }` | 横向滑动的长条（适合书的跨页） |
| `book` | `{ type:'book', pages:['p1.jpg','p2.jpg',...] }` | 可翻页的书（第一张是封面） |
| `video` | `{ type:'video', src:'film.mp4', poster:'still.jpg' }` | 视频 |
| `model` | `{ type:'model', src:'assets/models/x.glb', poster:'photo.jpg' }` | 可旋转缩放的 3D 模型 |
| `link` | `{ type:'link' }` + 项目里写 `link:{ url:'https://…', label:'Open' }` | 外链大按钮 |

图片可以带说明：`{ src:'a.jpg', caption:'Detail of the cover' }`

### 换首页的 3D 物体 / 排列
打开 `js/data/playground.js`：
- 改 `position: [x, 0, z]` 移动物体（x 左右，z 前后）；`mobile` 是手机上的位置。
- 改 `project` 换成别的项目。
- 用你自己的模型：
  ```js
  { project: 'frozen-flow', shape: 'model', model: 'assets/models/frozen-flow.glb', height: 1.3,
    position: [3.2, 0, 0.5], plinth: [1.1, 0.7, 1.1] }
  ```
- 地面上的大字在文件最底部 `floorWords`。

### 上传 3D 模型
1. 从 Rhino / Blender / C4D 导出 **.glb**（推荐，带贴图的单文件）。尽量控制在 10MB 以内；
   Blender 导出时勾选 *Compression (Draco)* 可以大幅减小体积。
2. 放进 `assets/models/`。
3. 项目页加一个 block：`{ type:'model', src:'assets/models/xxx.glb' }`；如果想放在首页，见上一条。

### 改颜色和字体
`css/theme.css` 里的 `--blue`、`--orange`、`--paper` 等。项目详情页用的是同一文件底部 `.theme-dark` 那一组黑底颜色。
换字体：去 Google Fonts 选一个，替换 `index.html` 里的字体链接，并修改 `--font-display / --font-body / --font-mono`。

### 改名字、简介、联系方式
`js/data/site.js`。`email`、`instagram`、`linkedin` 填上后会自动出现在 About 和页脚。

### 图片尺寸建议
网页用图长边 1800px 左右就足够清晰。现有图片都已转成 WebP：`xxx-lg.webp`（大图）+ `xxx-sm.webp`（缩略图）。
新图片直接放 jpg 也可以，只是文件会大一些。

---

## 5. 技术说明
- 没有 build 步骤、没有 npm、没有付费服务。Three.js 0.160 和字体来自 jsDelivr / Google Fonts 的免费 CDN。
- 如果想完全离线：下载 `three.module.js` 和 `examples/jsm` 到本地，改 `index.html` 里 importmap 的两个网址即可。
- 页面地址：`#archive`、`#archive-objects`（带筛选）、`#work-项目slug`、`#about` —— 可以直接分享。

---

## 6. 你的真实 3D 模型（STL → 网页）

STL 原文件太大（几百 MB），网页用的是简化后的 `.mesh.json`（几何形状一样，面数少很多）：

| 项目 | 文件 | 材质 look |
|---|---|---|
| Euplectella | `assets/models/euplectella-aspergillum/sponge.mesh.json`（首页用 -lite） | `sponge` + 蓝色灯 |
| Frozen Flow | `frozen-3`（底座）`frozen-1`（芯）`frozen-2`（冰壳） | `pearl` / `core` / `ice` |
| The Unfinished Dream | `the-unfinished-dream/castle.mesh.json` | `holo`（按城堡图的青/黄/淡紫） |
| Hurricanes | `hurricanes/landfall.mesh.json`、`timeline.mesh.json` | `resin`，`glow:true` 出现"关灯"按钮 |

以后有新的 STL，把它发给我转换即可；也可以直接用 GLB（`shape:'model'`）。
