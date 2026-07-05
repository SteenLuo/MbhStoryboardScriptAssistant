# 初始化技能基线

本目录保存当前产品的初始化正式技能快照，用于测试前恢复和打包发布。

原则：

- 这里是基线副本，不会被运行时代码加载。
- 运行时正式技能仍然只从 `skills/` 目录读取。
- 学习生成的沉淀项不进入本基线。
- 生成规则就是校验规则；初始化状态不额外携带隐藏校验规则。

当前基线：

- 正式技能：9 个。
- 学习生成技能项：0 个。
- 默认硬校验规则：0 条。

恢复命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Reset-SkillsToInitial.ps1
```
