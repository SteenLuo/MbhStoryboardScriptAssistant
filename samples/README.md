# 样例目录

这里用于存放已有剧本和分镜样例。

使用人员只需要提供材料，不需要整理。

你可以先不整理，直接把以前做过的剧本、分镜、草稿、定稿、混合文档放到：

```text
samples/_inbox/
```

如果已经直接放在 `samples/` 根目录，也可以。系统会把这些散落文件当作待分拣原始材料处理。

系统会先做分拣，再整理成规范样例。

第一轮自动分拣报告可由本地工具生成：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "../tools/New-InboxScanReport.ps1" -Root "." -OutDir "_reports" -Force
```

最新扫描报告：

- [_reports/inbox-scan-2026-06-10](./_reports/inbox-scan-2026-06-10.md)
- [_reports/unknown-material-review-2026-06-10](./_reports/unknown-material-review-2026-06-10.md)

也可以直接在对话窗口里发送文件或粘贴内容。系统负责判断材料类型、文件关联、规范目录、notes 和候选规则。

如果系统无法判断剧本和分镜之间的对应关系，会再向你提出简短确认问题。

已经整理出的规范样例：

```text
samples/剧目/001-新房/
samples/剧目/002-第十七集/
samples/剧目/003-八零杂货铺/
```

规范样例按“一部剧”归拢。每部剧下面再按集数放入 `episodes/`。

例如八零杂货铺：

```text
samples/剧目/003-八零杂货铺/
├── 剧目说明.md
└── episodes/
    ├── 002-第二集/
    │   ├── script.final.md
    │   ├── storyboard.final.md
    │   └── notes.md
    └── 003-第三集/
```

八零杂货铺第 2 集、第 3 集属于“总剧本 -> 已收到分集分镜”的一对多关系；每一集内部再判断是否完整对应。

如果后续手动整理，建议按剧目结构：

```text
samples/剧目/编号-剧名/
├── 剧目说明.md
├── source/                可选，小说或原始材料
├── scripts/               可选，总剧本或多集剧本
└── episodes/
    └── 001-第一集/
        ├── script.input.md     可选
        ├── script.final.md     可选
        ├── storyboard.input.md 可选
        ├── storyboard.final.md 可选
        └── notes.md
```

使用人员仍然不需要手动整理，系统会完成这些结构化工作。

样例学习规范见：

- [../docs/样例学习规范.md](../docs/样例学习规范.md)

后续补样例优先级见：

- [待补样例清单](待补样例清单.md)

后续新材料入库流程见：

- [_reports/后续样例入库流程](./_reports/后续样例入库流程.md)
- [_reports/templates/新样例入库检查清单](./_reports/templates/新样例入库检查清单.md)
