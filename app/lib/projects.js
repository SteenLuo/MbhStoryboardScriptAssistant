const DEFAULT_PROJECT_ID = "no-project";
const DEFAULT_PROJECT_TITLE = "无项目";

function cleanTitle(title, fallback = "未命名项目") {
  const text = String(title || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function normalizeProjects(projects = [], now = () => new Date().toISOString()) {
  const seen = new Set();
  const output = [];
  const sourceProjects = Array.isArray(projects) ? projects : [];
  const defaultProject = sourceProjects.find((project) => String(project?.id || "").trim() === DEFAULT_PROJECT_ID) || {};
  const add = (project) => {
    const id = String(project?.id || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    output.push({
      id,
      title: cleanTitle(project.title, id === DEFAULT_PROJECT_ID ? DEFAULT_PROJECT_TITLE : "未命名项目"),
      createdAt: project.createdAt || now(),
      updatedAt: project.updatedAt || project.createdAt || now(),
    });
  };

  add({
    id: DEFAULT_PROJECT_ID,
    title: defaultProject.title || DEFAULT_PROJECT_TITLE,
    createdAt: defaultProject.createdAt,
    updatedAt: defaultProject.updatedAt,
  });
  for (const project of sourceProjects) add(project);
  return output;
}

function createProject(projects = [], title = "", now = () => new Date().toISOString(), idSource = () => Math.random().toString(16).slice(2, 8)) {
  const normalized = normalizeProjects(projects, now);
  const project = {
    id: `project-${idSource()}`,
    title: cleanTitle(title),
    createdAt: now(),
    updatedAt: now(),
  };
  return {
    project,
    projects: normalizeProjects([...normalized, project], now),
  };
}

function resolveProjectId(projectId, projects = []) {
  const ids = new Set(normalizeProjects(projects).map((item) => item.id));
  return ids.has(projectId) ? projectId : DEFAULT_PROJECT_ID;
}

function renameProject(projects = [], id = "", title = "", now = () => new Date().toISOString()) {
  const projectId = resolveProjectId(id, projects);
  const normalized = normalizeProjects(projects, now);
  const nextTitle = cleanTitle(title, normalized.find((project) => project.id === projectId)?.title || DEFAULT_PROJECT_TITLE);
  const nextProjects = normalized.map((project) => (
    project.id === projectId
      ? { ...project, title: nextTitle, updatedAt: now() }
      : project
  ));
  return {
    project: nextProjects.find((project) => project.id === projectId),
    projects: normalizeProjects(nextProjects, now),
  };
}

function groupConversationsByProject(conversations = [], projects = []) {
  const normalizedProjects = normalizeProjects(projects);
  return normalizedProjects.map((project) => ({
    ...project,
    conversations: (Array.isArray(conversations) ? conversations : []).filter((conversation) => (
      resolveProjectId(conversation?.projectId, normalizedProjects) === project.id
    )),
  }));
}

module.exports = {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_TITLE,
  cleanTitle,
  createProject,
  groupConversationsByProject,
  normalizeProjects,
  renameProject,
  resolveProjectId,
};
