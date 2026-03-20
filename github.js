/**
 * GitHub API Integration
 * Fetches public repository data and renders repo cards dynamically.
 *
 * Usage: Include this script after ui-kit/icons.js in index.html.
 * The module looks for a container with id="github-repos" and populates it.
 */

const GITHUB_USERNAME = 'andypeterson2';
const REPOS_API = `https://api.github.com/users/${GITHUB_USERNAME}/repos`;

// Repos to feature (by name). Leave empty to auto-pick by stars/recent activity.
const PINNED_REPOS = [];

// Maximum repos to display when no pinned list is provided
const MAX_REPOS = 6;

// Language color map (subset — extend as needed)
const LANG_COLORS = {
  Python: '#3572A5',
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  Java: '#b07219',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Go: '#00ADD8',
  Jupyter: '#DA5B0B',
  'Jupyter Notebook': '#DA5B0B',
};

/**
 * Fetch public repos from the GitHub API.
 * Returns an array of repo objects or null on failure.
 */
async function fetchRepos() {
  try {
    const res = await fetch(`${REPOS_API}?per_page=100&sort=updated`);
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('GitHub API fetch failed:', err);
    return null;
  }
}

/**
 * Pick which repos to display.
 * If PINNED_REPOS is non-empty, filter to those names (preserving order).
 * Otherwise, sort by stargazers then by recent push, and take MAX_REPOS.
 */
function selectRepos(repos) {
  // Filter out forks
  const own = repos.filter(r => !r.fork);

  if (PINNED_REPOS.length > 0) {
    const pinned = PINNED_REPOS.map(name =>
      own.find(r => r.name.toLowerCase() === name.toLowerCase())
    ).filter(Boolean);
    return pinned;
  }

  // Sort: stars desc, then pushed_at desc
  own.sort((a, b) => {
    if (b.stargazers_count !== a.stargazers_count) {
      return b.stargazers_count - a.stargazers_count;
    }
    return new Date(b.pushed_at) - new Date(a.pushed_at);
  });

  return own.slice(0, MAX_REPOS);
}

/**
 * Build the HTML string for a single repo card.
 */
function repoCardHTML(repo) {
  const lang = repo.language || '';
  const langDot = lang
    ? `<span class="repo-lang">
         <span class="repo-lang-dot" style="background:${LANG_COLORS[lang] || '#8b8b8b'}"></span>
         ${lang}
       </span>`
    : '';

  const starIcon = UIKit.ICONS.star || '';
  const branchIcon = UIKit.ICONS.codeBranch || '';
  const githubIcon = UIKit.ICONS.github || '';

  const stars = repo.stargazers_count > 0
    ? `<span class="repo-stat">${starIcon} ${repo.stargazers_count}</span>`
    : '';

  const forks = repo.forks_count > 0
    ? `<span class="repo-stat">${branchIcon} ${repo.forks_count}</span>`
    : '';

  const desc = repo.description
    ? `<p class="project-desc">${escapeHTML(repo.description)}</p>`
    : '<p class="project-desc" style="opacity:0.5">No description provided.</p>';

  return `
    <div class="project-card">
      <div class="project-header">
        <h3 class="project-title">
          ${branchIcon}
          ${escapeHTML(repo.name)}
        </h3>
        <a class="project-link" href="${repo.html_url}" target="_blank" rel="noopener noreferrer"
           aria-label="${escapeHTML(repo.name)} on GitHub">
          ${githubIcon}
        </a>
      </div>
      ${desc}
      <div class="repo-meta">
        ${langDot}${stars}${forks}
      </div>
    </div>`;
}

/**
 * Render the repo cards into the #github-repos container.
 */
async function renderGitHubRepos() {
  const container = document.getElementById('github-repos');
  if (!container) return;

  // Show a loading skeleton while fetching
  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 1.5rem 0;">
      <span class="repo-loading">Loading repositories&hellip;</span>
    </div>`;

  const allRepos = await fetchRepos();

  if (!allRepos) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 1rem 0;">
        <span class="repo-error">Could not load repositories. Check back later.</span>
      </div>`;
    return;
  }

  const repos = selectRepos(allRepos);

  if (repos.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = repos.map(repoCardHTML).join('');
}

/** Basic HTML escaping to prevent XSS from repo data. */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', renderGitHubRepos);
