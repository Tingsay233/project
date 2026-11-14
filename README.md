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
2. 它会读取 `render.yaml`，在 Environment 里填 `ANTHROPIC_API_KEY`（不填则只能手动记录）
3. 部署完得到 `https://xxx.onrender.com`，手机浏览器打开
4. 安装到主屏幕：iPhone 用 Safari →「分享」→「添加到主屏幕」；Android 用 Chrome →「⋮」→「安装应用」

（免费版闲置一段时间会休眠，第一次打开要等约 30 秒。）

**方法 B：在自己电脑上跑，手机同一个 Wi-Fi 访问**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
node server.js
```
手机浏览器打开 `http://电脑的局域网IP:3000`（Mac：`ipconfig getifaddr en0`；Windows：`ipconfig`）。
点「拍照」会直接调起手机相机。

## 本机运行

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # 没设置也能用，只是拍照识别会关闭
node server.js                         # Node 18+，无需 npm install
# 打开 http://localhost:3000
```

数据（个人资料、饮食记录、体重、常吃食物）只保存在各自浏览器本地 localStorage。

> ⚠️ AI 估算热量有 ±20% 误差，仅供参考；孕妇、未成年或有慢性病者请先咨询医生。
