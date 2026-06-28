(function initProjectTree(root) {
  function normalizeCollapsedProjectIds(value) {
    if (value instanceof Set) return new Set(Array.from(value).filter(Boolean).map(String));
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter(Boolean).map(String));
  }

  function isProjectExpanded(projectId, collapsedProjectIds = []) {
    const collapsed = normalizeCollapsedProjectIds(collapsedProjectIds);
    return !collapsed.has(String(projectId || ""));
  }

  function toggleProjectExpansion({ projectId, currentProjectId = "", collapsedProjectIds = [] } = {}) {
    const id = String(projectId || "");
    const collapsed = normalizeCollapsedProjectIds(collapsedProjectIds);
    if (!id) return { currentProjectId, collapsedProjectIds: collapsed };
    if (collapsed.has(id)) {
      collapsed.delete(id);
      return { currentProjectId: id, collapsedProjectIds: collapsed };
    }
    collapsed.add(id);
    return { currentProjectId, collapsedProjectIds: collapsed };
  }

  const api = {
    isProjectExpanded,
    normalizeCollapsedProjectIds,
    toggleProjectExpansion,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MbhProjectTree = api;
})(typeof window !== "undefined" ? window : globalThis);
