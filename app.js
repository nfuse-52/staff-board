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
let selectedFile = null;

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name) {
  return name.trim().charAt(0).toUpperCase();
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

  const filtered = allStaff.filter(s => {
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

  grid.innerHTML = filtered.map(s => {
    const avatarHtml = s.avatar_url
      ? `<img class="avatar avatar-img" src="${escapeHtml(s.avatar_url)}" alt="${escapeHtml(s.name)}">`
      : `<div class="avatar" style="background-color:${getAvatarColor(s.name)}">${getInitial(s.name)}</div>`;
    return `
      <div class="staff-card" data-id="${s.id}">
        <div class="card-top">
          ${avatarHtml}
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
    `;
  }).join('');

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

function resetAvatarPreview(existingUrl = null) {
  selectedFile = null;
  const img = document.getElementById('avatarPreviewImg');
  const text = document.getElementById('avatarPreviewText');
  const upload = document.getElementById('avatarUpload');

  if (existingUrl) {
    img.src = existingUrl;
    img.style.display = 'block';
    text.style.display = 'none';
    upload.classList.add('has-image');
  } else {
    img.src = '';
    img.style.display = 'none';
    text.style.display = 'block';
    upload.classList.remove('has-image');
  }
  document.getElementById('inputAvatar').value = '';
}

function openAddModal() {
  document.getElementById('modalTitle').textContent = '社員を追加';
  document.getElementById('staffForm').reset();
  document.getElementById('editId').value = '';
  resetAvatarPreview();
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
  resetAvatarPreview(staff.avatar_url || null);
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  selectedFile = null;
}

function openDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById('deleteOverlay').classList.add('open');
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('deleteOverlay').classList.remove('open');
}

async function uploadAvatar(file) {
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await db.storage.from('avatars').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = db.storage.from('avatars').getPublicUrl(fileName);
  return data.publicUrl;
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';

  try {
    let avatarUrl = null;

    if (selectedFile) {
      avatarUrl = await uploadAvatar(selectedFile);
    } else if (id) {
      const existing = allStaff.find(s => s.id === id);
      avatarUrl = existing?.avatar_url || null;
    }

    const payload = {
      name: document.getElementById('inputName').value.trim(),
      department: document.getElementById('inputDept').value.trim() || null,
      position: document.getElementById('inputPosition').value.trim() || null,
      bio: document.getElementById('inputBio').value.trim() || null,
      avatar_url: avatarUrl,
    };

    let error;
    if (id) {
      ({ error } = await db.from('staff').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('staff').insert(payload));
    }

    if (error) throw error;

    closeModal();
    fetchStaff();
  } catch (err) {
    alert('保存に失敗しました: ' + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '保存';
  }
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

/* 画像アップロード UI */
const avatarUpload = document.getElementById('avatarUpload');
const inputAvatar = document.getElementById('inputAvatar');

avatarUpload.addEventListener('click', () => inputAvatar.click());

avatarUpload.addEventListener('dragover', e => {
  e.preventDefault();
  avatarUpload.classList.add('drag-over');
});
avatarUpload.addEventListener('dragleave', () => avatarUpload.classList.remove('drag-over'));
avatarUpload.addEventListener('drop', e => {
  e.preventDefault();
  avatarUpload.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
});

inputAvatar.addEventListener('change', () => {
  if (inputAvatar.files[0]) handleFileSelect(inputAvatar.files[0]);
});

function handleFileSelect(file) {
  if (file.size > 5 * 1024 * 1024) {
    alert('ファイルサイズは5MB以内にしてください');
    return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById('avatarPreviewImg');
    const text = document.getElementById('avatarPreviewText');
    img.src = ev.target.result;
    img.style.display = 'block';
    text.style.display = 'none';
    avatarUpload.classList.add('has-image');
  };
  reader.readAsDataURL(file);
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
