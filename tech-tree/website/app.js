// === Tech Tree App ===

const NODE_W = 176;
const NODE_H = 28;
const COL_GAP = 48;
const ROW_GAP = 6;
const PADDING = 32;

// === Theme Color Palettes (for canvas rendering) ===

const THEME_DARK = {
  canvasBg:       '#2d2b22',
  nodeLocked:     { bg: '#2d2b22', border: '#3a3830' },
  nodeUnlocked:   { bg: '#1e261e', border: '#3a5030' },
  nodeLearned:    { bg: '#1a2c1a', border: '#3a6a3a' },
  nodeTarget:     { bg: '#2a2010', border: '#d8a657' },
  nodeAncU:       { bg: '#222010', border: '#5a4a18' },
  nodeAncL:       { bg: '#1e1c10', border: '#3a3018' },
  nodeSelOverlay: '#d8a65722',
  textNormal:     '#d4be98',
  textLocked:     '#6b6858',
  textAccent:     '#d8a657',
  textTeal:       '#6ba3a0',
  edgeLearned:    'rgba(169,182,101,0.35)',
  edgeUnlocked:   'rgba(107,163,160,0.35)',
  edgeLocked:     'rgba(90,85,70,0.18)',
  badge: ['#3a3830','#2a2a5a','#243450','#2a3a8a','#4a3a7a','#5a2a6a','#7a2a4a','#9a3030','#b84010'],
};

const THEME_LIGHT = {
  canvasBg:       '#f5f0e0',
  nodeLocked:     { bg: '#e8e2d0', border: '#c8c0a8' },
  nodeUnlocked:   { bg: '#d8e8d4', border: '#7aa870' },
  nodeLearned:    { bg: '#cce4cc', border: '#4a8a4a' },
  nodeTarget:     { bg: '#f0e8c8', border: '#b8881e' },
  nodeAncU:       { bg: '#e8e0c0', border: '#a08840' },
  nodeAncL:       { bg: '#e4dcc8', border: '#908060' },
  nodeSelOverlay: '#b8881e22',
  textNormal:     '#2d2b22',
  textLocked:     '#8a8070',
  textAccent:     '#b8881e',
  textTeal:       '#4a7a78',
  edgeLearned:    'rgba(90,122,48,0.40)',
  edgeUnlocked:   'rgba(74,122,120,0.40)',
  edgeLocked:     'rgba(160,152,130,0.30)',
  badge: ['#c8c0a8','#7a7aaa','#6a8aaa','#5a6aaa','#7a5a9a','#8a4a7a','#9a4a5a','#aa4a40','#c05a28'],
};

function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? THEME_LIGHT : THEME_DARK;
}

let treeData = null;
let nodeMap = {};       // id -> node
let positions = {};     // id -> {x, y}
let learned = new Set(JSON.parse(localStorage.getItem("learned") || "[]"));
let selectedNode = null;
let filteredNodes = new Set();
let targetNode = null;
let targetAncestors = new Set();

// Camera
let cam = { x: 0, y: 0, zoom: 1 };
let dragging = false;
let dragStart = { x: 0, y: 0 };

const canvas = document.getElementById("tree-canvas");
const ctx = canvas.getContext("2d");

// === Data Loading ===

async function loadData() {
  const resp = await fetch("data/qsvm.json");
  treeData = await resp.json();

  // Build node map
  treeData.nodes.forEach(n => { nodeMap[n.id] = n; });

  // Filter to only nodes with prereqs or that ARE prereqs (the interesting subgraph)
  const hasConnections = new Set();
  treeData.nodes.forEach(n => {
    if (n.prereqs.length > 0) {
      hasConnections.add(n.id);
      n.prereqs.forEach(p => hasConnections.add(p));
    }
  });

  // Initial filter: show connected nodes
  filteredNodes = hasConnections;

  layoutNodes();
  resizeCanvas();
  centerView();
  updateStats();
  render();
}

// === Layout (left-to-right by depth) ===

