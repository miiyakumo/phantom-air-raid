# 命令行试玩与调试

现在可以从终端启动真实 Chromium 游戏，发送键鼠输入，读取战况，截图，然后沿用同一浏览器继续操作。自动试玩、交互操作和回归检查共用同一套驱动。

## 首次运行

```bash
npm install
npm run game:play -- --seed 1 --seconds 60
```

脚本自动启动本地 Vite、创建独立浏览器上下文，结束时关闭自己启动的服务和浏览器，不使用日常浏览器的存档。macOS 优先使用已安装的 Google Chrome；没有本机 Chrome 时先运行 `npx playwright install chromium`。也可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定兼容的浏览器。

`--headed` 显示浏览器窗口；`--mobile` 使用 390×844 视口。默认以 960×540 运行。`--seconds` 是目标游戏时长，死亡会提前结束；暂停面板会由脚本选择第一个可点击选项。默认驾驶策略是沿矩形移动并按住 J，适合找崩溃、碰撞和流程问题，不代表熟练玩家策略。

## 边看边操作

```bash
npm run game:control -- --seed 7 --output output/game-control/session-7
```

等到输出 `ready: true` 后，每行输入一个 JSON 命令，进程会保持浏览器状态并返回最新战况：

```json
{"keys":["Enter"],"frames":2}
{"keys":["w","j"],"frames":50}
{"capture":"combat"}
{"keys":["d","j"],"frames":60}
{"keys":["p"],"frames":1}
{"keys":[],"frames":90}
{"state":true}
{"keys":["p"],"frames":1}
{"keys":[],"frames":1}
{"reset":true,"frames":0}
{"quit":true}
```

`keys` 表示本次操作后保持按住的完整按键集合。遗漏此字段会保持原有按键；空数组释放所有按键。同一个按键需要先释放才能再次触发。`frames` 默认 1，每帧是 1/60 秒，0 只执行输入或重置。

截图命令返回绝对文件路径，可直接打开查看；之后根据画面和状态决定下一步。状态包含位置、速度、生命、热量、弹丸、敌人、章节、背包和面板按钮。`state` 与 `capture` 都不推进时间。

鼠标坐标使用游戏内的 960×540 坐标，驱动会换算成实际 Canvas 坐标：

```json
{"click":{"x":480,"y":411},"frames":2}
{"pointer":{"x":480,"y":420,"down":true},"frames":1}
{"pointer":{"x":650,"y":300},"frames":30}
{"pointer":{"x":650,"y":300,"down":false},"frames":1}
```

新出现的按钮在下一帧进入 Phaser 输入列表，因此打开面板或结束战斗后要留出至少一帧再点击。

## 回放与证据

每轮输出目录包含：

| 文件 | 用途 |
| --- | --- |
| `replay.json` | 种子、视口、按帧记录的键鼠输入及显式测试场景 |
| `*.png` / `*.json` | 同一时刻的画面和完整战况快照 |
| `errors.json` | 浏览器错误及逐帧执行异常 |
| `trace.zip` | Playwright 操作、网络和截图跟踪 |
| `samples.json` | 自动试玩每轮决策后的战况 |

```bash
npm run game:play -- --replay output/playtest/latest/replay.json --output output/playtest/replayed
npx playwright show-trace output/playtest/replayed/trace.zip
```

同一种子和相同输入在相同代码、依赖和浏览器环境下应得到相同快照；回放跨版本不保证一致。实时模式依赖真实帧率，只保存截图与 trace，不承诺逐帧一致。

## 浏览器内接口

普通 `npm run dev` 页面不会暴露调试接口。使用 `?debug=1&seed=7` 可读取 `window.__gameDebug.getState()`；加 `&manual=1` 会在主菜单就绪后停止自动游戏循环，使用 `window.__gameDebug.step(60)` 推进一秒。

手动模式仍执行 Phaser 的完整更新、碰撞、计时器和渲染流程。开发适配器同步提供虚拟 `Date.now()`，让补间动画也随游戏时间前进；刷新页面可重置场景和种子，移除 `manual` 可恢复实时游玩。

`loadFixture(name)` 仅用于隔离问题：`enemy-projectile`、`shield-front`、`shield-back`、`shop`、`defeat`。快照的 `fixture` 字段和回放动作会明确记录使用情况。普通自动试玩不调用这些场景，也不修改生命、伤害或金币。

生产构建通过 `import.meta.env.DEV` 排除整个调试模块，生产页面加这些 URL 参数也不会获得调试能力。

## 验证命令

```bash
npm run verify
npm run verify:gameplay
npm run verify:production
```

`verify:gameplay` 覆盖开局击杀与奖励、弹丸移动及命中、桌面/窄屏商店点击、三次重开、暂停恢复、方向护盾、种子重放和实时战斗。失败会返回非零退出码，并保留每项的回放、快照及 trace。

`verify:production` 会先重新构建，再检查调试模块未被打包，并在生产预览中执行鼠标进入游戏和实时键盘操作，保存画面供检查。

入口代码：[浏览器驱动](../scripts/lib/game-browser.mjs)、[开发调试适配器](../src/debug/game-debug.ts)、[运行时回归](../scripts/verify-gameplay.mjs)。实现依据：[Playwright Page](https://playwright.dev/docs/api/class-page)、[Phaser TimeStep](https://docs.phaser.io/api-documentation/class/core-timestep)。本轮发现与修复见 [试玩报告](playtest-report.md)。
