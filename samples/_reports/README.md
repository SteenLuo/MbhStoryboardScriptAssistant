# 样例分拣报告

这里存放 `sample-ingest` 对 `_inbox` 原始材料的扫描和分拣结果。

当前最新投放区扫描报告：

- [inbox-scan-2026-06-10](inbox-scan-2026-06-10.md)
- [unknown-material-review-2026-06-10](unknown-material-review-2026-06-10.md)

生成命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "../../tools/New-InboxScanReport.ps1" -Root ".." -OutDir "." -Force
```

报告建议包含：

- 文件清单。
- 材料类型判断。
- 可能的项目归属。
- 草稿 / 定稿判断。
- 可学习内容。
- 不建议学习内容。
- 需要用户确认的问题。