function layoutNodes() {
  positions = {};

  // Group filtered nodes by depth
  const byDepth = {};
  treeData.nodes.forEach(n => {
    if (!filteredNodes.has(n.id)) return;
    const d = n.depth;
    if (!byDepth[d]) byDepth[d] = [];
    byDepth[d].push(n);
  });

  const depths = Object.keys(byDepth).map(Number).sort((a, b) => a - b);

  depths.forEach(d => {
    // Sort nodes within depth for visual stability
    // Heuristic: sort by average prereq Y position, then alphabetically
    byDepth[d].sort((a, b) => {
      const aAvg = avgPrereqY(a);
      const bAvg = avgPrereqY(b);
      if (aAvg !== bAvg) return aAvg - bAvg;
      return a.id.localeCompare(b.id);
    });

    const col = depths.indexOf(d);
    const x = PADDING + col * (NODE_W + COL_GAP);

    byDepth[d].forEach((n, i) => {
      const y = PADDING + i * (NODE_H + ROW_GAP);
      positions[n.id] = { x, y };
    });
  });
}

function avgPrereqY(node) {
  const prereqs = node.prereqs.filter(p => positions[p]);
  if (prereqs.length === 0) return 0;
  return prereqs.reduce((s, p) => s + positions[p].y, 0) / prereqs.length;
}

// Run layout twice for better prereq-based ordering
function refineLayout() {
  layoutNodes();
  layoutNodes();
}

// === Rendering ===

function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}

function render() {
  const C = getTheme();
  ctx.fillStyle = C.canvasBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.zoom, cam.zoom);

  // Draw edges
  treeData.edges.forEach(e => {
    if (!positions[e.from] || !positions[e.to]) return;
    const from = positions[e.from];
    const to = positions[e.to];

    ctx.beginPath();
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;

    const cx = (x1 + x2) / 2;
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cx, y1, cx, y2, x2, y2);

    const fromState = getNodeState(e.from);
    const toState = getNodeState(e.to);

    if (fromState === "learned" && toState === "learned") {
      ctx.strokeStyle = C.edgeLearned;
    } else if (fromState === "learned" || fromState === "ancestor-unlocked" || fromState === "target") {
      ctx.strokeStyle = C.edgeUnlocked;
    } else {
      ctx.strokeStyle = C.edgeLocked;
    }
    ctx.lineWidth = 1;
    ctx.stroke();

    drawArrow(x2, y2, Math.atan2(y2 - y1, x2 - x1), ctx.strokeStyle);
  });

  // Draw nodes
  treeData.nodes.forEach(n => {
    if (!positions[n.id]) return;
    drawNode(n);
  });

  ctx.restore();
  requestAnimationFrame(render);
}

function drawNode(node) {
  const pos = positions[node.id];
  if (!pos) return;

  const C = getTheme();
  const state = getNodeState(node.id);
  const isSelected = selectedNode === node.id;

  const colors = getNodeColors(state, C);

  // Node background
  ctx.fillStyle = colors.bg;
  ctx.fillRect(pos.x, pos.y, NODE_W, NODE_H);

  // Border — 2px if selected, 1px otherwise
  ctx.strokeStyle = isSelected ? C.textAccent : colors.border;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.strokeRect(
    pos.x + (isSelected ? 1 : 0.5),
    pos.y + (isSelected ? 1 : 0.5),
    NODE_W - (isSelected ? 2 : 1),
    NODE_H - (isSelected ? 2 : 1)
  );

  // Depth badge — left edge, small square
  const badgeW = 20;
  ctx.fillStyle = getDepthColor(node.depth, C);
  ctx.fillRect(pos.x, pos.y, badgeW, NODE_H);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px "Atkinson Hyperlegible", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.depth, pos.x + badgeW / 2, pos.y + NODE_H / 2);

  // Label
  const isLocked = state === 'locked' || state === 'ancestor-locked';
  ctx.fillStyle = isLocked ? C.textLocked : (state === 'target' ? C.textAccent : C.textNormal);
  ctx.font = '12px "Atkinson Hyperlegible", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const maxChars = 17;
  let label = node.id;
  if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';
  ctx.fillText(label, pos.x + badgeW + 5, pos.y + NODE_H / 2);

  // State icon — right edge
  ctx.font = '12px "Atkinson Hyperlegible", sans-serif';
  ctx.textAlign = 'right';
  if (state === 'learned') {
    ctx.fillStyle = C.edgeLearned.replace(/,[^,]+\)/, ',1)').replace('rgba', 'rgb');
    ctx.fillStyle = C.textTeal;
    ctx.fillText('✓', pos.x + NODE_W - 4, pos.y + NODE_H / 2);
  } else if (state === 'target') {
    ctx.fillStyle = C.textAccent;
    ctx.fillText('◎', pos.x + NODE_W - 4, pos.y + NODE_H / 2);
  }
}

