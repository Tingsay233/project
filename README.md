# 轻卡 🥗 拍照算卡路里的减肥 App

- 📷 **拍照识别**：拍一张食物照片，AI（Claude 视觉）估算每样食物的热量、蛋白质、碳水、脂肪，并给出减肥建议
- 🎯 **每日热量**：输入身高体重年龄活动量和目标体重，用 Mifflin-St Jeor 公式算出基础代谢、每日消耗、每天该吃多少（设有安全下限：女 1200 / 男 1500 千卡），并预估多少周达标
- 🏠 **今日饮食**：热量圆环 + 三大营养素进度，剩余热量一目了然；也可从内置的马来西亚/中式常见食物手动添加
- 🥗 **减肥指南**：餐盘比例、食物替换（椰浆饭、炒粿条、奶茶等）、健康零食
- 📈 **体重记录与曲线**：记录体重，查看实际 vs 计划曲线和目标线，记新体重后每日热量自动重算
- 🌐 **中文 / English** 双语，右上角一键切换（拍照识别结果也会用对应语言）

- ⭐ **常吃食物**：拍照结果或今天的记录上点 ☆ 收藏，之后在「今日」页点一下就记入

## 用手机看

**方法 A：部署到网上（推荐，随时随地用）**
1. 打开 https://render.com ，用 GitHub 登录 → New → Web Service → 选这个仓库
2. 它会读取 `render.yaml`，在 Environment 里填 `GEMINI_API_KEY`（免费，见下；不填则只能手动记录）
3. 部署完得到 `https://xxx.onrender.com`，手机浏览器打开
4. 安装到主屏幕：iPhone 用 Safari →「分享」→「添加到主屏幕」；Android 用 Chrome →「⋮」→「安装应用」

（免费版闲置一段时间会休眠，第一次打开要等约 30 秒。）

**方法 B：在自己电脑上跑，手机同一个 Wi-Fi 访问**
```bash
export GEMINI_API_KEY=你的免费key
node server.js
```
手机浏览器打开 `http://电脑的局域网IP:3000`（Mac：`ipconfig getifaddr en0`；Windows：`ipconfig`）。
点「拍照」会直接调起手机相机。

## 🔒 访问密码与额度保护
- 环境变量 `ACCESS_PASSWORD`：设置后，拍照识别需要输入密码（App 内「计划」页底部「设置」里填一次，会记住）。密码错 5 次锁 10 分钟。
- `MAX_DAILY`（默认 200）：全站每天最多识别次数；`MAX_PER_IP_HOUR`（默认 30）：每个 IP 每小时次数。
- 不设 `ACCESS_PASSWORD` 时，任何知道网址的人都能消耗你的 API 额度，服务启动时会提醒。

## 📦 做成 APK（安卓安装包，独立运行，不需要服务器）
用 Capacitor 把网页打包成安卓 App，由 GitHub Actions 云端构建，**不用装 Android Studio**，**不用部署任何服务器**：
1. 去 https://aistudio.google.com/apikey 免费申请 Gemini 密钥
2. 仓库 → Actions → **Build APK**（推送代码会自动构建，也可手动 Run workflow）
3. 构建完成后在该次运行页面底部 Artifacts 下载 `LightCal-apk`，解压得到 `app-debug.apk`
4. 传到安卓手机安装（需允许「安装未知来源应用」）
5. 打开 App →「计划」页底部「设置」→ 粘贴 Gemini 密钥 → 保存并测试。密钥只存在这部手机里，拍照识别由手机直接调用 Gemini

**更新**：每次构建会自动发布到仓库的 **Releases** 页面（固定下载链接）。App 打开时会自动检查，「计划」页底部也有「检查更新」按钮，发现新版点「下载新版」→ 安装即可覆盖，记录不会丢。（注意：安卓不允许 App 静默安装，最后一步要你自己点「安装」。）

（如果你有自己的服务器，也可以在 Actions Variables 里设 `SERVER_URL`，或在 App 设置里填服务器网址，走服务器模式。）
这是 debug 版 APK，自己用没问题；要上架 Google Play 需要再做签名的 release 版。iPhone 无法安装 APK，请用 Safari「添加到主屏幕」。

## 本机运行

```bash
export GEMINI_API_KEY=你的免费key   # 没设置也能用，只是拍照识别会关闭
node server.js                         # Node 18+，无需 npm install
# 打开 http://localhost:3000
```

数据（个人资料、饮食记录、体重、常吃食物）只保存在各自浏览器本地 localStorage。

> ⚠️ AI 估算热量有 ±20% 误差，仅供参考；孕妇、未成年或有慢性病者请先咨询医生。
