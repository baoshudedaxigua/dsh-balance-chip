# 发布说明（维护者用）

这份文档是给仓库维护者看的：如何把本仓库发布到 GitHub / Gitee，以及发布后的自检清单。

## 0. 先决条件

- 已安装 Git（`git --version` 可用）
- 有 GitHub 和/或 Gitee 账号（公开仓库免费）
- 本机已经执行过一次 `git init` 并提交（仓库已就绪）

## 1. 在网站上创建空仓库

**GitHub**：右上角 `+` → `New repository` → Repository name 填 `dsh-balance-chip` → 选 `Public` → **不要**勾选 README/.gitignore/License（本地已有）→ Create。

**Gitee**：右上角 `+` → `新建仓库` → 仓库名称 `dsh-balance-chip` → 选 `开源`（公开）→ **不要**初始化 README → 创建。

两边的仓库名保持一致，后面镜像推送最省事。

## 2/3. 配置远端并推送（一条命令）

建好两个空仓库后，在本仓库目录执行：

```powershell
# 把所有 <用户名> 换成你的账号名；脚本会配置 origin/gitee 两个远端、检查仓库是否存在、然后依次推送
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish.ps1 -GithubUser <你的GitHub名> -GiteeUser <你的Gitee名>
```

只看检查结果不推送（推荐先跑一次确认仓库已建好）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish.ps1 -GithubUser <你的GitHub名> -GiteeUser <你的Gitee名> -DryRun
```

第一次 `git push` 时会出现认证：

- **GitHub**：推荐 `git credential-manager` 弹出的浏览器登录（OAuth），登录一次后自动记住；也可以改用 Personal Access Token（Fine-grained token，只需 `Contents: read/write`）。
- **Gitee**：首次推送会要求输入账号密码；Gitee 已启用安全策略时请使用 **私人令牌**（设置 → 私人令牌）当密码。

> 推送需要你的账号授权，这一步无法由脚本代替。

也可以手动配置远端（等价于脚本第一步）：

```powershell
git remote add origin  https://github.com/<用户名>/dsh-balance-chip.git
git remote add gitee   https://gitee.com/<用户名>/dsh-balance-chip.git
git push -u origin main
git push gitee main
```

## 4. 发布后的自检

- [ ] 仓库首页能正常渲染 `README.md`，`docs/screenshot.png` 能显示
- [ ] `package.json` 的 `repository` / `homepage` / `bugs` 字段填成实际仓库地址（发布前补上）
- [ ] 打 tag 并发布 Release（可选）：`git tag v0.1.0 && git push origin v0.1.0`
- [ ] 在仓库 About 里填描述：`DeepSeek Harness plugin: show the DeepSeek topped-up balance after the sidebar nickname.`
- [ ] 如需同步到 npm：`npm publish --access public`（当前包无构建步骤，`lib/` 已提交）

## 5. 后续更新（两边同步推送）

```powershell
git add -A
git commit -m "chore: ..."
git push origin master
git push gitee master
```

Gitee 仓库可在「仓库设置 → 仓库镜像管理」里配置从 GitHub 自动同步（需要 Gitee 授权），也可以继续用上面的手动双推。
