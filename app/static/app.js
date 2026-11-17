/**
 * DevOps Todo Application Frontend Logic
 * Interacts with FastAPI backend endpoints:
 * - GET    /health
 * - GET    /metrics
 * - GET    /todos
 * - POST   /todos
 * - GET    /todos/:id
 * - PUT    /todos/:id
 * - DELETE /todos/:id
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const itemsLeft = document.getElementById('items-left');
  const emptyState = document.getElementById('empty-state');
  const emptyStateMsg = document.getElementById('empty-state-msg');
  const loadingState = document.getElementById('loading-state');

  // Metrics elements
  const metricTotal = document.getElementById('metric-total');
  const metricPending = document.getElementById('metric-pending');
  const metricCompleted = document.getElementById('metric-completed');

  // Health indicator
  const healthBadge = document.getElementById('health-indicator');
  const healthText = document.getElementById('health-text');

  // Traffic generator
  const btnTraffic = document.getElementById('btn-traffic');
  const trafficProgress = document.getElementById('traffic-progress');
  const trafficProgressFill = document.getElementById('traffic-progress-fill');

  // Toast container
  const toastContainer = document.getElementById('toast-container');

  // --- State ---
  let todos = [];
  let currentFilter = 'all';
  let isEditingId = null;

  // --- API Functions ---
  async function checkHealth() {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        setHealthStatus(true, 'API: Healthy');
      } else {
        setHealthStatus(false, `API: Error (${res.status})`);
      }
    } catch {
      setHealthStatus(false, 'API: Disconnected');
    }
  }

  function setHealthStatus(isHealthy, text) {
    healthBadge.classList.remove('status-checking', 'status-healthy', 'status-offline');
    if (isHealthy) {
      healthBadge.classList.add('status-healthy');
    } else {
      healthBadge.classList.add('status-offline');
    }
    healthText.textContent = text;
  }

  async function fetchTodos() {
    try {
      loadingState.classList.remove('hidden');
      emptyState.classList.add('hidden');
      const res = await fetch('/todos');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      todos = await res.json();
      render();
    } catch (err) {
      console.error('Failed to load todos:', err);
      showToast('Could not load todos from API', 'error');
    } finally {
      loadingState.classList.add('hidden');
    }
  }

  async function createTodo(title) {
    try {
      const res = await fetch('/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail?.[0]?.msg || 'Error creating task');
      }
      const newTodo = await res.json();
      todos.push(newTodo);
      render();
      showToast(`Created task #${newTodo.id}`, 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  }

  async function toggleTodo(id, currentDone) {
    try {
      const res = await fetch(`/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !currentDone }),
      });
      if (!res.ok) throw new Error('Error updating task');
      const updated = await res.json();
      const index = todos.findIndex(t => t.id === id);
      if (index !== -1) {
        todos[index] = updated;
      }
      render();
    } catch (err) {
      console.error(err);
      showToast('Failed to update task status', 'error');
    }
  }

  async function updateTitle(id, newTitle) {
    if (!newTitle || !newTitle.trim()) {
      showToast('Task title cannot be empty', 'error');
      render();
      return;
    }
    try {
      const res = await fetch(`/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) throw new Error('Error updating task title');
      const updated = await res.json();
      const index = todos.findIndex(t => t.id === id);
      if (index !== -1) {
        todos[index] = updated;
      }
      isEditingId = null;
      render();
      showToast('Task updated', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save title update', 'error');
    }
  }

  async function deleteTodo(id) {
    try {
      const res = await fetch(`/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error deleting task');
      todos = todos.filter(t => t.id !== id);
      render();
      showToast(`Deleted task #${id}`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete task', 'error');
    }
  }

  // --- Render Functions ---
  function render() {
    updateMetrics();

    const filtered = todos.filter(t => {
      if (currentFilter === 'active') return !t.done;
      if (currentFilter === 'completed') return t.done;
      return true;
    });

    todoList.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      if (currentFilter === 'active') {
        emptyStateMsg.textContent = 'No active tasks found.';
      } else if (currentFilter === 'completed') {
        emptyStateMsg.textContent = 'No completed tasks yet.';
      } else {
        emptyStateMsg.textContent = 'Your todo list is clear! Add your first task above.';
      }
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach(todo => {
        const li = createTodoElement(todo);
        todoList.appendChild(li);
      });
    }
  }

  function createTodoElement(todo) {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.done ? 'completed' : ''}`;
    li.dataset.id = todo.id;

    const mainDiv = document.createElement('div');
    mainDiv.className = 'todo-item-main';

    // Checkbox
    const checkbox = document.createElement('div');
    checkbox.className = `custom-checkbox ${todo.done ? 'checked' : ''}`;
    checkbox.setAttribute('role', 'checkbox');
    checkbox.setAttribute('aria-checked', todo.done);
    checkbox.setAttribute('tabindex', '0');
    checkbox.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    checkbox.addEventListener('click', () => toggleTodo(todo.id, todo.done));
    checkbox.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleTodo(todo.id, todo.done);
      }
    });

    mainDiv.appendChild(checkbox);

    if (isEditingId === todo.id) {
      // Inline editing mode
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'todo-edit-input';
      input.value = todo.title;
      input.maxLength = 200;

      const finishEdit = () => updateTitle(todo.id, input.value);

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishEdit();
        if (e.key === 'Escape') {
          isEditingId = null;
          render();
        }
      });
      input.addEventListener('blur', finishEdit);

      mainDiv.appendChild(input);
      setTimeout(() => input.focus(), 50);
    } else {
      // Normal display
      const title = document.createElement('span');
      title.className = 'todo-title';
      title.textContent = todo.title;
      title.title = 'Double click to edit';
      title.addEventListener('dblclick', () => {
        isEditingId = todo.id;
        render();
      });

      const badge = document.createElement('span');
      badge.className = 'todo-id-badge';
      badge.textContent = `#${todo.id}`;

      mainDiv.appendChild(title);
      mainDiv.appendChild(badge);
    }

    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'todo-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.title = 'Edit task';
    editBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.addEventListener('click', () => {
      isEditingId = todo.id;
      render();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon delete';
    deleteBtn.title = 'Delete task';
    deleteBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(mainDiv);
    li.appendChild(actionsDiv);
    return li;
  }

  function updateMetrics() {
    const total = todos.length;
    const completed = todos.filter(t => t.done).length;
    const pending = total - completed;

    metricTotal.textContent = total;
    metricCompleted.textContent = completed;
    metricPending.textContent = pending;

    itemsLeft.textContent = `${pending} ${pending === 1 ? 'item' : 'items'} left`;
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- Traffic Simulation (For Prometheus & Grafana) ---
  async function simulateTraffic(rounds = 25) {
    btnTraffic.disabled = true;
    trafficProgress.classList.add('active');
    trafficProgressFill.style.width = '0%';
    showToast(`Generating ${rounds} requests for Prometheus metrics...`, 'info');

    let completedRequests = 0;
    const tasksToCreate = ['Deploy container', 'Verify Prometheus alert', 'Run smoke tests', 'Update helm chart', 'Backup database'];

    for (let i = 0; i < rounds; i++) {
      try {
        if (i % 3 === 0) {
          // List todos
          await fetch('/todos');
        } else if (i % 3 === 1) {
          // Check health
          await fetch('/health');
        } else {
          // Create a quick simulated task
          const taskTitle = tasksToCreate[Math.floor(Math.random() * tasksToCreate.length)] + ` #${Math.floor(Math.random() * 900 + 100)}`;
          const postRes = await fetch('/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: taskTitle }),
          });
          if (postRes.ok) {
            const created = await postRes.json();
            todos.push(created);
          }
        }
      } catch (err) {
        console.warn('Traffic simulation ping failed:', err);
      }

      completedRequests++;
      trafficProgressFill.style.width = `${Math.round((completedRequests / rounds) * 100)}%`;
      await new Promise(r => setTimeout(r, 60));
    }

    render();
    showToast(`Simulation complete! Check Grafana & Prometheus.`, 'success');
    setTimeout(() => {
      trafficProgress.classList.remove('active');
      trafficProgressFill.style.width = '0%';
      btnTraffic.disabled = false;
    }, 800);
  }

  // --- Event Listeners ---
  todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (!title) return;
    todoInput.value = '';
    await createTodo(title);
    todoInput.focus();
  });

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      render();
    });
  });

  btnTraffic.addEventListener('click', () => simulateTraffic(25));

  // --- Initialization ---
  checkHealth();
  fetchTodos();

  // Periodic health check every 10 seconds
  setInterval(checkHealth, 10000);
});
