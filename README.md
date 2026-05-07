# 自动评教脚本

> 一款通用自动评教脚本，适配国内多所高校教务系统评教页面的自动填写与提交

[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-v4.0-orange?style=flat-square&logo=tampermonkey)](https://www.tampermonkey.net/)
[![ScriptCat](https://img.shields.io/badge/ScriptCat-v8.0-blue?style=flat-square)](https://docs.scriptcat.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=flat-square&logo=javascript)](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-4.0-blue?style=flat-square)](./自动评教脚本.user.js)

---

## 项目概览

| 项目 | 说明 |
|------|------|
| 技术栈 | JavaScript + Tampermonkey API |
| 兼容浏览器 | Chrome / Edge / Firefox 等主流浏览器 |
| 代码量 | ~1800 行 |
| 许可证 | MIT License |

## 适配院校

| 院校 | 状态 |
|------|------|
| 三峡大学科技学院 | 已测试 |

## 功能特性

- **全自动评教** — 自动填写所有选项，支持自动提交或手动确认
- **速度可调** — 提交倒计时 1~10 秒可调，支持快速模式跳过等待
- **自定义内容** — 可自定义 Q14 改进建议、Q15 优点评价
- **进度可视化** — 悬浮球实时显示完成进度
- **页面检测** — 自动识别评教页面与列表页面，提示清晰
- **错误日志** — 操作失败自动记录，点击可查看详情
- **庆祝动画** — 全部完成后播放彩色纸屑动画

## 安装

### 环境要求

- 浏览器安装了 [Tampermonkey](https://www.tampermonkey.net/) 扩展

### 安装步骤

1. 点击 [自动评教脚本.user.js](./自动评教脚本.user.js) 查看源码
2. 复制全部内容
3. 打开 Tampermonkey 控制台 → 新建脚本 → 粘贴 → 保存
4. 访问教务评教页面，脚本自动运行

## 使用方法

1. 打开教务系统，进入**待评教老师列表页面**
2. 点击右下角悬浮球展开控制面板
3. 填写 Q14 / Q15 自定义内容（可选，默认已有内容）
4. 打开「自动提交」开关（可选）
5. 点击「开始评教」，脚本自动完成所有评教

## 界面预览

全新 Apple/iOS 风格 UI，蓝色主题，流畅毛玻璃效果。

## 更新日志

> **v4.0** — 全新 Apple/iOS 风格 UI，蓝色主题（#007AFF）替代原橙色。悬浮球新增 SVG 进度环，毛玻璃面板质感升级。面板拖动即时跟随不再卡顿，日志区域精简折叠，推广引流改为点击直接跳转。庆祝动画同步调整为蓝色主题。核心评教逻辑全部保留不变。

## 安全与防查

本脚本在设计时已考虑降低被检测的风险：

- 操作间隔模拟人工随机节奏，非固定频率
- 优先操作 DOM 节点而非直接修改数据，行为贴近真实用户
- 无需向任何第三方服务器发送请求，所有数据均在本地处理
- 脚本代码完全开源透明，无隐藏代码，无加密混淆

> **郑重提示**：尽管本脚本已采取上述防检测措施，但**无法保证**在任何情况下都能完全规避学校的后台风控或行为监测机制。请勿在学校明确禁止使用自动化工具的情况下使用本脚本，因违规使用导致的一切后果（包括但不限于账号封禁、学号标记、纪律处分等）由使用者自行承担全部责任。

## 免责声明

本脚本仅供**学习交流与个人便利**使用，请勿用于商业用途或任何大规模自动化操作。

- 本脚本模拟人工操作，无法替代教务系统的正式评教流程
- 使用本脚本即表示您同意自行承担所有风险，开发者不对因使用本脚本导致的任何后果负责
- 请勿在同一时间段内对同一系统进行高频次自动化操作，以免触发风控机制
- 本脚本会读取并填写评教表单内容，请确保在可信任的网络环境下使用
- 如有疑问，请先咨询学校教务部门

---

![GitHub Stats](https://github-readme-stats.vercel.app/api?username=XTmai&theme=default)
![Top Langs](https://github-readme-stats.vercel.app/api/top-langs/?username=XTmai&layout=compact)