function getNodeColors(state, C) {
  if (state === 'learned')          return C.nodeLearned;
  if (state === 'target')           return C.nodeTarget;
  if (state === 'ancestor-unlocked') return C.nodeAncU;
  if (state === 'ancestor-locked')  return C.nodeAncL;
  if (state === 'unlocked')         return C.nodeUnlocked;
  return C.nodeLocked;
}

function drawArrow(x, y, angle, color) {
  const size = 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size / 2);
  ctx.lineTo(-size, size / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// roundRect kept for compatibility but unused in current style
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.closePath();
}

// === Node States ===

function getNodeState(id) {
  if (learned.has(id)) return "learned";
  const node = nodeMap[id];
  if (!node) return "locked";
  const unlocked = node.prereqs.length === 0 || node.prereqs.every(p => learned.has(p));
  if (id === targetNode) return "target";
  if (targetAncestors.has(id)) return unlocked ? "ancestor-unlocked" : "ancestor-locked";
  if (unlocked) return "unlocked";
  return "locked";
}

// Legacy functions replaced by getNodeColors() / getDepthColor() with theme arg
function getNodeBg(state, selected) { return getNodeColors(state, getTheme()).bg; }
function getNodeBorder(state, selected) { return getNodeColors(state, getTheme()).border; }

function getDepthColor(depth, C) {
  C = C || getTheme();
  return C.badge[Math.min(depth, C.badge.length - 1)];
}

// === Knowledge Gap ===

function knowledgeGap(targetId) {
  // BFS from target backward through prereqs, counting unlearned nodes
  const visited = new Set();
  const queue = [targetId];
  let gap = 0;

  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    if (!learned.has(id) && id !== targetId) gap++;

    const node = nodeMap[id];
    if (node) {
      node.prereqs.forEach(p => {
        if (!visited.has(p)) queue.push(p);
      });
    }
  }

  return gap;
}

// === Study Guide ===

function generateStudyGuide(targetId) {
  // Topological sort of all ancestors of target, filtered to unlearned
  const ancestors = new Set();
  const queue = [targetId];

  while (queue.length > 0) {
    const id = queue.shift();
    if (ancestors.has(id)) continue;
    ancestors.add(id);
    const node = nodeMap[id];
    if (node) node.prereqs.forEach(p => queue.push(p));
  }

  // Topological sort
  const sorted = [];
  const visited = new Set();

  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodeMap[id];
    if (node) node.prereqs.forEach(p => { if (ancestors.has(p)) visit(p); });
    sorted.push(id);
  }

  ancestors.forEach(id => visit(id));

  return sorted.map(id => ({
    id,
    depth: nodeMap[id]?.depth || 0,
    state: getNodeState(id),
    preview: nodeMap[id]?.content_preview || ""
  }));
}

