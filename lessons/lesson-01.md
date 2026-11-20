# 第 1 课：第一个网页 + 一个会动的按钮

**目标**：做一个网页，上面有一句标题和一个按钮，点按钮后文字会变。
**时间**：15 分钟。**不用安装任何东西。**

## 先理解 3 个词
- **HTML**：网页的「骨架」，决定页面上有什么（标题、按钮、文字）
- **JavaScript**：网页的「大脑」，决定点了按钮会发生什么
- **标签**：HTML 用尖括号包起来的东西，例如 `<h1>标题</h1>`，有开头 `<h1>` 和结尾 `</h1>`

## 步骤
1. 在 GitHub 打开这个仓库，**切到 `practice` 分支**
2. 点 **Add file → Create new file**，文件名填 `hello.html`
3. **亲手敲**下面的内容（别复制！）：

```html
<!doctype html>
<html>
<body>

  <h1 id="title">你好，我是 ______</h1>
  <button onclick="change()">点我</button>

  <script>
    function change() {
      document.getElementById("title").textContent = "我会写代码了！";
    }
  </script>

</body>
</html>
```

4. 把 `______` 换成你的名字
5. 点右上角 **Commit changes** → 选 **Commit directly to the `practice` branch**
6. 回来告诉我：「第 1 课交了」

## 我会检查什么
- 标签有没有成对（开头和结尾）
- `id="title"` 和 `getElementById("title")` 两处名字要**一模一样**
- 点按钮后文字有没有变

## 想挑战的话（选做）
- 把按钮上的字改成别的
- 点按钮后，让文字变成你喜欢的另一句话
- 再加一个按钮，点它把文字变回来

## 想一想（答案下次告诉我）
1. `onclick="change()"` 里的 `change` 是在哪里定义的？
2. 如果我把 `id="title"` 改成 `id="t"`，但 JavaScript 里不改，会发生什么？
