function buildCompletenessMatrix() {
  return [
    {
      milestone: "M0",
      name: "项目基础",
      expected: "项目边界、产物协议、运行目录和参考原则清楚。",
      webStatus: "已接入：网页对话、系统提示和运行目录都围绕 AI 漫剧剧本/分镜，不扩成通用助理。",
      evidence: ["README.md", "docs/项目说明.md", "app/server.js"],
      gaps: ["网页内还没有独立展示项目边界和产物协议。"],
      next: "在设置或状态页增加项目边界摘要，可选。",
    },
    {
      milestone: "M1",
      name: "本地分层技能包",
      expected: "本地技能按职责分层，三种入口能找到对应技能。",
      webStatus: "已接入：网页对话会按输入路由到本地 skill，并读取对应 SKILL.md / references。",
      evidence: ["skills/README.md", "app/lib/localSkills.js"],
      gaps: ["当前是单主技能路由，尚未显示完整多技能调用链。"],
      next: "补技能调用轨迹，显示从总控到专业技能的链路。",
    },
    {
      milestone: "M2",
      name: "样例学习",
      expected: "样例投放、分拣、候选规则和评测基准可持续沉淀。",
      webStatus: "部分接入：网页支持附件上传和 sample-ingest 路由，学习闭环可扫描样例投放区。",
      evidence: ["app/public/app.js", "tools/New-InboxScanReport.ps1", "skills/04-learning/sample-ingest/SKILL.md"],
      gaps: ["网页没有样例入库状态视图；复杂样例仍主要依赖 tools 脚本。"],
      next: "在网页增加样例扫描结果入口和待确认清单入口。",
    },
    {
      milestone: "M3",
      name: "三条业务链路",
      expected: "小说到剧本分镜、剧本评审改写到分镜、认可剧本直接分镜都能跑。",
      webStatus: "已初步接入：网页工作台可把输入、理解、剧本版本、检查结果、分镜版本和归档学习渲染成流程思维导图，并支持节点查看和手动归档学习。",
      evidence: ["docs/M3三条链路验收记录.md", "docs/M8阶段产物工作台阶段记录.md", "app/lib/workbench.js", "app/public/app.js", "runs/"],
      gaps: ["流程查看和手动归档已可用，后续还可以补更细的版本来源识别、人工修改节点和批量导出。"],
      next: "把 M2/M4 浏览入口和 M6 路由评测集继续接到网页。",
    },
    {
      milestone: "M4",
      name: "评测和进化",
      expected: "技能改进有评测证据，能统计分镜指标和生成进化草案。",
      webStatus: "部分接入：后台脚本完整，网页可通过学习闭环刷新进入 M4/M5 汇总。",
      evidence: ["tools/Measure-Storyboard.ps1", "tools/New-SkillEvolutionDraft.ps1", "learning/evals/"],
      gaps: ["网页没有评测任务和进化草案浏览入口。"],
      next: "增加评测任务、学习快照和技能进化草案的只读入口。",
    },
    {
      milestone: "M5",
      name: "自主学习闭环",
      expected: "对话、反馈、样例和降质记录能转成候选规则与快照。",
      webStatus: "已接入：网页对话会自动写入学习记录，设置面板可刷新学习闭环。",
      evidence: ["app/lib/conversationLearning.js", "tools/Invoke-AutoLearningCycle.ps1", "learning/conversation-records/"],
      gaps: ["自动学习记录仍是规则触发，后续可升级为更细的分类器。"],
      next: "补学习记录列表和候选规则确认入口。",
    },
    {
      milestone: "M6",
      name: "拆分专业技能和路由",
      expected: "总控入口能调度专业技能，技能可独立改进。",
      webStatus: "已接入：每轮对话保存 skillRoute，并在网页消息元信息中显示命中 skill。",
      evidence: ["app/lib/localSkills.js", "app/lib/chatUsage.js", "app/public/app.js"],
      gaps: ["路由规则当前基于关键词，后续需要更多触发样例或分类评测。"],
      next: "把 docs/M6 触发样例转成自动化路由测试集。",
    },
  ];
}

module.exports = {
  buildCompletenessMatrix,
};
