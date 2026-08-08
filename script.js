const STORAGE_KEY = 'daily-ledger-todos-v1';

const listEl = document.getElementById('list');
const inputEl = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const prioritySelect = document.getElementById('prioritySelect');
const dueInput = document.getElementById('dueInput');
const filtersEl = document.getElementById('filters');
const countLabel = document.getElementById('countLabel');
const emptyState = document.getElementById('emptyState');
const clearDoneBtn = document.getElementById('clearDone');
const todayDateEl = document.getElementById('todayDate');

let todos = [];
let currentFilter = 'all';
let dragSrcId = null;

// ---- init ----
todayDateEl.textContent = new Date().toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
load();
render();

// ---- storage ----
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    todos = raw ? JSON.parse(raw) : [];
  }catch(e){
    todos = [];
  }
}
function save(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }catch(e){ /* storage unavailable, fail silently */ }
}

// ---- helpers ----
function uid(){
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}
function isOverdue(due, done){
  if(!due || done) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(due + 'T00:00:00');
  return d < today;
}
function formatDue(due){
  const d = new Date(due + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
}
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- CRUD ----
function addTodo(){
  const text = inputEl.value.trim();
  if(!text){ inputEl.focus(); return; }
  todos.unshift({
    id: uid(),
    text,
    done:false,
    priority: prioritySelect.value,
    due: dueInput.value || null,
    createdAt: Date.now()
  });
  inputEl.value = '';
  dueInput.value = '';
  save();
  render();
  inputEl.focus();
}

function toggleDone(id){
  const t = todos.find(t => t.id === id);
  if(t){ t.done = !t.done; save(); render(); }
}

function deleteTodo(id){
  todos = todos.filter(t => t.id !== id);
  save();
  render();
}

function editTodoText(id, newText){
  const t = todos.find(t => t.id === id);
  if(!t) return;
  const clean = newText.trim();
  if(clean){ t.text = clean; } // ignore empty edits, revert on render
  save();
  render();
}

function clearCompleted(){
  todos = todos.filter(t => !t.done);
  save();
  render();
}

function reorder(srcId, targetId){
  const srcIdx = todos.findIndex(t => t.id === srcId);
  const tgtIdx = todos.findIndex(t => t.id === targetId);
  if(srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return;
  const [moved] = todos.splice(srcIdx, 1);
  todos.splice(tgtIdx, 0, moved);
  save();
  render();
}

// ---- render ----
function getFiltered(){
  if(currentFilter === 'active') return todos.filter(t => !t.done);
  if(currentFilter === 'done') return todos.filter(t => t.done);
  return todos;
}

function render(){
  const filtered = getFiltered();
  listEl.innerHTML = '';

  filtered.forEach(t => {
    const li = document.createElement('li');
    li.className = 'todo' + (t.done ? ' done' : '');
    li.draggable = true;
    li.dataset.id = t.id;

    const overdue = isOverdue(t.due, t.done);

    li.innerHTML = `
      <button class="check" aria-label="Toggle complete" data-action="toggle">
        <svg viewBox="0 0 24 24"><polyline points="4,13 9,18 20,6"></polyline></svg>
      </button>
      <div class="todo-body">
        <div class="todo-text" contenteditable="true" spellcheck="false" data-action="edit">${escapeHtml(t.text)}</div>
        <div class="meta-row">
          <span class="tag ${t.priority}">${t.priority}</span>
          ${t.due ? `<span class="due ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue · ' : 'Due '}${formatDue(t.due)}</span>` : ''}
        </div>
      </div>
      <div class="todo-actions">
        <button class="icon-btn delete" title="Delete" data-action="delete">✕</button>
      </div>
    `;
    listEl.appendChild(li);
  });

  emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

  const remaining = todos.filter(t => !t.done).length;
  countLabel.textContent = `${remaining} item${remaining === 1 ? '' : 's'} left`;
}

// ---- events ----
addBtn.addEventListener('click', addTodo);
inputEl.addEventListener('keydown', e => { if(e.key === 'Enter') addTodo(); });

filtersEl.addEventListener('click', e => {
  const btn = e.target.closest('button[data-filter]');
  if(!btn) return;
  currentFilter = btn.dataset.filter;
  [...filtersEl.children].forEach(b => b.classList.toggle('active', b === btn));
  render();
});

clearDoneBtn.addEventListener('click', clearCompleted);

listEl.addEventListener('click', e => {
  const li = e.target.closest('.todo');
  if(!li) return;
  const id = li.dataset.id;
  const action = e.target.closest('[data-action]')?.dataset.action;
  if(action === 'toggle') toggleDone(id);
  if(action === 'delete') deleteTodo(id);
});

listEl.addEventListener('focusout', e => {
  const target = e.target.closest('[data-action="edit"]');
  if(!target) return;
  const li = target.closest('.todo');
  const id = li.dataset.id;
  editTodoText(id, target.textContent);
});

listEl.addEventListener('keydown', e => {
  if(e.target.closest('[data-action="edit"]') && e.key === 'Enter'){
    e.preventDefault();
    e.target.blur();
  }
});

// drag to reorder
listEl.addEventListener('dragstart', e => {
  const li = e.target.closest('.todo');
  if(!li) return;
  dragSrcId = li.dataset.id;
  li.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
});
listEl.addEventListener('dragend', e => {
  const li = e.target.closest('.todo');
  if(li) li.classList.remove('dragging');
});
listEl.addEventListener('dragover', e => {
  e.preventDefault();
});
listEl.addEventListener('drop', e => {
  e.preventDefault();
  const li = e.target.closest('.todo');
  if(!li || !dragSrcId) return;
  const targetId = li.dataset.id;
  reorder(dragSrcId, targetId);
  dragSrcId = null;
});