function showStudyGuide(targetId) {
  const steps = generateStudyGuide(targetId);
  const container = document.getElementById("guide-steps");
  const target = document.getElementById("guide-target");
  const panel = document.getElementById("study-guide");

  target.textContent = targetId;
  container.innerHTML = "";

  steps.forEach((step, i) => {
    const div = document.createElement("div");
    div.className = `guide-step ${step.state}`;
    div.innerHTML = `
      <div class="step-num">${i + 1}</div>
      <div class="step-name">${step.id}</div>
      <div class="step-depth">d${step.depth}</div>
    `;
    div.addEventListener("click", () => selectNode(step.id));
    container.appendChild(div);
  });

  panel.classList.remove("hidden");

  // Export handler
  document.getElementById("guide-export").onclick = () => {
    let md = `# Study Guide: ${targetId}\n\n`;
    steps.forEach((step, i) => {
      const check = step.state === "learned" ? "x" : " ";
      md += `${i + 1}. [${check}] **${step.id}** (depth ${step.depth})\n`;
      if (step.preview) md += `   ${step.preview}\n`;
      md += "\n";
    });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-guide-${targetId.replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

// === Interaction ===

function selectNode(id) {
  selectedNode = id;
  const node = nodeMap[id];
  if (!node) return;

  const panel = document.getElementById("node-detail");
  panel.classList.remove("hidden");

  document.getElementById("detail-name").textContent = node.id;
  document.getElementById("detail-aliases").textContent = node.aliases.length ? `aka: ${node.aliases.join(", ")}` : "";
  document.getElementById("detail-depth").textContent = node.depth;
  document.getElementById("detail-gap").textContent = knowledgeGap(node.id);
  document.getElementById("detail-preview").textContent = node.content_preview;

  const prereqsList = document.getElementById("detail-prereqs");
  prereqsList.innerHTML = "";
  node.prereqs.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p;
    li.addEventListener("click", () => selectNode(p));
    prereqsList.appendChild(li);
  });

  const unlocksList = document.getElementById("detail-unlocks");
  unlocksList.innerHTML = "";
  (node.unlocks || []).forEach(u => {
    const li = document.createElement("li");
    li.textContent = u;
    li.addEventListener("click", () => selectNode(u));
    unlocksList.appendChild(li);
  });

  // Toggle learned button
  const btn = document.getElementById("btn-toggle-learned");
  btn.textContent = learned.has(id) ? "Mark as Unlearned" : "Mark as Learned";
  btn.onclick = () => {
    if (learned.has(id)) learned.delete(id);
    else learned.add(id);
    localStorage.setItem("learned", JSON.stringify([...learned]));
    btn.textContent = learned.has(id) ? "Mark as Unlearned" : "Mark as Learned";
    document.getElementById("detail-gap").textContent = knowledgeGap(node.id);
    updateStats();
    updateTargetGap();
  };

  // Study guide button
  document.getElementById("btn-study-guide").onclick = () => showStudyGuide(id);

  // Center view on node
  const pos = positions[id];
  if (pos) {
    cam.x = canvas.width / 2 - (pos.x + NODE_W / 2) * cam.zoom;
    cam.y = canvas.height / 2 - (pos.y + NODE_H / 2) * cam.zoom;
  }
}

function getNodeAtPos(mx, my) {
  // Convert mouse to world coords
  const wx = (mx - cam.x) / cam.zoom;
  const wy = (my - cam.y) / cam.zoom;

  for (const n of treeData.nodes) {
    const pos = positions[n.id];
    if (!pos) continue;
    if (wx >= pos.x && wx <= pos.x + NODE_W && wy >= pos.y && wy <= pos.y + NODE_H) {
      return n.id;
    }
  }
  return null;
}

// === Stats ===

function updateStats() {
  const connected = [...filteredNodes];
  const total = connected.length;
  const learnedCount = connected.filter(id => learned.has(id)).length;
  const unlockedCount = connected.filter(id => {
    const s = getNodeState(id);
    return s === "unlocked" || s === "ancestor-unlocked" || s === "target";
  }).length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-learned").textContent = learnedCount;
  document.getElementById("stat-unlocked").textContent = unlockedCount;
  document.getElementById("stat-depth").textContent = treeData.metadata.max_depth;
  document.getElementById("progress-fill").style.width = `${(learnedCount / total) * 100}%`;

  updateTargetGap();
}

function updateTargetGap() {
  if (!targetNode) return;
  const gap = knowledgeGap(targetNode);
  const prereqCount = targetAncestors.size > 0 ? targetAncestors.size - 1 : 0; // exclude target itself
  const learnedInPath = [...targetAncestors].filter(id => id !== targetNode && learned.has(id)).length;
  document.getElementById("target-gap-display").textContent =
    `Gap: ${gap} unlearned prerequisites (${learnedInPath}/${prereqCount} done)`;
  const pct = prereqCount > 0 ? (learnedInPath / prereqCount) * 100 : 100;
  document.getElementById("target-progress-fill").style.width = `${pct}%`;
}

function centerView() {
  // Center on the graph
  const allPos = Object.values(positions);
  if (allPos.length === 0) return;

  const minX = Math.min(...allPos.map(p => p.x));
  const maxX = Math.max(...allPos.map(p => p.x + NODE_W));
  const minY = Math.min(...allPos.map(p => p.y));
  const maxY = Math.max(...allPos.map(p => p.y + NODE_H));

  const graphW = maxX - minX;
  const graphH = maxY - minY;

  const scaleX = (canvas.width - 80) / graphW;
  const scaleY = (canvas.height - 80) / graphH;
  cam.zoom = Math.min(scaleX, scaleY, 1.5);
  cam.zoom = Math.max(cam.zoom, 0.3);

  cam.x = (canvas.width - graphW * cam.zoom) / 2 - minX * cam.zoom;
  cam.y = (canvas.height - graphH * cam.zoom) / 2 - minY * cam.zoom;
}

// === Event Handlers ===

canvas.addEventListener("mousedown", (e) => {
  const nodeId = getNodeAtPos(e.offsetX, e.offsetY);
  if (nodeId) {
    selectNode(nodeId);
  } else {
    dragging = true;
    dragStart = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (dragging) {
    cam.x = e.offsetX - dragStart.x;
    cam.y = e.offsetY - dragStart.y;
  }

  // Hover cursor
  const nodeId = getNodeAtPos(e.offsetX, e.offsetY);
  canvas.style.cursor = nodeId ? "pointer" : dragging ? "grabbing" : "grab";
});

canvas.addEventListener("mouseup", () => { dragging = false; });
canvas.addEventListener("mouseleave", () => { dragging = false; });

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const oldZoom = cam.zoom;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  cam.zoom = Math.max(0.1, Math.min(3, cam.zoom * delta));

  // Zoom toward mouse position
  const mx = e.offsetX;
  const my = e.offsetY;
  cam.x = mx - (mx - cam.x) * (cam.zoom / oldZoom);
  cam.y = my - (my - cam.y) * (cam.zoom / oldZoom);
}, { passive: false });

