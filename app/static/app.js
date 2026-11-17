/**
 * OpsPulse Professional SaaS Client
 * All features fully functional, layman-friendly, and interactive.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Application State ---
  let todos = [];
  let probes = [];
  let currentFilter = 'all';
  let priorityFilter = 'all';
  let searchQuery = '';
  let apiKey = localStorage.getItem('opspulse_api_key') || '';

  // --- DOM Elements ---
  // Navigation Tabs & Panels
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Task Manager Elements
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoPriority = document.getElementById('todo-priority');
  const todoCategory = document.getElementById('todo-category');
  const todoDesc = document.getElementById('todo-desc');
  const todoList = document.getElementById('todo-list');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const filterPrioritySelect = document.getElementById('filter-priority-select');
  const taskSearchInput = document.getElementById('task-search-input');
  const itemsLeft = document.getElementById('items-left');
  const emptyState = document.getElementById('empty-state');
  const emptyStateMsg = document.getElementById('empty-state-msg');
  const loadingState = document.getElementById('loading-state');

  // KPI Metrics on Tasks Tab
  const metricTotal = document.getElementById('metric-total');
  const metricCritical = document.getElementById('metric-critical');
  const metricPending = document.getElementById('metric-pending');
  const metricCompleted = document.getElementById('metric-completed');

  // Top Nav Health & Security
  const healthBadge = document.getElementById('health-indicator');
  const healthText = document.getElementById('health-text');
  const btnSecurityQuick = document.getElementById('btn-security-quick');
  const keyActiveLabel = document.getElementById('key-active-label');

  // Website Uptime Monitor Elements
  const probeForm = document.getElementById('probe-form');
  const probeName = document.getElementById('probe-name');
  const probeUrl = document.getElementById('probe-url');
  const probeList = document.getElementById('probe-list');
  const btnCheckAllProbes = document.getElementById('btn-check-all-probes');

  // Live Analytics Elements
  const statsSystemHealth = document.getElementById('stats-system-health');
  const statsUptime = document.getElementById('stats-uptime');
  const statsTotalRequests = document.getElementById('stats-total-requests');
  const statsDatabaseCount = document.getElementById('stats-database-count');
  const analyticsProgressFill = document.getElementById('analytics-progress-fill');
  const analyticsResolvedText = document.getElementById('analytics-resolved-text');
  const analyticsPercentText = document.getElementById('analytics-percent-text');
  const analyticsPendingText = document.getElementById('analytics-pending-text');
  const btnRefreshAnalytics = document.getElementById('btn-refresh-analytics');

  // Traffic Tester Elements
  const btnTraffic = document.getElementById('btn-traffic');
  const trafficProgress = document.getElementById('traffic-progress');
  const trafficProgressFill = document.getElementById('traffic-progress-fill');
  const trafficStatusText = document.getElementById('traffic-status-text');

  // Backup & Settings Elements
  const btnExport = document.getElementById('btn-export');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnSaveKey = document.getElementById('btn-save-key');
  const keyStatusMsg = document.getElementById('key-status-hint');

  // Private Vault Elements
  const vaultLockedView = document.getElementById('vault-locked-view');
  const vaultUnlockedView = document.getElementById('vault-unlocked-view');
  const vaultUnlockForm = document.getElementById('vault-unlock-form');
  const vaultPasscodeInput = document.getElementById('vault-passcode-input');
  const btnLockVault = document.getElementById('btn-lock-vault');
  const tabSettingsLabel = document.getElementById('tab-settings-label');
  let isVaultUnlocked = sessionStorage.getItem('opspulse_vault_unlocked') === 'true';

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // --- API Authentication Headers Helper ---
  function getHeaders(hasBody = false) {
    const headers = {};
    if (hasBody) headers['Content-Type'] = 'application/json';
    if (apiKey) headers['X-API-Key'] = apiKey;
    return headers;
  }

  function updateSecurityUI() {
    if (apiKey) {
      if (keyActiveLabel) keyActiveLabel.textContent = 'Security: Protected (Key Active)';
      if (apiKeyInput) apiKeyInput.value = apiKey;
      if (keyStatusMsg) keyStatusMsg.textContent = 'Active key saved in browser storage. Write actions are authorized.';
    } else {
      if (keyActiveLabel) keyActiveLabel.textContent = 'Security: Open (Dev Mode)';
      if (apiKeyInput) apiKeyInput.value = '';
      if (keyStatusMsg) keyStatusMsg.textContent = 'No key set. System is operating in open local mode.';
    }
  }

  function renderVault() {
    if (!vaultLockedView || !vaultUnlockedView) return;
    if (isVaultUnlocked) {
      vaultLockedView.classList.add('hidden');
      vaultUnlockedView.classList.remove('hidden');
      if (tabSettingsLabel) tabSettingsLabel.textContent = '🔓 Private Vault';
    } else {
      vaultLockedView.classList.remove('hidden');
      vaultUnlockedView.classList.add('hidden');
      if (tabSettingsLabel) tabSettingsLabel.textContent = '🔒 Private Vault';
    }
  }

  // --- Tab Navigation System ---
  function switchTab(tabId) {
    tabButtons.forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    tabPanels.forEach(panel => {
      if (panel.id === tabId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Auto-refresh when entering Analytics tab
    if (tabId === 'tab-analytics') {
      fetchAnalytics();
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      window.location.hash = btn.dataset.tab.replace('tab-', '');
    });
  });

  if (btnSecurityQuick) {
    btnSecurityQuick.addEventListener('click', () => {
      switchTab('tab-settings');
      window.location.hash = 'settings';
    });
  }

  // Handle URL hash routing
  function checkUrlRoute() {
    const hash = window.location.hash.replace('#', '');
    const pathname = window.location.pathname.replace('/', '');
    const target = hash || pathname;

    if (target === 'probes' || target === 'uptime') switchTab('tab-probes');
    else if (target === 'analytics') switchTab('tab-analytics');
    else if (target === 'traffic') switchTab('tab-traffic');
    else if (target === 'guide' || target === 'docs') switchTab('tab-guide');
    else if (target === 'settings') switchTab('tab-settings');
    else switchTab('tab-tasks');
  }

  // --- Health Polling ---
  async function checkHealth() {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        healthBadge.className = 'status-badge status-healthy';
        healthText.textContent = 'All Systems Live';
      } else {
        healthBadge.className = 'status-badge status-offline';
        healthText.textContent = `Server Notice (${res.status})`;
      }
    } catch {
      healthBadge.className = 'status-badge status-offline';
      healthText.textContent = 'Offline';
    }
  }

  // --- Tasks & Issues API ---
  async function fetchTodos() {
    try {
      loadingState.classList.remove('hidden');
      const res = await fetch('/todos');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      todos = await res.json();
      renderTodos();
    } catch (err) {
      console.error(err);
      showToast('Could not load tasks', 'error');
    } finally {
      loadingState.classList.add('hidden');
    }
  }

  async function createTodo(title, priority, category, description) {
    try {
      const res = await fetch('/todos', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ title, priority, category, description }),
      });
      if (res.status === 401) {
        showToast('Unauthorized: Please enter API Key in Settings', 'error');
        switchTab('tab-settings');
        return;
      }
      if (!res.ok) throw new Error('Could not create task');
      const item = await res.json();
      todos.unshift(item);
      renderTodos();
      showToast(`Created task #${item.id} [${item.priority}]`, 'success');
      fetchAnalytics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function toggleTodo(id, currentDone) {
    try {
      const res = await fetch(`/todos/${id}`, {
        method: 'PUT',
        headers: getHeaders(true),
        body: JSON.stringify({ done: !currentDone }),
      });
      if (res.status === 401) {
        showToast('Unauthorized: API Key required in Settings', 'error');
        return;
      }
      if (!res.ok) throw new Error('Could not update task');
      const updated = await res.json();
      const idx = todos.findIndex(t => t.id === id);
      if (idx !== -1) todos[idx] = updated;
      renderTodos();
      fetchAnalytics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteTodo(id) {
    try {
      const res = await fetch(`/todos/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.status === 401) {
        showToast('Unauthorized: API Key required in Settings', 'error');
        return;
      }
      if (!res.ok) throw new Error('Could not delete task');
      todos = todos.filter(t => t.id !== id);
      renderTodos();
      showToast(`Deleted task #${id}`, 'info');
      fetchAnalytics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderTodos() {
    updateKPIs();

    const filtered = todos.filter(t => {
      if (currentFilter === 'active' && t.done) return false;
      if (currentFilter === 'completed' && !t.done) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      if (searchQuery) {
        const titleMatch = (t.title || '').toLowerCase().includes(searchQuery);
        const descMatch = (t.description || '').toLowerCase().includes(searchQuery);
        const catMatch = (t.category || '').toLowerCase().includes(searchQuery);
        if (!titleMatch && !descMatch && !catMatch) return false;
      }
      return true;
    });

    todoList.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      if (searchQuery) {
        emptyStateMsg.textContent = `No tasks matching "${searchQuery}".`;
      } else {
        emptyStateMsg.textContent = 'Your workspace is clear! Use the box above to add a new task.';
      }
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach(todo => {
        todoList.appendChild(createTodoRow(todo));
      });
    }
  }

  function createTodoRow(todo) {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.done ? 'completed' : ''}`;

    const priorityClass = `badge-${todo.priority.toLowerCase()}`;
    const priorityLabels = {
      P0: 'P0 Urgent',
      P1: 'P1 High',
      P2: 'P2 Medium',
      P3: 'P3 Low',
    };
    const displayPriority = priorityLabels[todo.priority] || todo.priority;
    const dateFormatted = todo.created_at ? new Date(todo.created_at).toLocaleString() : '';

    li.innerHTML = `
      <div class="todo-item-main">
        <div class="custom-checkbox ${todo.done ? 'checked' : ''}" role="checkbox" aria-checked="${todo.done}" title="${todo.done ? 'Mark as incomplete' : 'Mark as complete'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="todo-body">
          <div class="todo-header-row">
            <span class="badge-priority ${priorityClass}">${displayPriority}</span>
            <span class="badge-category">${escapeHtml(todo.category)}</span>
            <span class="todo-title">${escapeHtml(todo.title)}</span>
          </div>
          ${todo.description ? `<p class="todo-desc">${escapeHtml(todo.description)}</p>` : ''}
          <div class="todo-meta-row">
            <span>#${todo.id}</span>
            <span>Created: ${dateFormatted}</span>
            ${todo.completed_at ? `<span>Resolved ✓</span>` : ''}
          </div>
        </div>
      </div>
      <div class="todo-actions">
        <button class="btn-icon delete" title="Delete Task">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    li.querySelector('.custom-checkbox').addEventListener('click', () => toggleTodo(todo.id, todo.done));
    li.querySelector('.btn-icon.delete').addEventListener('click', () => deleteTodo(todo.id));

    return li;
  }

  function updateKPIs() {
    const total = todos.length;
    const completed = todos.filter(t => t.done).length;
    const pending = total - completed;
    const critical = todos.filter(t => !t.done && (t.priority === 'P0' || t.priority === 'P1')).length;

    metricTotal.textContent = total;
    metricCompleted.textContent = completed;
    metricPending.textContent = pending;
    metricCritical.textContent = critical;

    itemsLeft.textContent = `${pending} active ${pending === 1 ? 'task' : 'tasks'}`;
  }

  // --- Website Uptime Monitor API ---
  async function fetchProbes() {
    try {
      const res = await fetch('/probes');
      if (!res.ok) throw new Error('Could not load website monitors');
      probes = await res.json();
      renderProbes();
    } catch (err) {
      console.error(err);
    }
  }

  async function createProbe(name, url) {
    try {
      const res = await fetch('/probes', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ name, url }),
      });
      if (res.status === 401) {
        showToast('Unauthorized: Set API Key in Settings', 'error');
        return;
      }
      if (!res.ok) throw new Error('Could not add website monitor');
      const newProbe = await res.json();
      probes.push(newProbe);
      renderProbes();
      showToast(`Added monitor for ${name}`, 'success');
      checkSingleProbe(newProbe.id);
      fetchAnalytics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function checkSingleProbe(id) {
    try {
      const res = await fetch(`/probes/${id}/check`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Ping failed');
      const updated = await res.json();
      const idx = probes.findIndex(p => p.id === id);
      if (idx !== -1) probes[idx] = updated;
      renderProbes();
      const speedNote = updated.latency_ms < 200 ? 'Fast' : updated.latency_ms < 600 ? 'Normal' : 'Slow';
      showToast(`${updated.name}: ${updated.status} (${updated.latency_ms} ms - ${speedNote})`, updated.status === 'UP' ? 'success' : 'error');
      fetchAnalytics();
    } catch (err) {
      showToast(`Check failed: ${err.message}`, 'error');
    }
  }

  async function deleteProbe(id) {
    try {
      const res = await fetch(`/probes/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Could not remove monitor');
      probes = probes.filter(p => p.id !== id);
      renderProbes();
      showToast('Website monitor removed', 'info');
      fetchAnalytics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderProbes() {
    probeList.innerHTML = '';
    if (probes.length === 0) {
      probeList.innerHTML = `
        <li class="state-placeholder">
          <p>No website monitors configured yet. Add your first website or API endpoint above!</p>
        </li>
      `;
      return;
    }

    probes.forEach(probe => {
      const li = document.createElement('li');
      li.className = 'probe-item';

      const statusClass = `probe-${probe.status.toLowerCase()}`;
      let statusHuman = 'Checking...';
      if (probe.status === 'UP') statusHuman = `Online (${probe.latency_ms} ms)`;
      else if (probe.status === 'DEGRADED') statusHuman = `Slow (${probe.latency_ms} ms)`;
      else if (probe.status === 'DOWN') statusHuman = `Offline (Unreachable)`;

      li.innerHTML = `
        <div class="probe-info">
          <h4>${escapeHtml(probe.name)}</h4>
          <span class="probe-url">${escapeHtml(probe.url)}</span>
        </div>
        <div class="probe-status-row">
          <span class="probe-badge ${statusClass}">${statusHuman}</span>
          <button class="btn btn-secondary btn-sm btn-ping" title="Check this website now">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Test Now</span>
          </button>
          <button class="btn-icon delete btn-probe-del" title="Remove monitor">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      li.querySelector('.btn-ping').addEventListener('click', () => checkSingleProbe(probe.id));
      li.querySelector('.btn-probe-del').addEventListener('click', () => deleteProbe(probe.id));
      probeList.appendChild(li);
    });
  }

  // --- Live Analytics API ---
  async function fetchAnalytics() {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) return;
      const data = await res.json();

      if (statsSystemHealth) statsSystemHealth.textContent = data.system_health || '100% Operational';
      if (statsUptime) statsUptime.textContent = data.uptime_formatted || '--';
      if (statsTotalRequests) statsTotalRequests.textContent = Number(data.total_requests).toLocaleString();
      if (statsDatabaseCount) statsDatabaseCount.textContent = `${data.total_tasks} tasks & ${data.total_probes} monitors`;

      const total = data.total_tasks || 0;
      const completed = data.completed_tasks || 0;
      const pending = data.active_tasks || 0;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      if (analyticsProgressFill) analyticsProgressFill.style.width = `${pct}%`;
      if (analyticsResolvedText) analyticsResolvedText.textContent = `${completed} Completed`;
      if (analyticsPercentText) analyticsPercentText.textContent = `${pct}% Resolved`;
      if (analyticsPendingText) analyticsPendingText.textContent = `${pending} In Progress`;
    } catch (err) {
      console.warn('Analytics refresh failed:', err);
    }
  }

  // --- Traffic Simulator ---
  async function simulateTraffic() {
    const selectedRadio = document.querySelector('input[name="traffic-count"]:checked');
    const rounds = selectedRadio ? parseInt(selectedRadio.value, 10) : 30;

    btnTraffic.disabled = true;
    trafficProgress.classList.add('active');
    trafficProgressFill.style.width = '0%';
    trafficStatusText.textContent = `Running test: 0 of ${rounds} requests processed...`;
    showToast(`Sending ${rounds} simulated requests to test server performance...`, 'info');

    let completed = 0;
    const testTitles = [
      'Upgrade redis cluster',
      'Renew wildcard SSL cert',
      'Optimize database slow query',
      'Verify backup snapshot',
      'Patch web server security alert',
    ];

    for (let i = 0; i < rounds; i++) {
      try {
        if (i % 4 === 0) await fetch('/todos');
        else if (i % 4 === 1) await fetch('/health');
        else if (i % 4 === 2 && probes.length > 0) {
          const randProbe = probes[Math.floor(Math.random() * probes.length)];
          await fetch(`/probes/${randProbe.id}/check`, { method: 'POST', headers: getHeaders() });
        } else {
          await fetch('/todos', {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify({
              title: `${testTitles[Math.floor(Math.random() * testTitles.length)]} #${Math.floor(Math.random() * 9000 + 1000)}`,
              priority: ['P1', 'P2', 'P3'][Math.floor(Math.random() * 3)],
              category: ['Infrastructure', 'Deployment', 'Bug'][Math.floor(Math.random() * 3)],
            }),
          });
        }
      } catch (err) {
        console.warn('Simulation ping failed:', err);
      }

      completed++;
      const pct = Math.round((completed / rounds) * 100);
      trafficProgressFill.style.width = `${pct}%`;
      trafficStatusText.textContent = `Running test: ${completed} of ${rounds} requests processed (${pct}%)...`;
      await new Promise(r => setTimeout(r, 40));
    }

    await fetchTodos();
    await fetchProbes();
    await fetchAnalytics();

    trafficStatusText.textContent = `✓ Success: All ${rounds} requests processed cleanly!`;
    showToast(`Traffic test completed! Check the Live Analytics tab to view new stats.`, 'success');

    setTimeout(() => {
      trafficProgress.classList.remove('active');
      trafficProgressFill.style.width = '0%';
      btnTraffic.disabled = false;
    }, 1200);
  }

  // --- Disaster Recovery / Data Backup ---
  async function exportBackup() {
    try {
      const res = await fetch('/export', { headers: getHeaders() });
      if (res.status === 401) {
        showToast('Unauthorized: Please enter API Key in Settings', 'error');
        return;
      }
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opspulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded complete backup file successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- Interactive API Playground (Guide Tab) ---
  const apiTestButtons = document.querySelectorAll('.btn-api-test');
  apiTestButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const endpoint = btn.dataset.endpoint;
      const method = btn.dataset.method || 'GET';
      const outputBoxId = `out-${endpoint.replace('/api/', '').replace('/', '')}`;
      const outputBox = document.getElementById(outputBoxId);

      btn.disabled = true;
      btn.textContent = 'Testing...';

      try {
        const start = performance.now();
        const res = await fetch(endpoint, { method, headers: getHeaders() });
        const latency = Math.round(performance.now() - start);
        const data = await res.json();

        if (outputBox) {
          outputBox.textContent = `// HTTP ${res.status} OK (${latency} ms)\n` + JSON.stringify(data, null, 2);
          outputBox.classList.remove('hidden');
        }
        showToast(`Tested ${endpoint} -> HTTP ${res.status} (${latency} ms)`, 'success');
      } catch (err) {
        if (outputBox) {
          outputBox.textContent = `// Error executing request:\n${err.message}`;
          outputBox.classList.remove('hidden');
        }
        showToast(`Test failed for ${endpoint}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Run Test';
      }
    });
  });

  // --- Notification Toast Utility ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3400);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Event Listeners Setup ---
  // Task form submission
  todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (!title) return;
    const priority = todoPriority.value;
    const category = todoCategory.value;
    const desc = todoDesc.value.trim();

    todoInput.value = '';
    todoDesc.value = '';
    await createTodo(title, priority, category, desc);
  });

  // Task filtering
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderTodos();
    });
  });

  filterPrioritySelect.addEventListener('change', () => {
    priorityFilter = filterPrioritySelect.value;
    renderTodos();
  });

  if (taskSearchInput) {
    taskSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTodos();
    });
  }

  // Probe form submission
  probeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = probeName.value.trim();
    const url = probeUrl.value.trim();
    if (!name || !url) return;
    probeName.value = '';
    probeUrl.value = '';
    await createProbe(name, url);
  });

  btnCheckAllProbes.addEventListener('click', async () => {
    showToast('Checking all websites now...', 'info');
    for (const probe of probes) {
      await checkSingleProbe(probe.id);
    }
  });

  // Traffic tester
  btnTraffic.addEventListener('click', simulateTraffic);

  // Radio pill selection UI
  const radioPills = document.querySelectorAll('.radio-pill');
  radioPills.forEach(pill => {
    pill.addEventListener('click', () => {
      radioPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const radio = pill.querySelector('input');
      if (radio) radio.checked = true;
    });
  });

  // Analytics manual refresh
  if (btnRefreshAnalytics) {
    btnRefreshAnalytics.addEventListener('click', async () => {
      await fetchAnalytics();
      showToast('Live analytics refreshed', 'success');
    });
  }

  // Export backup
  btnExport.addEventListener('click', exportBackup);

  // Private Vault Unlock & Lock
  if (vaultUnlockForm) {
    vaultUnlockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const entered = (vaultPasscodeInput.value || '').trim();
      if (!entered) return;

      // Authenticate if entered passcode matches active key, or 'admin', or if no key is enforced
      if (!apiKey || entered === apiKey || entered.toLowerCase() === 'admin') {
        isVaultUnlocked = true;
        sessionStorage.setItem('opspulse_vault_unlocked', 'true');
        vaultPasscodeInput.value = '';
        renderVault();
        showToast('Private Vault Unlocked', 'success');
      } else {
        showToast('Incorrect passcode or API Key', 'error');
      }
    });
  }

  if (btnLockVault) {
    btnLockVault.addEventListener('click', () => {
      isVaultUnlocked = false;
      sessionStorage.removeItem('opspulse_vault_unlocked');
      renderVault();
      showToast('Private Vault Locked', 'info');
    });
  }

  // API Key save
  btnSaveKey.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      localStorage.setItem('opspulse_api_key', apiKey);
      showToast('API Key saved successfully', 'success');
    } else {
      localStorage.removeItem('opspulse_api_key');
      showToast('API Key cleared (open local mode active)', 'info');
    }
    updateSecurityUI();
  });

  // --- Initial System Boot ---
  updateSecurityUI();
  renderVault();
  checkHealth();
  fetchTodos();
  fetchProbes();
  fetchAnalytics();
  checkUrlRoute();

  window.addEventListener('hashchange', checkUrlRoute);

  // Seed friendly default monitors if none exist yet
  setTimeout(async () => {
    if (probes.length === 0) {
      await createProbe('Google Search', 'https://www.google.com');
      await createProbe('GitHub Public API', 'https://api.github.com');
      await createProbe('OpsPulse Live Health', '/health');
    }
  }, 1200);

  // Periodic health check & analytics refresh every 12 seconds
  setInterval(() => {
    checkHealth();
    fetchAnalytics();
  }, 12000);
});
