# 幻翼合体：空袭升级

[在线游玩](https://miiyakumo.github.io/phantom-air-raid/) · [旧东方棋归档](https://miiyakumo.github.io/miiyakumo/legacy/touhou-chess.html)

Minecraft 同人题材的轻量单机网页游戏。玩家控制方块飞行器移动并自动攻击，在躲避敌人攻击的同时升级。敌人会不断叠加 Minecraft 生物部件和能力，早期 Boss 最终会降级为普通敌人，新的合体 Boss 继续制造数值压力。

## 当前状态

项目处于玩法重构阶段。现有页面是早期概念原型，后续以 [`docs/requirements.md`](docs/requirements.md) 和 [`docs/game-design.md`](docs/game-design.md) 为实施依据。

## 设计原则

- 操作简单：玩家主要负责移动和放风筝，攻击自动完成。
- 素材全面 Minecraft 化：角色、敌人、弹丸、掉落物和场景统一使用方块像素风。
- 文字克制：战斗画面只显示必要信息，土味主要通过画面、数值和反馈体现。
- 数值持续膨胀：玩家会变强，但敌人增长更快；旧 Boss 会从稀有威胁变成常规敌人。
- 单机非商业：不做登录、商城、联网排行榜或付费系统。

## 实施路线

具体执行顺序见 [`docs/roadmap.md`](docs/roadmap.md)。先完成可玩的放风筝战斗切片，再扩展部件化敌人、MC 化素材和数值膨胀。

## 运行

不要直接用 `file://` 打开 `index.html`：它引用 TypeScript 模块和 Vite 资源，浏览器不会在文件协议下编译和加载。

在项目目录执行：

```bash
npm install
npm run dev
```

然后打开终端显示的地址（通常是 `http://127.0.0.1:5173/`；如果端口被占用，Vite 会自动切换到下一个端口）。

## 命令行试玩与回归

```bash
npm run game:play -- --seed 1 --seconds 60
npm run game:control -- --seed 7
npm run verify:gameplay
npm run verify:production
```

支持固定种子、按帧推进、键鼠操作、截图、战况快照和输入重放。运行时回归会实际打开浏览器并操作游戏。详见 [调试用法](docs/debugging.md) 和 [本轮问题与修复报告](docs/playtest-report.md)。

## 部署

推送到 `main` 后，GitHub Actions 安装依赖并执行逻辑验证、浏览器回归和生产预览检查，全部通过后将 `dist/` 发布到 GitHub Pages。运行证据保存在 Actions 的 `gameplay-evidence` 附件中，保留 7 天。

Vite 使用相对资源路径，适配 `/phantom-air-raid/` 仓库子路径。旧东方棋归档保留在个人站中，与本项目源码和部署相互独立。
