# 幻翼合体：空袭升级

[在线版本](https://miiyakumo.github.io/phantom-air-raid/) · [旧东方棋归档](https://miiyakumo.github.io/miiyakumo/legacy/touhou-chess.html)

Minecraft 风格的轻量单机网页游戏。移动躲避敌人，自动发射三叉戟，在五场首领战之间升级与购买装备；击败过的 Boss 会在后续章节成为普通敌人。

## 战斗循环修订分支

本分支简化了攻击、成长和奖励规则。线上页面在本分支合并且 Pages 部署成功前不会更新。当前规则、移除的实验机制及验证限制见 [战斗循环修订记录](docs/combat-loop-revision.md)。旧设计文档和旧验收报告保留为历史参考。

## 操作

- 自动攻击；WASD、方向键或触屏拖动移动。
- 空格冲刺；点击敌人或 Q 切换锁定。
- E 打开待选升级或商店；F 使用钩爪；G 使用金苹果；P 暂停。
- 屏幕底部提供对应按钮。击败前四个 Boss 后安全休整，击败最终 Boss 后自动结算。

## 运行与验证

```bash
npm ci
npm run dev
```

不要直接用 `file://` 打开源码 `index.html`；它需要 Vite 编译 TypeScript。

```bash
npm run verify
npx playwright install chromium
npm run verify:gameplay
npm run verify:production
```

命令行操作与回放工具继续保留：`npm run game:play`、`npm run game:control`。调试桥只允许开发构建通过显式 URL 参数启用，不进入正式部署。

本轮在离线替代引擎加载方式下完成基础规则和 Chromium 检查，尚未执行原生依赖安装、完整 TypeScript 检查与 Vite 生产构建；不能把本轮局部验证当作全部验收完成。详见修订记录。

## 发布

原有 GitHub Actions 流程保持不变：main 的逻辑验证、浏览器回归和生产检查通过后发布 dist。本项目源码及部署与个人站、旧东方棋归档独立。单机、非商业，不包含登录或联网付费功能。
