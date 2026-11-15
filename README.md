<p align="center"><img src="assets/icon.svg" width="112" alt="抽屉图标" /></p>

# 抽屉 · LocalNotes

一个放常用文字和文件入口的 Windows 桌面小工具。按「分类 → 项目 → 内容」整理资料，下次用到时直接复制。

适合经常重复发送开票信息、常用回复、项目资料和附件的人。不用注册账号，内容保存在本机。

[下载 Windows 免安装版](https://github.com/cq243247097-lgtm/drawer/releases/latest) · [使用与反馈](https://github.com/cq243247097-lgtm/drawer/issues)

## 下载安装

从本仓库的 **Releases** 页面下载 `Drawer-1.0.0-Windows.exe`，放进一个有写入权限的独立文件夹，双击运行。适用于 Windows 10 / 11 x64，免安装。

如果收到的是分享压缩包，先完整解压，再运行里面的 EXE。首次运行会生成示例内容，你可以直接修改或删除。

## 能做什么

- 三栏分类、项目和内容管理，支持拖拽排序。
- 双击编辑纯文本，自动保存；一键复制文字。
- 选择或拖入本地文件，保存原文件入口；复制文件后，可粘贴到支持文件粘贴的聊天窗口或文件夹。
- `Ctrl+F` 全局搜索分类、项目和内容。
- 浅色 / 深色主题，JSON 备份导出与导入。

## 第一次使用

1. 在左侧添加分类，再在中间添加项目。
2. 点击「新增条目」填写常用文字，或点击「关联文件」添加文件入口。
3. 需要发送时复制相应文字或文件，到聊天软件里粘贴，再自行发送。

编辑时按 `Ctrl+Enter` 或点击空白处保存，`Esc` 取消修改。文件被移动或删除后，原入口会失效，需要重新关联。

## 数据放在哪里

免安装版优先在 EXE 同级的 `LocalNotes-Data/notes-data.json` 保存资料；目录不可写时，回退到 Electron 的用户数据目录。开发版使用项目下的 `data/notes-data.json`。

更新程序前建议先导出 JSON 备份。替换 EXE 时保留 `LocalNotes-Data` 文件夹。备份只包含文字、分类与文件路径，不包含关联文件本身；换电脑时需要另行拷贝原文件并重新关联。导入会替换当前记录。

分享软件时只分享发布包，不要把自己的 `LocalNotes-Data` 或 JSON 备份一起发送。

## 本地开发

环境：Windows x64、Node.js 22 或更新版本、pnpm。依赖版本记录在 `pnpm-lock.yaml`。

```sh
pnpm install --frozen-lockfile
pnpm start
```

```sh
# 重新生成抽屉图标（SVG、PNG 和多尺寸 ICO）
pnpm icons

# 打包 Windows 免安装程序
pnpm build

# 只生成解包后的程序目录
pnpm build:dir
```

构建输出在 `dist/`。首次构建需要下载 Electron 及打包工具。文件复制功能依赖 Windows PowerShell，目前面向 Windows，不承诺 macOS / Linux 兼容。

## 项目结构

```text
main.js                 Electron 主进程、本地数据与文件操作
preload.js              页面与主进程通信
src/                    页面、样式和交互
assets/                 抽屉图标
scripts/generate-icon.js 免依赖图标生成器

```

当前版本不包含 AI 对话、云同步或自动发送功能。演示短片里的 AI 角色讲述的是工具制作过程。

## 反馈与许可

欢迎在 Issues 描述使用问题或提交改进。请勿上传含私人内容的笔记备份、文件路径或截图。

本项目沿用 MIT 许可证，见 [LICENSE](LICENSE)。Electron 等依赖遵循各自许可证。