canvas.addEventListener("dblclick", (e) => {
  const nodeId = getNodeAtPos(e.offsetX, e.offsetY);
  if (nodeId) {
    if (learned.has(nodeId)) learned.delete(nodeId);
    else learned.add(nodeId);
    localStorage.setItem("learned", JSON.stringify([...learned]));
    updateStats();
    if (selectedNode === nodeId) selectNode(nodeId); // refresh detail
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
});

// Filters
document.getElementById("filter-has-prereqs").addEventListener("change", (e) => {
  applyFilters();
});

document.getElementById("filter-unlocked").addEventListener("change", (e) => {
  applyFilters();
});

document.getElementById("search").addEventListener("input", (e) => {
  applyFilters();
});

document.getElementById("guide-close").addEventListener("click", () => {
  document.getElementById("study-guide").classList.add("hidden");
});

// === Target Search ===

document.getElementById("target-search").addEventListener("input", (e) => {
  const term = e.target.value.trim().toLowerCase();
  const suggestionsEl = document.getElementById("target-suggestions");

  if (term.length < 2) {
    suggestionsEl.classList.add("hidden");
    return;
  }

  const matches = treeData.nodes
    .filter(n =>
      n.id.toLowerCase().includes(term) ||
      n.aliases.some(a => a.toLowerCase().includes(term))
    )
    .slice(0, 12);

  if (matches.length === 0) {
    suggestionsEl.classList.add("hidden");
    return;
  }

  suggestionsEl.innerHTML = "";
  matches.forEach(n => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.innerHTML = `<span>${n.id}</span><span class="suggestion-depth">d${n.depth}</span>`;
    div.addEventListener("mousedown", (ev) => {
      ev.preventDefault(); // prevent input blur before click fires
      setTarget(n.id);
    });
    suggestionsEl.appendChild(div);
  });

  suggestionsEl.classList.remove("hidden");
});

