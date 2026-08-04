const assert = require("node:assert/strict");
const test = require("node:test");

function buildCanvasFixture(nodeCount, edgeCount) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `node-${index}`,
    type: index === 0 ? "novel" : index % 3 === 0 ? "script" : index % 3 === 1 ? "storyboard" : "label",
    title: `压力节点 ${index + 1}`,
    content: `第 ${index + 1} 个节点的漫剧生产内容。`,
    x: (index % 25) * 420,
    y: Math.floor(index / 25) * 300,
    width: 360,
    height: 240,
    meta: {},
  }));
  const edges = Array.from({ length: edgeCount }, (_, index) => ({
    id: `edge-${index}`,
    from: `node-${index % nodeCount}`,
    to: `node-${(index * 7 + 11) % nodeCount}`,
    label: "",
    fromSide: "right",
    toSide: "left",
  })).filter((edge) => edge.from !== edge.to);
  return { nodes, edges };
}

test("pressure fixtures cover daily, full-series, and 1000-node limits", () => {
  for (const [nodeCount, edgeCount] of [[200, 400], [500, 1000], [1000, 2000]]) {
    const fixture = buildCanvasFixture(nodeCount, edgeCount);
    assert.equal(fixture.nodes.length, nodeCount);
    assert.ok(fixture.edges.length >= edgeCount - 1);
    assert.equal(new Set(fixture.nodes.map((node) => node.id)).size, nodeCount);
  }
});

module.exports = { buildCanvasFixture };
