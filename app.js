const SUPABASE_URL = 'https://boqxzvdpzvypqzzrxjnf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rCa_mjZjbiDctC0ER6l90Q_ZSigMJI_';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AVATAR_COLORS = [
  '#388bfd', '#3fb950', '#f78166', '#d2a8ff',
  '#ffa657', '#79c0ff', '#56d364', '#ff7b72',
];

let allStaff = [];
let deleteTargetId = null;
let currentDept = 'all';

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name) {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase();
}

function renderFilterButtons(staffList) {
  const depts = ['all', ...new Set(staffList.map(s => s.department).filter(Boolean))];
  const filterBar = document.querySelector('.filter-bar');
  filterBar.innerHTML = depts.map(dept => `
    <button class="filter-btn ${dept === currentDept ? 'active' : ''}" data-dept="${dept}">
      ${dept === 'all' ? 'すべて' : dept}
    </button>
  `).join('');
  filterBar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentDept = btn.dataset.dept;
      renderStaff();
    });
  });
}

function renderStaff() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const grid = document.getElementById('staffGrid');

  let filtered = allStaff.filter(s => {
    const matchDept = currentDept === 'all' || s.department === currentDept;
    const matchSearch = !query
      || s.name.toLowerCase().includes(query)
      || (s.department || '').toLowerCase().includes(query);
    return matchDept && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">該当する社員が見つかりません</div>';
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="staff-card" data-id="${s.id}">
      <div class="card-top">
        <div class="avatar" style="background-color: ${getAvatarColor(s.name)}">
          ${getInitial(s.name)}
        </div>
        <div class="card-info">
          <div class="card-name">${escapeHtml(s.name)}</div>
          <div class="card-position">${escapeHtml(s.position || '未設定')}</div>
        </div>
      </div>
      ${s.department ? `<div class="card-dept">${escapeHtml(s.department)}</div>` : ''}
      ${s.bio ? `<div class="card-bio">${escapeHtml(s.bio)}</div>` : ''}
      <div class="card-actions">
        <button class="btn-edit" data-id="${s.id}">編集</button>
        <button class="btn-delete" data-id="${s.id}">削除</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
  });
}

async function fetchStaff() {
  const { data, error } = await db
    .from('staff')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById('staffGrid').innerHTML =
      '<div class="empty-state">データの取得に失敗しました</div>';
    return;
  }

  allStaff = data || [];
  renderFilterButtons(allStaff);
  renderStaff();
}

function openAddModal() {
  document.getElementById('modalTitle').textContent = '社員を追加';
  document.getElementById('staffForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('modalOverlay').classList.add('open');
}

function openEditModal(id) {
  const staff = allStaff.find(s => s.id === id);
  if (!staff) return;
  document.getElementById('modalTitle').textContent = '社員を編集';
  document.getElementById('editId').value = staff.id;
  document.getElementById('inputName').value = staff.name || '';
  document.getElementById('inputDept').value = staff.department || '';
  document.getElementById('inputPosition').value = staff.position || '';
  document.getElementById('inputBio').value = staff.bio || '';
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function openDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById('deleteOverlay').classList.add('open');
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('deleteOverlay').classList.remove('open');
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const payload = {
    name: document.getElementById('inputName').value.trim(),
    department: document.getElementById('inputDept').value.trim() || null,
    position: document.getElementById('inputPosition').value.trim() || null,
    bio: document.getElementById('inputBio').value.trim() || null,
  };

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';

  let error;
  if (id) {
    ({ error } = await db.from('staff').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('staff').insert(payload));
  }

  saveBtn.disabled = false;
  saveBtn.textContent = '保存';

  if (error) {
    alert('保存に失敗しました: ' + error.message);
    return;
  }

  closeModal();
  fetchStaff();
}

async function handleDelete() {
  if (!deleteTargetId) return;
  const { error } = await db.from('staff').delete().eq('id', deleteTargetId);
  if (error) {
    alert('削除に失敗しました: ' + error.message);
    return;
  }
  closeDeleteModal();
  fetchStaff();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.getElementById('openModalBtn').addEventListener('click', openAddModal);
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementById('staffForm').addEventListener('submit', handleSubmit);
document.getElementById('closeDeleteBtn').addEventListener('click', closeDeleteModal);
document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
document.getElementById('confirmDeleteBtn').addEventListener('click', handleDelete);
document.getElementById('searchInput').addEventListener('input', renderStaff);

document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('deleteOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDeleteModal();
});

fetchStaff();