document.getElementById("target-search").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.getElementById("target-suggestions").classList.add("hidden");
    e.target.blur();
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#target-search-wrap")) {
    document.getElementById("target-suggestions").classList.add("hidden");
  }
});

document.getElementById("btn-clear-target").addEventListener("click", clearTarget);

document.getElementById("btn-target-guide").addEventListener("click", () => {
  if (targetNode) showStudyGuide(targetNode);
});

document.getElementById("filter-path").addEventListener("change", applyFilters);

// === Target ===

function getAncestors(targetId) {
  const ancestors = new Set();
  const queue = [targetId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (ancestors.has(id)) continue;
    ancestors.add(id);
    const node = nodeMap[id];
    if (node) node.prereqs.forEach(p => queue.push(p));
  }
  return ancestors;
}

function setTarget(id) {
  targetNode = id;
  targetAncestors = getAncestors(id);

  // Update display
  document.getElementById("target-display").classList.remove("hidden");
  document.getElementById("target-name").textContent = id;
  updateTargetGap();

  // Ensure target + ancestors are visible (merge into current filter)
  targetAncestors.forEach(a => filteredNodes.add(a));
  refineLayout();
  updateStats();

  // Center on target node
  const pos = positions[id];
  if (pos) {
    cam.x = canvas.width / 2 - (pos.x + NODE_W / 2) * cam.zoom;
    cam.y = canvas.height / 2 - (pos.y + NODE_H / 2) * cam.zoom;
  }

  // Clear the search input
  document.getElementById("target-search").value = "";
  document.getElementById("target-suggestions").classList.add("hidden");
}

function clearTarget() {
  targetNode = null;
  targetAncestors = new Set();
  document.getElementById("target-display").classList.add("hidden");
  document.getElementById("filter-path").checked = false;
  applyFilters();
}

function applyFilters() {
  const hasPrereqs = document.getElementById("filter-has-prereqs").checked;
  const onlyUnlocked = document.getElementById("filter-unlocked").checked;
  const onlyPath = document.getElementById("filter-path").checked;
  const searchTerm = document.getElementById("search").value.toLowerCase();

  // Base set: nodes with connections
  const connected = new Set();
  treeData.nodes.forEach(n => {
    if (n.prereqs.length > 0) {
      connected.add(n.id);
      n.prereqs.forEach(p => connected.add(p));
    }
  });

  filteredNodes = new Set();
  treeData.nodes.forEach(n => {
    // Path filter: only show target's ancestor chain
    if (onlyPath && targetNode && !targetAncestors.has(n.id)) return;
    if (hasPrereqs && !connected.has(n.id)) return;
    if (onlyUnlocked) {
      const s = getNodeState(n.id);
      if (s === "locked" || s === "ancestor-locked") return;
    }
    if (searchTerm && !n.id.toLowerCase().includes(searchTerm) &&
        !n.aliases.some(a => a.toLowerCase().includes(searchTerm))) return;
    filteredNodes.add(n.id);
  });

  // Always keep target + ancestors visible unless path filter overrides
  if (targetNode && !onlyPath) {
    targetAncestors.forEach(a => filteredNodes.add(a));
  }

  refineLayout();
  updateStats();
}

// === Theme Toggle ===

document.getElementById("theme-toggle").addEventListener("click", () => {
  const isLight = document.documentElement.dataset.theme === "light";
  window.__setTheme(isLight ? "dark" : "light");
  document.getElementById("theme-toggle").textContent = isLight ? "LIGHT" : "DARK";
});

// Update button text to match current theme (set by theme-bootstrap.js)
document.getElementById("theme-toggle").textContent =
  document.documentElement.dataset.theme === "light" ? "DARK" : "LIGHT";

// === Init ===
loadData();
