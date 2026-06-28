(function initScriptGrade(root) {
  function normalizeScriptGrade(value) {
    const text = String(value || "").trim().toUpperCase();
    if (text === "A" || text.includes("A级".toUpperCase()) || text.includes("A-GRADE")) return "A";
    return "B";
  }

  function formatScriptGrade(value) {
    return `grade ${normalizeScriptGrade(value)}`;
  }

  function scriptGradeLabel(value) {
    return `${normalizeScriptGrade(value)}级本`;
  }

  function buildScriptGradePrompt(value) {
    const grade = normalizeScriptGrade(value);
    if (grade === "A") {
      return [
        "剧本等级：A级本。",
        "定位：正式投放、重点项目、需要更高完成度和更低返工率。",
        "质量要求：开场钩子必须强，人物动机必须清楚，冲突递进必须连续，反转和爽点要服务主线，情绪点、画面感、台词张力都要更精修。",
        "执行方式：生成时先理解材料与核心卖点；输出前做一次自检，不达标时主动局部重写或强化，不要把明显薄弱段落交付给用户。",
        "成本说明：允许更细致、更完整，宁可多用一些 token，也要保证质量稳定。",
      ].join("\n");
    }
    return [
      "剧本等级：B级本。",
      "定位：快速可用、批量测试、先看方向。",
      "质量要求：结构完整、冲突明确、节奏可读、台词可用，保留核心爽点和人物关系。",
      "执行方式：优先一次成稿，不做过度扩写；发现关键缺口时提醒用户补充。",
      "成本说明：控制篇幅和 token，速度优先。",
    ].join("\n");
  }

  const api = {
    normalizeScriptGrade,
    formatScriptGrade,
    scriptGradeLabel,
    buildScriptGradePrompt,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MbhScriptGrade = api;
})(typeof window !== "undefined" ? window : globalThis);
