/**
 * OpsPulse - DevOps Incident & Reliability Hub Frontend
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State ---
  let todos = [];
  let probes = [];
  let currentFilter = 'all';
  let priorityFilter = 'all';
  let apiKey = localStorage.getItem('opspulse_api_key') || '';

  // --- DOM Elements ---
  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Tasks elements
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoPriority = document.getElementById('todo-priority');
  const todoCategory = document.getElementById('todo-category');
  const todoDesc = document.getElementById('todo-desc');
  const todoList = document.getElementById('todo-list');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const filterPrioritySelect = document.getElementById('filter-priority-select');
  const itemsLeft = document.getElementById('items-left');
  const emptyState = document.getElementById('empty-state');
  const emptyStateMsg = document.getElementById('empty-state-msg');
  const loadingState = document.getElementById('loading-state');

  // KPI Metrics
  const metricTotal = document.getElementById('metric-total');
  const metricCritical = document.getElementById('metric-critical');
  const metricPending = document.getElementById('metric-pending');
  const metricCompleted = document.getElementById('metric-completed');

  // Health
  const healthBadge = document.getElementById('health-indicator');
  const healthText = document.getElementById('health-text');

  // Probes elements
  const probeForm = document.getElementById('probe-form');
  const probeName = document.getElementById('probe-name');
  const probeUrl = document.getElementById('probe-url');
  const probeList = document.getElementById('probe-list');
  const btnCheckAllProbes = document.getElementById('btn-check-all-probes');

  // Simulation & Export
  const btnTraffic = document.getElementById('btn-traffic');
  const trafficProgress = document.getElementById('traffic-progress');
  const trafficProgressFill = document.getElementById('traffic-progress-fill');
  const btnExport = document.getElementById('btn-export');

  // Security Modal
  const btnSecurity = document.getElementById('btn-security');
  const securityModal = document.getElementById('security-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnSaveKey = document.getElementById('btn-save-key');
  const keyActiveDot = document.getElementById('key-active-dot');

  // Toast
  const toastContainer = document.getElementById('toast-container');

  // --- Security & Headers Helper ---
  function getHeaders(hasBody = false) {
    const headers = {};
    if (hasBody) headers['Content-Type'] = 'application/json';
    if (apiKey) headers['X-API-Key'] = apiKey;
    return headers;
  }

  function updateKeyIndicator() {
    if (apiKey) {
      keyActiveDot.classList.add('active');
      keyActiveDot.title = 'API Key is active';
    } else {
      keyActiveDot.classList.remove('active');
      keyActiveDot.title = 'No API Key set';
    }
  }

  // --- Health Polling ---
  async function checkHealth() {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        healthBadge.className = 'status-badge status-healthy';
        healthText.textContent = 'API: Healthy';
      } else {
        healthBadge.className = 'status-badge status-offline';
        healthText.textContent = `API: Err ${res.status}`;
      }
    } catch {
      healthBadge.className = 'status-badge status-offline';
      healthText.textContent = 'API: Offline';
    }
  }

  // --- Tasks API & Render ---
  async function fetchTodos() {
    try {
      loadingState.classList.remove('hidden');
      const res = await fetch('/todos');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      todos = await res.json();
      renderTodos();
    } catch (err) {
      console.error(err);
      showToast('Failed to load tickets', 'error');
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
      if (res.status === 401) throw new Error('Unauthorized: Configure API Key in Security settings');
      if (!res.ok) throw new Error('Failed to create ticket');
      const item = await res.json();
      todos.unshift(item);
      renderTodos();
      showToast(`Created ticket #${item.id} [${item.priority}]`, 'success');
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
      if (res.status === 401) throw new Error('Unauthorized: Configure API Key in Security settings');
      if (!res.ok) throw new Error('Failed to update ticket status');
      const updated = await res.json();
      const idx = todos.findIndex(t => t.id === id);
      if (idx !== -1) todos[idx] = updated;
      renderTodos();
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
      if (res.status === 401) throw new Error('Unauthorized: Configure API Key in Security settings');
      if (!res.ok) throw new Error('Failed to delete ticket');
      todos = todos.filter(t => t.id !== id);
      renderTodos();
      showToast(`Deleted ticket #${id}`, 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderTodos() {
    updateKPIs();

    const filtered = todos.filter(t => {
      // Status filter
      if (currentFilter === 'active' && t.done) return false;
      if (currentFilter === 'completed' && !t.done) return false;
      // Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });

    todoList.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      emptyStateMsg.textContent = 'No matching tasks or incidents found.';
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
    const dateFormatted = todo.created_at ? new Date(todo.created_at).toLocaleString() : '';

    li.innerHTML = `
      <div class="todo-item-main">
        <div class="custom-checkbox ${todo.done ? 'checked' : ''}" role="checkbox" aria-checked="${todo.done}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="todo-body">
          <div class="todo-header-row">
            <span class="badge-priority ${priorityClass}">${todo.priority}</span>
            <span class="badge-category">${todo.category}</span>
            <span class="todo-title">${escapeHtml(todo.title)}</span>
          </div>
          ${todo.description ? `<p class="todo-desc">${escapeHtml(todo.description)}</p>` : ''}
          <div class="todo-meta-row">
            <span>#${todo.id}</span>
            <span>Created: ${dateFormatted}</span>
            ${todo.completed_at ? `<span>Resolved</span>` : ''}
          </div>
        </div>
      </div>
      <div class="todo-actions">
        <button class="btn-icon delete" title="Delete Ticket">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Event listeners
    const checkbox = li.querySelector('.custom-checkbox');
    checkbox.addEventListener('click', () => toggleTodo(todo.id, todo.done));

    const btnDel = li.querySelector('.btn-icon.delete');
    btnDel.addEventListener('click', () => deleteTodo(todo.id));

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

    itemsLeft.textContent = `${pending} active`;
  }

  // --- Probes API & Render ---
  async function fetchProbes() {
    try {
      const res = await fetch('/probes');
      if (!res.ok) throw new Error('Failed to load probes');
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
      if (res.status === 401) throw new Error('Unauthorized: Set API Key in Security settings');
      if (!res.ok) throw new Error('Failed to add probe');
      const newProbe = await res.json();
      probes.push(newProbe);
      renderProbes();
      showToast(`Added probe: ${name}`, 'success');
      // Immediately run check on the newly added probe
      checkSingleProbe(newProbe.id);
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
      if (res.status === 401) throw new Error('Unauthorized');
      if (!res.ok) throw new Error('Probe ping failed');
      const updated = await res.json();
      const idx = probes.findIndex(p => p.id === id);
      if (idx !== -1) probes[idx] = updated;
      renderProbes();
      showToast(`${updated.name}: ${updated.status} (${updated.latency_ms}ms)`, updated.status === 'UP' ? 'success' : 'error');
    } catch (err) {
      showToast(`Probe check failed: ${err.message}`, 'error');
    }
  }

  async function deleteProbe(id) {
    try {
      const res = await fetch(`/probes/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.status === 401) throw new Error('Unauthorized');
      if (!res.ok) throw new Error('Failed to delete probe');
      probes = probes.filter(p => p.id !== id);
      renderProbes();
      showToast('Probe removed', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderProbes() {
    probeList.innerHTML = '';
    if (probes.length === 0) {
      probeList.innerHTML = `<li class="state-placeholder"><p>No synthetic probes registered. Add an API or service endpoint above.</p></li>`;
      return;
    }

    probes.forEach(probe => {
      const li = document.createElement('li');
      li.className = 'probe-item';

      const statusClass = `probe-${probe.status.toLowerCase()}`;
      const latencyText = probe.latency_ms > 0 ? `${probe.latency_ms} ms` : '--';

      li.innerHTML = `
        <div class="probe-info">
          <h4>${escapeHtml(probe.name)}</h4>
          <span class="probe-url">${escapeHtml(probe.url)}</span>
        </div>
        <div class="probe-status-row">
          <span class="probe-badge ${statusClass}">${probe.status} (${latencyText})</span>
          <button class="btn btn-secondary btn-sm btn-ping" title="Execute Live Ping">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Ping</span>
          </button>
          <button class="btn-icon delete btn-probe-del" title="Delete Probe">
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

  // --- Traffic Simulation ---
  async function simulateTraffic(rounds = 30) {
    btnTraffic.disabled = true;
    trafficProgress.classList.add('active');
    trafficProgressFill.style.width = '0%';
    showToast(`Simulating ${rounds} requests to generate Prometheus metrics...`, 'info');

    let completed = 0;
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
              title: `Automated test incident #${Math.floor(Math.random() * 9000 + 1000)}`,
              priority: ['P1', 'P2', 'P3'][Math.floor(Math.random() * 3)],
              category: ['Infrastructure', 'Deployment', 'Bug'][Math.floor(Math.random() * 3)],
            }),
          });
        }
      } catch (err) {
        console.warn('Simulation ping failed:', err);
      }

      completed++;
      trafficProgressFill.style.width = `${Math.round((completed / rounds) * 100)}%`;
      await new Promise(r => setTimeout(r, 50));
    }

    await fetchTodos();
    await fetchProbes();
    showToast('Simulation complete! Prometheus & Grafana charts updated.', 'success');

    setTimeout(() => {
      trafficProgress.classList.remove('active');
      trafficProgressFill.style.width = '0%';
      btnTraffic.disabled = false;
    }, 700);
  }

  // --- Disaster Recovery / Export ---
  async function exportBackup() {
    try {
      const res = await fetch('/export', { headers: getHeaders() });
      if (res.status === 401) throw new Error('Unauthorized: Enter API Key in Security settings');
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opspulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup JSON downloaded successfully', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- Utilities ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Event Listeners ---
  // Tab Switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPanel = document.getElementById(btn.dataset.tab);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // Task creation
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

  // Filtering
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

  // Probes
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
    showToast('Executing health checks across all probes...', 'info');
    for (const probe of probes) {
      await checkSingleProbe(probe.id);
    }
  });

  // Simulation & Export
  btnTraffic.addEventListener('click', () => simulateTraffic(30));
  btnExport.addEventListener('click', exportBackup);

  // Security Modal
  btnSecurity.addEventListener('click', () => {
    apiKeyInput.value = apiKey;
    securityModal.classList.remove('hidden');
  });

  btnCloseModal.addEventListener('click', () => {
    securityModal.classList.add('hidden');
  });

  btnSaveKey.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      localStorage.setItem('opspulse_api_key', apiKey);
      showToast('API Key saved', 'success');
    } else {
      localStorage.removeItem('opspulse_api_key');
      showToast('API Key cleared (open development mode)', 'info');
    }
    updateKeyIndicator();
    securityModal.classList.add('hidden');
  });

  // --- Initial Boot ---
  updateKeyIndicator();
  checkHealth();
  fetchTodos();
  fetchProbes();

  // Seed default probe if none exists
  setTimeout(async () => {
    if (probes.length === 0) {
      await createProbe('Local Health Endpoint', 'http://localhost:8000/health');
    }
  }, 1000);

  setInterval(checkHealth, 10000);
});
