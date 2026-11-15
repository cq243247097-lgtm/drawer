(() => {
  const api = window.notesApi;

  let state = {
    version: 1,
    theme: 'light',
    selectedCategoryId: null,
    selectedProjectId: null,
    categories: []
  };

  let editingTarget = null; // { type: 'category'|'project'|'entry'|'header-project', id: string }
  let highlightedEntryId = null;
  let selectedFileId = null;
  let dragState = null; // { type: 'category'|'project'|'entry', id: string }
  let contextTarget = null; // { type: 'category'|'project'|'file', id: string }
  let searchResultsData = [];
  let searchSelectedIndex = 0;
  let saveTimer = null;
  let toastTimer = null;

  // DOM references
  const saveStatusEl = document.getElementById('saveStatus');
  const openSearchBtn = document.getElementById('openSearchBtn');
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIconSun = document.getElementById('themeIconSun');
  const themeIconMoon = document.getElementById('themeIconMoon');

  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const categoryQuickAdd = document.getElementById('categoryQuickAdd');
  const categoryQuickInput = document.getElementById('categoryQuickInput');
  const categoryListEl = document.getElementById('categoryList');

  const projectPaneTitle = document.getElementById('projectPaneTitle');
  const addProjectBtn = document.getElementById('addProjectBtn');
  const projectQuickAdd = document.getElementById('projectQuickAdd');
  const projectQuickInput = document.getElementById('projectQuickInput');
  const projectListEl = document.getElementById('projectList');

  const contentPane = document.getElementById('contentPane');
  const contentHeader = document.getElementById('contentHeader');
  const activeProjectTitle = document.getElementById('activeProjectTitle');
  const addFileBtn = document.getElementById('addFileBtn');
  const addEntryBtn = document.getElementById('addEntryBtn');
  const contentBody = document.getElementById('contentBody');

  const searchModal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput');
  const searchResultsEl = document.getElementById('searchResults');

  const confirmModal = document.getElementById('confirmModal');
  const confirmTitle = document.getElementById('confirmTitle');
  const confirmMessage = document.getElementById('confirmMessage');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmOkBtn = document.getElementById('confirmOkBtn');

  const contextMenu = document.getElementById('contextMenu');
  const ctxCopyFileBtn = document.getElementById('ctxCopyFileBtn');
  const ctxOpenFolderBtn = document.getElementById('ctxOpenFolderBtn');
  const ctxRenameBtn = document.getElementById('ctxRenameBtn');
  const ctxDeleteBtn = document.getElementById('ctxDeleteBtn');

  const toastEl = document.getElementById('toast');

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function getSelectedCategory() {
    return state.categories.find((c) => c.id === state.selectedCategoryId) || null;
  }

  function getSelectedProject() {
    const cat = getSelectedCategory();
    if (!cat) return null;
    return cat.projects.find((p) => p.id === state.selectedProjectId) || null;
  }

  function ensureValidSelection() {
    if (!state.categories.length) {
      state.selectedCategoryId = null;
      state.selectedProjectId = null;
      return;
    }
    let cat = getSelectedCategory();
    if (!cat) {
      cat = state.categories[0];
      state.selectedCategoryId = cat.id;
    }
    if (!cat.projects.length) {
      state.selectedProjectId = null;
      return;
    }
    if (!cat.projects.some((p) => p.id === state.selectedProjectId)) {
      state.selectedProjectId = cat.projects[0].id;
    }
  }

  function scheduleSave() {
    saveStatusEl.textContent = '保存中...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await api.save(state);
        saveStatusEl.textContent = '已自动保存';
      } catch {
        saveStatusEl.textContent = '保存失败';
        showToast('本地保存失败，请检查磁盘权限');
      }
    }, 120);
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2400);
  }

  function showConfirm(title, message, okText = '删除') {
    return new Promise((resolve) => {
      confirmTitle.textContent = title;
      confirmMessage.textContent = message;
      confirmOkBtn.textContent = okText;
      confirmModal.classList.remove('hidden');

      const cleanup = (result) => {
        confirmModal.classList.add('hidden');
        confirmCancelBtn.removeEventListener('click', onCancel);
        confirmOkBtn.removeEventListener('click', onOk);
        confirmModal.removeEventListener('click', onBackdrop);
        resolve(result);
      };

      const onCancel = () => cleanup(false);
      const onOk = () => cleanup(true);
      const onBackdrop = (e) => {
        if (e.target === confirmModal) cleanup(false);
      };

      confirmCancelBtn.addEventListener('click', onCancel);
      confirmOkBtn.addEventListener('click', onOk);
      confirmModal.addEventListener('click', onBackdrop);
    });
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    themeIconSun.classList.toggle('hidden', isDark);
    themeIconMoon.classList.toggle('hidden', !isDark);
    api.setTitleBarTheme(isDark ? 'dark' : 'light');
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function createSvgIcon(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '13');
    svg.setAttribute('height', '13');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    if (type === 'grip') {
      const pts = [
        [9, 5], [9, 12], [9, 19],
        [15, 5], [15, 12], [15, 19]
      ];
      pts.forEach(([cx, cy]) => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', String(cx));
        c.setAttribute('cy', String(cy));
        c.setAttribute('r', '1');
        c.setAttribute('fill', 'currentColor');
        svg.appendChild(c);
      });
    } else if (type === 'edit') {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z');
      svg.appendChild(p);
    } else if (type === 'trash') {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6');
      svg.appendChild(p);
    }
    return svg;
  }

  function attachDragHandlers(el, type, id, onReorder) {
    el.setAttribute('draggable', 'true');

    el.addEventListener('dragstart', (e) => {
      if (editingTarget && editingTarget.id === id) {
        e.preventDefault();
        return;
      }
      dragState = { type, id };
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    });

    el.addEventListener('dragend', () => {
      dragState = null;
      el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
      document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-target').forEach((node) => {
        node.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-target');
      });
    });

    el.addEventListener('dragover', (e) => {
      if (!dragState || dragState.type !== type || dragState.id === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = el.getBoundingClientRect();
      const isTop = e.clientY - rect.top < rect.height / 2;
      el.classList.toggle('drag-over-top', isTop);
      el.classList.toggle('drag-over-bottom', !isTop);
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    el.addEventListener('drop', (e) => {
      if (!dragState || dragState.type !== type || dragState.id === id) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const insertBefore = e.clientY - rect.top < rect.height / 2;
      const sourceId = dragState.id;
      dragState = null;
      el.classList.remove('drag-over-top', 'drag-over-bottom');
      onReorder(sourceId, id, insertBefore);
    });
  }

  function reorderArray(arr, sourceId, targetId, insertBefore) {
    const fromIdx = arr.findIndex((item) => item.id === sourceId);
    if (fromIdx === -1) return false;
    const [moved] = arr.splice(fromIdx, 1);
    let toIdx = arr.findIndex((item) => item.id === targetId);
    if (toIdx === -1) {
      arr.push(moved);
      return true;
    }
    if (!insertBefore) toIdx += 1;
    arr.splice(toIdx, 0, moved);
    return true;
  }

  function moveProjectToCategory(projectId, targetCategoryId) {
    const srcCat = state.categories.find((c) => c.projects.some((p) => p.id === projectId));
    const targetCat = state.categories.find((c) => c.id === targetCategoryId);
    if (!srcCat || !targetCat || srcCat.id === targetCat.id) return false;

    const projIdx = srcCat.projects.findIndex((p) => p.id === projectId);
    if (projIdx === -1) return false;

    const [movedProj] = srcCat.projects.splice(projIdx, 1);
    targetCat.projects.push(movedProj);

    if (state.selectedProjectId === movedProj.id) {
      state.selectedProjectId = srcCat.projects[0]?.id || null;
      selectedFileId = null;
    }
    editingTarget = null;
    dragState = null;
    scheduleSave();
    renderAll();
    showToast(`已将项目“${movedProj.name}”移至分类“${targetCat.name}”`);
    return true;
  }

  // 渲染分类栏
  function renderCategories() {
    categoryListEl.innerHTML = '';

    if (!state.categories.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<p>暂无分类</p><p>点击右上角 + 新增分类</p>';
      categoryListEl.appendChild(empty);
      return;
    }

    state.categories.forEach((cat) => {
      const li = document.createElement('li');
      li.className = 'list-item';
      if (cat.id === state.selectedCategoryId) li.classList.add('active');
      li.dataset.id = cat.id;

      const grip = document.createElement('span');
      grip.className = 'drag-handle';
      grip.appendChild(createSvgIcon('grip'));
      li.appendChild(grip);

      if (editingTarget && editingTarget.type === 'category' && editingTarget.id === cat.id) {
        const input = document.createElement('input');
        input.className = 'inline-rename-input';
        input.value = cat.name;
        input.maxLength = 40;
        li.appendChild(input);

        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });

        const commit = () => {
          const next = input.value.trim();
          if (next && next !== cat.name) {
            cat.name = next;
            scheduleSave();
          }
          editingTarget = null;
          renderAll();
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          } else if (e.key === 'Escape') {
            editingTarget = null;
            renderAll();
          }
        });
      } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = cat.name;
        nameSpan.title = '双击重命名';
        li.appendChild(nameSpan);

        const badge = document.createElement('span');
        badge.className = 'item-badge';
        badge.textContent = String(cat.projects.length);
        li.appendChild(badge);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'mini-btn';
        renameBtn.type = 'button';
        renameBtn.title = '重命名';
        renameBtn.appendChild(createSvgIcon('edit'));
        renameBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          editingTarget = { type: 'category', id: cat.id };
          renderCategories();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'mini-btn danger';
        deleteBtn.type = 'button';
        deleteBtn.title = '删除分类';
        deleteBtn.appendChild(createSvgIcon('trash'));
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteCategory(cat.id);
        });

        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);
        li.appendChild(actions);

        li.addEventListener('click', () => {
          if (state.selectedCategoryId !== cat.id) {
            state.selectedCategoryId = cat.id;
            state.selectedProjectId = cat.projects[0]?.id || null;
            editingTarget = null;
            scheduleSave();
            renderAll();
          }
        });

        li.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          editingTarget = { type: 'category', id: cat.id };
          renderCategories();
        });

        li.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          openContextMenu(e.clientX, e.clientY, 'category', cat.id);
        });

        attachDragHandlers(li, 'category', cat.id, (srcId, tgtId, before) => {
          if (reorderArray(state.categories, srcId, tgtId, before)) {
            scheduleSave();
            renderCategories();
          }
        });

        li.addEventListener('dragover', (e) => {
          if (!dragState || dragState.type !== 'project') return;
          if (cat.id === state.selectedCategoryId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          li.classList.add('drag-over-target');
        });

        li.addEventListener('dragleave', (e) => {
          if (e.relatedTarget && li.contains(e.relatedTarget)) return;
          li.classList.remove('drag-over-target');
        });

        li.addEventListener('drop', (e) => {
          if (!dragState || dragState.type !== 'project') return;
          e.preventDefault();
          li.classList.remove('drag-over-target');
          if (cat.id !== state.selectedCategoryId) {
            moveProjectToCategory(dragState.id, cat.id);
          }
        });
      }

      categoryListEl.appendChild(li);
    });
  }

  // 渲染第一列：项目列表
  function renderProjects() {
    const cat = getSelectedCategory();
    projectPaneTitle.textContent = cat ? `${cat.name} · 项目` : '项目';
    addProjectBtn.disabled = !cat;
    projectListEl.innerHTML = '';

    if (!cat) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<p>请先在左侧选择或新增一个分类</p>';
      projectListEl.appendChild(empty);
      return;
    }

    if (!cat.projects.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<p>该分类下暂无项目</p><p>点击右上角 + 新增项目</p>';
      projectListEl.appendChild(empty);
      return;
    }

    cat.projects.forEach((proj) => {
      const li = document.createElement('li');
      li.className = 'list-item';
      if (proj.id === state.selectedProjectId) li.classList.add('active');
      li.dataset.id = proj.id;

      const grip = document.createElement('span');
      grip.className = 'drag-handle';
      grip.appendChild(createSvgIcon('grip'));
      li.appendChild(grip);

      if (editingTarget && editingTarget.type === 'project' && editingTarget.id === proj.id) {
        const input = document.createElement('input');
        input.className = 'inline-rename-input';
        input.value = proj.name;
        input.maxLength = 60;
        li.appendChild(input);

        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });

        const commit = () => {
          const next = input.value.trim();
          if (next && next !== proj.name) {
            proj.name = next;
            scheduleSave();
          }
          editingTarget = null;
          renderAll();
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          } else if (e.key === 'Escape') {
            editingTarget = null;
            renderAll();
          }
        });
      } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = proj.name;
        nameSpan.title = '双击重命名';
        li.appendChild(nameSpan);

        const badge = document.createElement('span');
        badge.className = 'item-badge';
        const totalCount = (Array.isArray(proj.entries) ? proj.entries.length : 0) + (Array.isArray(proj.files) ? proj.files.length : 0);
        badge.textContent = `${totalCount} 条`;
        li.appendChild(badge);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'mini-btn';
        renameBtn.type = 'button';
        renameBtn.title = '重命名';
        renameBtn.appendChild(createSvgIcon('edit'));
        renameBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          editingTarget = { type: 'project', id: proj.id };
          renderProjects();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'mini-btn danger';
        deleteBtn.type = 'button';
        deleteBtn.title = '删除项目';
        deleteBtn.appendChild(createSvgIcon('trash'));
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteProject(cat.id, proj.id);
        });

        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);
        li.appendChild(actions);

        li.addEventListener('click', () => {
          if (state.selectedProjectId !== proj.id) {
            state.selectedProjectId = proj.id;
            editingTarget = null;
            scheduleSave();
            renderAll();
          }
        });

        li.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          editingTarget = { type: 'project', id: proj.id };
          renderProjects();
        });

        li.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          openContextMenu(e.clientX, e.clientY, 'project', proj.id);
        });

        attachDragHandlers(li, 'project', proj.id, (srcId, tgtId, before) => {
          if (reorderArray(cat.projects, srcId, tgtId, before)) {
            scheduleSave();
            renderProjects();
          }
        });
      }

      projectListEl.appendChild(li);
    });
  }

  // 渲染第二列：关联内容
  function renderContent() {
    const proj = getSelectedProject();
    contentBody.innerHTML = '';

    if (!proj) {
      contentHeader.classList.add('hidden');
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<p>选择或新建一个项目开始记录</p>';
      contentBody.appendChild(empty);
      return;
    }

    contentHeader.classList.remove('hidden');

    // 标题区域（支持双击重命名）
    const titleWrap = activeProjectTitle.parentElement;
    if (editingTarget && editingTarget.type === 'header-project' && editingTarget.id === proj.id) {
      activeProjectTitle.classList.add('hidden');
      const existingInput = titleWrap.querySelector('.inline-rename-input');
      if (existingInput) existingInput.remove();

      const input = document.createElement('input');
      input.className = 'inline-rename-input';
      input.value = proj.name;
      input.maxLength = 60;
      titleWrap.appendChild(input);

      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });

      const commit = () => {
        const next = input.value.trim();
        if (next && next !== proj.name) {
          proj.name = next;
          scheduleSave();
        }
        editingTarget = null;
        input.remove();
        activeProjectTitle.classList.remove('hidden');
        renderAll();
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        } else if (e.key === 'Escape') {
          editingTarget = null;
          input.remove();
          activeProjectTitle.classList.remove('hidden');
          renderAll();
        }
      });
    } else {
      const existingInput = titleWrap.querySelector('.inline-rename-input');
      if (existingInput) existingInput.remove();
      activeProjectTitle.classList.remove('hidden');
      activeProjectTitle.textContent = proj.name;
    }

    renderEntries(proj);
  }

  function createAndEditEntry(proj) {
    const newEntry = {
      id: uid('entry'),
      text: '',
      updatedAt: Date.now(),
      _isNew: true
    };
    proj.entries.push(newEntry);
    editingTarget = { type: 'entry', id: newEntry.id };
    renderProjects();
    renderContent();
    requestAnimationFrame(() => {
      contentBody.scrollTop = contentBody.scrollHeight;
    });
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function ensureProjectFiles(proj) {
    if (!Array.isArray(proj.files)) {
      proj.files = [];
    }
    return proj.files;
  }

  async function addFilesToProject(proj, rawPaths) {
    if (!proj || !rawPaths || !rawPaths.length) return;
    const files = ensureProjectFiles(proj);
    let addedCount = 0;
    let lastId = null;

    for (const filePath of rawPaths) {
      if (!filePath) continue;
      const existing = files.find((f) => f.path.toLowerCase() === filePath.toLowerCase());
      if (existing) {
        lastId = existing.id;
        continue;
      }
      const info = await api.getFileInfo(filePath);
      const item = {
        id: uid('file'),
        name: info?.name || filePath.split(/[\\/]/).pop() || filePath,
        path: filePath,
        ext: info?.ext || 'FILE',
        addedAt: Date.now()
      };
      files.push(item);
      lastId = item.id;
      addedCount += 1;
    }

    if (lastId) {
      selectedFileId = lastId;
    }
    if (addedCount > 0) {
      scheduleSave();
      showToast(`已关联 ${addedCount} 个文件（保留在原位置）`);
    } else if (lastId) {
      showToast('该文件已在当前项目中');
    }
    renderProjects();
    renderContent();
  }

  async function copyFileItem(fileItem, btnEl) {
    const res = await api.copyFileToClipboard(fileItem.path);
    if (res?.ok) {
      if (btnEl) {
        btnEl.textContent = '已复制';
        btnEl.classList.add('copied');
        setTimeout(() => {
          btnEl.textContent = '复制';
          btnEl.classList.remove('copied');
        }, 1400);
      }
      showToast(`已复制文件“${fileItem.name}”，可直接在微信中 Ctrl+V 发送`);
    } else {
      showToast(res?.error || '复制文件失败');
    }
  }

  function renderEntries(proj) {
    const files = ensureProjectFiles(proj);
    if (!proj.entries.length && !files.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<p>暂无内容</p><p>点击右上角“新增条目”或双击此处开始记录，也可直接拖入本地文件</p>';
      empty.addEventListener('dblclick', () => createAndEditEntry(proj));
      contentBody.appendChild(empty);
      return;
    }

    if (!proj.entries.length) {
      renderProjectFiles(proj);
      return;
    }

    const list = document.createElement('div');
    list.className = 'entries-list';

    proj.entries.forEach((entry) => {
      const isEditing = editingTarget && editingTarget.type === 'entry' && editingTarget.id === entry.id;
      const card = document.createElement('div');
      card.className = 'entry-card' + (isEditing ? ' editing' : '');
      if (highlightedEntryId === entry.id) {
        card.classList.add('highlighted');
      }
      card.dataset.id = entry.id;

      const drag = document.createElement('span');
      drag.className = 'drag-handle entry-drag';
      drag.appendChild(createSvgIcon('grip'));
      card.appendChild(drag);

      const main = document.createElement('div');
      main.className = 'entry-main';

      if (isEditing) {
        const textarea = document.createElement('textarea');
        textarea.className = 'entry-editor';
        textarea.value = entry.text;
        textarea.placeholder = '输入纯文本内容...';
        main.appendChild(textarea);

        const autoResize = () => {
          textarea.style.height = 'auto';
          textarea.style.height = `${Math.max(76, textarea.scrollHeight + 4)}px`;
        };
        requestAnimationFrame(() => {
          autoResize();
          textarea.focus();
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        });
        textarea.addEventListener('input', autoResize);

        let canceled = false;
        const commit = () => {
          if (canceled) return;
          const nextText = textarea.value;
          if (!nextText.trim() && entry._isNew) {
            proj.entries = proj.entries.filter((item) => item.id !== entry.id);
            scheduleSave();
          } else if (nextText !== entry.text || entry._isNew) {
            entry.text = nextText;
            entry.updatedAt = Date.now();
            delete entry._isNew;
            scheduleSave();
          }
          editingTarget = null;
          renderProjects();
          renderContent();
        };

        textarea.addEventListener('blur', commit);
        textarea.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            textarea.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            canceled = true;
            if (entry._isNew && !entry.text.trim()) {
              proj.entries = proj.entries.filter((item) => item.id !== entry.id);
              scheduleSave();
            }
            editingTarget = null;
            renderProjects();
            renderContent();
          }
        });
      } else {
        const textEl = document.createElement('div');
        textEl.className = 'entry-text' + (!entry.text ? ' placeholder' : '');
        textEl.textContent = entry.text || '（空条目，双击编辑）';
        textEl.addEventListener('dblclick', () => {
          editingTarget = { type: 'entry', id: entry.id };
          renderContent();
        });
        main.appendChild(textEl);
      }

      const meta = document.createElement('div');
      meta.className = 'entry-meta';
      const timeSpan = document.createElement('span');
      timeSpan.textContent = isEditing ? 'Ctrl+Enter 或失焦保存 · Esc 取消' : `更新于 ${formatTime(entry.updatedAt)}`;
      meta.appendChild(timeSpan);
      main.appendChild(meta);

      card.appendChild(main);

      const actions = document.createElement('div');
      actions.className = 'entry-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'entry-copy-btn';
      copyBtn.type = 'button';
      copyBtn.textContent = '复制';
      copyBtn.title = '复制该条纯文本内容';
      copyBtn.addEventListener('mousedown', (e) => e.preventDefault());
      copyBtn.addEventListener('click', async () => {
        const textToCopy = isEditing
          ? (card.querySelector('.entry-editor')?.value ?? entry.text)
          : entry.text;
        if (!textToCopy) {
          showToast('当前条目内容为空');
          return;
        }
        try {
          await navigator.clipboard.writeText(textToCopy);
          copyBtn.textContent = '已复制';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = '复制';
            copyBtn.classList.remove('copied');
          }, 1400);
          showToast('已复制文本内容');
        } catch {
          showToast('复制失败');
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'mini-btn danger';
      deleteBtn.type = 'button';
      deleteBtn.title = '删除条目';
      deleteBtn.appendChild(createSvgIcon('trash'));
      deleteBtn.addEventListener('mousedown', (e) => e.preventDefault());
      deleteBtn.addEventListener('click', () => {
        proj.entries = proj.entries.filter((item) => item.id !== entry.id);
        if (editingTarget && editingTarget.id === entry.id) {
          editingTarget = null;
        }
        scheduleSave();
        renderProjects();
        renderContent();
      });

      actions.appendChild(copyBtn);
      actions.appendChild(deleteBtn);
      card.appendChild(actions);

      if (!isEditing) {
        attachDragHandlers(card, 'entry', entry.id, (srcId, tgtId, before) => {
          if (reorderArray(proj.entries, srcId, tgtId, before)) {
            scheduleSave();
            renderContent();
          }
        });
      }

      list.appendChild(card);

      if (highlightedEntryId === entry.id) {
        requestAnimationFrame(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    });

    contentBody.appendChild(list);
    if (files.length) {
      renderProjectFiles(proj);
    }
  }

  function renderProjectFiles(proj) {
    const files = ensureProjectFiles(proj);
    if (!files.length) return;

    if (selectedFileId && !files.some((f) => f.id === selectedFileId)) {
      selectedFileId = null;
    }

    const section = document.createElement('div');
    section.className = 'project-files-section';

    const header = document.createElement('div');
    header.className = 'files-section-header';
    const title = document.createElement('span');
    title.className = 'files-section-title';
    title.textContent = `关联文件（${files.length}）`;
    const hint = document.createElement('span');
    hint.className = 'files-section-hint';
    hint.textContent = '文件保存在原路径 · 点击查看盘符目录 · 点“复制”可粘贴到微信';
    header.appendChild(title);
    header.appendChild(hint);
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'files-grid';

    files.forEach((fileItem) => {
      const unit = document.createElement('div');
      unit.className = 'file-unit';

      const tile = document.createElement('div');
      tile.className = 'file-tile' + (selectedFileId === fileItem.id ? ' selected' : '');
      tile.title = `${fileItem.name}\n${fileItem.path}`;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-remove-btn';
      removeBtn.type = 'button';
      removeBtn.title = '从项目中移除关联（不删除原文件）';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        proj.files = proj.files.filter((f) => f.id !== fileItem.id);
        if (selectedFileId === fileItem.id) {
          selectedFileId = null;
        }
        scheduleSave();
        renderProjects();
        renderContent();
      });

      const badge = document.createElement('span');
      badge.className = 'file-ext-badge';
      badge.textContent = fileItem.ext || 'FILE';

      const nameEl = document.createElement('span');
      nameEl.className = 'file-tile-name';
      nameEl.textContent = fileItem.name;

      tile.appendChild(removeBtn);
      tile.appendChild(badge);
      tile.appendChild(nameEl);

      tile.addEventListener('click', () => {
        selectedFileId = fileItem.id;
        renderContent();
      });

      tile.addEventListener('dblclick', () => {
        api.showFileInFolder(fileItem.path);
      });

      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedFileId = fileItem.id;
        openContextMenu(e.clientX, e.clientY, 'file', fileItem.id);
      });

      const copyBtn = document.createElement('button');
      copyBtn.className = 'file-copy-btn';
      copyBtn.type = 'button';
      copyBtn.textContent = '复制';
      copyBtn.title = '复制该文件（可直接在微信粘贴发送）';
      copyBtn.addEventListener('click', () => copyFileItem(fileItem, copyBtn));

      unit.appendChild(tile);
      unit.appendChild(copyBtn);
      grid.appendChild(unit);
    });

    section.appendChild(grid);

    const selectedFile = files.find((f) => f.id === selectedFileId);
    if (selectedFile) {
      const infoPanel = document.createElement('div');
      infoPanel.className = 'file-info-panel';
      infoPanel.innerHTML = '<div class="file-info-row"><span class="file-info-label">正在读取</span><span class="file-info-val">加载文件信息...</span></div>';
      section.appendChild(infoPanel);
      renderFileInfoPanel(infoPanel, selectedFile);
    }

    contentBody.appendChild(section);
  }

  async function renderFileInfoPanel(panel, fileItem) {
    const info = await api.getFileInfo(fileItem.path);
    if (!panel.isConnected) return;

    panel.innerHTML = '';

    const top = document.createElement('div');
    top.className = 'file-info-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'file-info-name';
    nameEl.textContent = info.name || fileItem.name;

    const actions = document.createElement('div');
    actions.className = 'file-info-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'file-info-btn';
    copyBtn.type = 'button';
    copyBtn.textContent = '复制文件';
    copyBtn.addEventListener('click', () => copyFileItem(fileItem));

    const openDirBtn = document.createElement('button');
    openDirBtn.className = 'file-info-btn';
    openDirBtn.type = 'button';
    openDirBtn.textContent = '打开所在目录';
    openDirBtn.addEventListener('click', async () => {
      const res = await api.showFileInFolder(fileItem.path);
      if (res && res.ok === false) {
        showToast(res.error || '原目录不存在');
      }
    });

    actions.appendChild(copyBtn);
    actions.appendChild(openDirBtn);
    top.appendChild(nameEl);
    top.appendChild(actions);
    panel.appendChild(top);

    const addRow = (label, value, extraClass = '') => {
      const row = document.createElement('div');
      row.className = 'file-info-row';
      const labelEl = document.createElement('span');
      labelEl.className = 'file-info-label';
      labelEl.textContent = label;
      const valEl = document.createElement('span');
      valEl.className = 'file-info-val' + (extraClass ? ` ${extraClass}` : '');
      valEl.textContent = value;
      row.appendChild(labelEl);
      row.appendChild(valEl);
      panel.appendChild(row);
    };

    addRow('当前盘符', info.drive || '未知', 'drive-pill');
    addRow('所在目录', info.dir || '-');
    addRow('完整路径', info.path || fileItem.path);
    if (info.exists) {
      addRow('文件大小', `${formatFileSize(info.size)} · 修改于 ${formatTime(info.mtime)}`);
    } else {
      addRow('文件状态', '原位置未找到该文件（可能已被移动、重命名或删除）', 'missing-warn');
    }
  }

  function renderAll() {
    ensureValidSelection();
    renderCategories();
    renderProjects();
    renderContent();
  }

  // 删除分类 / 项目
  async function deleteCategory(categoryId) {
    const cat = state.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    if (cat.projects.length > 0) {
      const ok = await showConfirm('删除分类', `确定要删除分类“${cat.name}”及其下 ${cat.projects.length} 个项目吗？此操作不可撤销。`);
      if (!ok) return;
    }
    state.categories = state.categories.filter((c) => c.id !== categoryId);
    ensureValidSelection();
    scheduleSave();
    renderAll();
  }

  async function deleteProject(categoryId, projectId) {
    const cat = state.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const proj = cat.projects.find((p) => p.id === projectId);
    if (!proj) return;

    const hasContent = proj.entries.some((e) => e.text.trim().length > 0) || (proj.files && proj.files.length > 0);
    if (hasContent) {
      const ok = await showConfirm('删除项目', `确定要删除项目“${proj.name}”及其中的所有内容吗？此操作不可撤销。`);
      if (!ok) return;
    }

    cat.projects = cat.projects.filter((p) => p.id !== projectId);
    ensureValidSelection();
    scheduleSave();
    renderAll();
  }

  // 右键菜单
  function openContextMenu(x, y, type, id) {
    contextTarget = { type, id };
    const isFile = type === 'file';
    ctxCopyFileBtn.classList.toggle('hidden', !isFile);
    ctxOpenFolderBtn.classList.toggle('hidden', !isFile);
    ctxRenameBtn.classList.toggle('hidden', isFile);
    ctxDeleteBtn.textContent = isFile ? '从项目中移除' : '删除';
    contextMenu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
    contextMenu.style.top = `${Math.min(y, window.innerHeight - 140)}px`;
    contextMenu.classList.remove('hidden');
  }

  function closeContextMenu() {
    contextMenu.classList.add('hidden');
    contextTarget = null;
  }

  // Ctrl+F 全局快速搜索
  function openSearchModal() {
    searchModal.classList.remove('hidden');
    searchInput.value = '';
    searchSelectedIndex = 0;
    updateSearchResults('');
    requestAnimationFrame(() => searchInput.focus());
  }

  function closeSearchModal() {
    searchModal.classList.add('hidden');
  }

  function buildHighlightedFragment(text, query) {
    const frag = document.createDocumentFragment();
    if (!query) {
      frag.appendChild(document.createTextNode(text));
      return frag;
    }
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let idx = 0;
    while (idx < text.length) {
      const matchIdx = lowerText.indexOf(lowerQuery, idx);
      if (matchIdx === -1) {
        frag.appendChild(document.createTextNode(text.slice(idx)));
        break;
      }
      if (matchIdx > idx) {
        frag.appendChild(document.createTextNode(text.slice(idx, matchIdx)));
      }
      const mark = document.createElement('mark');
      mark.textContent = text.slice(matchIdx, matchIdx + query.length);
      frag.appendChild(mark);
      idx = matchIdx + query.length;
    }
    return frag;
  }

  function updateSearchResults(rawQuery) {
    const query = rawQuery.trim();
    const lower = query.toLowerCase();
    const results = [];

    state.categories.forEach((cat) => {
      if (!lower || cat.name.toLowerCase().includes(lower)) {
        results.push({
          kind: '分类',
          categoryId: cat.id,
          projectId: cat.projects[0]?.id || null,
          entryId: null,
          breadcrumb: cat.name,
          text: cat.name
        });
      }

      cat.projects.forEach((proj) => {
        if (!lower || proj.name.toLowerCase().includes(lower)) {
          results.push({
            kind: '项目',
            categoryId: cat.id,
            projectId: proj.id,
            entryId: null,
            breadcrumb: `${cat.name} › ${proj.name}`,
            text: proj.name
          });
        }

        proj.entries.forEach((entry) => {
          if (lower && entry.text.toLowerCase().includes(lower)) {
            const firstLine = entry.text.replace(/\s+/g, ' ').trim();
            results.push({
              kind: '条目',
              categoryId: cat.id,
              projectId: proj.id,
              entryId: entry.id,
              breadcrumb: `${cat.name} › ${proj.name}`,
              text: firstLine
            });
          }
        });

        if (Array.isArray(proj.files)) {
          proj.files.forEach((fileItem) => {
            if (lower && (fileItem.name.toLowerCase().includes(lower) || fileItem.path.toLowerCase().includes(lower))) {
              results.push({
                kind: '文件',
                categoryId: cat.id,
                projectId: proj.id,
                entryId: null,
                fileId: fileItem.id,
                breadcrumb: `${cat.name} › ${proj.name}`,
                text: `${fileItem.name} (${fileItem.path})`
              });
            }
          });
        }
      });
    });

    searchResultsData = results.slice(0, 50);
    searchSelectedIndex = 0;
    renderSearchResults(query);
  }

  function renderSearchResults(query) {
    searchResultsEl.innerHTML = '';

    if (!searchResultsData.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.minHeight = '100px';
      empty.innerHTML = '<p>没有找到匹配的分类、项目或内容</p>';
      searchResultsEl.appendChild(empty);
      return;
    }

    searchResultsData.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'search-result-item' + (index === searchSelectedIndex ? ' selected' : '');

      const top = document.createElement('div');
      top.className = 'search-result-top';

      const tag = document.createElement('span');
      tag.className = 'search-tag';
      tag.textContent = item.kind;

      const bc = document.createElement('span');
      bc.className = 'search-breadcrumb';
      bc.textContent = item.breadcrumb;

      top.appendChild(tag);
      top.appendChild(bc);

      const snippet = document.createElement('div');
      snippet.className = 'search-snippet';
      snippet.appendChild(buildHighlightedFragment(item.text, query));

      row.appendChild(top);
      row.appendChild(snippet);

      row.addEventListener('click', () => selectSearchResult(item));
      searchResultsEl.appendChild(row);
    });
  }

  function selectSearchResult(item) {
    state.selectedCategoryId = item.categoryId;
    state.selectedProjectId = item.projectId;
    highlightedEntryId = item.entryId;
    selectedFileId = item.fileId || null;
    editingTarget = null;
    closeSearchModal();
    scheduleSave();
    renderAll();

    if (highlightedEntryId) {
      setTimeout(() => {
        highlightedEntryId = null;
        document.querySelectorAll('.entry-card.highlighted').forEach((el) => {
          el.classList.remove('highlighted');
        });
      }, 1800);
    }
  }

  // 绑定事件
  function bindEvents() {
    let cancelQuickCategory = false;
    let cancelQuickProject = false;

    const commitQuickCategory = () => {
      if (cancelQuickCategory) {
        cancelQuickCategory = false;
        return;
      }
      if (categoryQuickAdd.classList.contains('hidden')) return;
      const name = categoryQuickInput.value.trim();
      categoryQuickInput.value = '';
      categoryQuickAdd.classList.add('hidden');
      if (!name) return;
      const newCat = { id: uid('cat'), name, projects: [] };
      state.categories.push(newCat);
      state.selectedCategoryId = newCat.id;
      state.selectedProjectId = null;
      selectedFileId = null;
      scheduleSave();
      renderAll();
    };

    const commitQuickProject = () => {
      if (cancelQuickProject) {
        cancelQuickProject = false;
        return;
      }
      if (projectQuickAdd.classList.contains('hidden')) return;
      const cat = getSelectedCategory();
      const name = projectQuickInput.value.trim();
      projectQuickInput.value = '';
      projectQuickAdd.classList.add('hidden');
      if (!cat || !name) return;
      const newProj = {
        id: uid('proj'),
        name,
        entries: [],
        files: []
      };
      cat.projects.push(newProj);
      state.selectedProjectId = newProj.id;
      selectedFileId = null;
      scheduleSave();
      renderAll();
    };

    // 新增分类
    addCategoryBtn.addEventListener('mousedown', (e) => e.preventDefault());
    addCategoryBtn.addEventListener('click', () => {
      categoryQuickAdd.classList.toggle('hidden');
      if (!categoryQuickAdd.classList.contains('hidden')) {
        cancelQuickCategory = false;
        categoryQuickInput.value = '';
        categoryQuickInput.focus();
      }
    });

    categoryQuickInput.addEventListener('blur', commitQuickCategory);
    categoryQuickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        categoryQuickInput.blur();
      } else if (e.key === 'Escape') {
        cancelQuickCategory = true;
        categoryQuickInput.value = '';
        categoryQuickAdd.classList.add('hidden');
      }
    });

    // 新增项目
    addProjectBtn.addEventListener('mousedown', (e) => e.preventDefault());
    addProjectBtn.addEventListener('click', () => {
      if (!getSelectedCategory()) return;
      projectQuickAdd.classList.toggle('hidden');
      if (!projectQuickAdd.classList.contains('hidden')) {
        cancelQuickProject = false;
        projectQuickInput.value = '';
        projectQuickInput.focus();
      }
    });

    projectQuickInput.addEventListener('blur', commitQuickProject);
    projectQuickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        projectQuickInput.blur();
      } else if (e.key === 'Escape') {
        cancelQuickProject = true;
        projectQuickInput.value = '';
        projectQuickAdd.classList.add('hidden');
      }
    });

    // 标题双击重命名项目
    activeProjectTitle.addEventListener('dblclick', () => {
      const proj = getSelectedProject();
      if (!proj) return;
      editingTarget = { type: 'header-project', id: proj.id };
      renderContent();
    });

    // 关联文件按钮
    addFileBtn.addEventListener('click', async () => {
      const proj = getSelectedProject();
      if (!proj) return;
      const paths = await api.pickFiles();
      if (paths && paths.length) {
        await addFilesToProject(proj, paths);
      }
    });

    // 拖入本地文件到当前项目（保持原路径）
    const isExternalFileDrag = (e) => !dragState && e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');

    contentPane.addEventListener('dragover', (e) => {
      if (!getSelectedProject() || !isExternalFileDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      contentPane.classList.add('file-drag-over');
    });

    contentPane.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && contentPane.contains(e.relatedTarget)) return;
      contentPane.classList.remove('file-drag-over');
    });

    contentPane.addEventListener('drop', async (e) => {
      contentPane.classList.remove('file-drag-over');
      const proj = getSelectedProject();
      if (!proj || !isExternalFileDrag(e)) return;
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files || []);
      const paths = droppedFiles.map((f) => api.getPathForFile(f)).filter(Boolean);
      if (paths.length) {
        await addFilesToProject(proj, paths);
      }
    });

    // 新增条目
    addEntryBtn.addEventListener('click', () => {
      const proj = getSelectedProject();
      if (!proj) return;
      createAndEditEntry(proj);
    });

    // 右键菜单操作
    document.addEventListener('click', () => closeContextMenu());

    ctxCopyFileBtn.addEventListener('click', async () => {
      if (!contextTarget || contextTarget.type !== 'file') return;
      const proj = getSelectedProject();
      const fileItem = proj?.files?.find((f) => f.id === contextTarget.id);
      closeContextMenu();
      if (fileItem) {
        await copyFileItem(fileItem);
      }
    });

    ctxOpenFolderBtn.addEventListener('click', async () => {
      if (!contextTarget || contextTarget.type !== 'file') return;
      const proj = getSelectedProject();
      const fileItem = proj?.files?.find((f) => f.id === contextTarget.id);
      closeContextMenu();
      if (fileItem) {
        const res = await api.showFileInFolder(fileItem.path);
        if (res && res.ok === false) {
          showToast(res.error || '原目录不存在');
        }
      }
    });

    ctxRenameBtn.addEventListener('click', () => {
      if (!contextTarget) return;
      editingTarget = { type: contextTarget.type, id: contextTarget.id };
      closeContextMenu();
      renderAll();
    });

    ctxDeleteBtn.addEventListener('click', () => {
      if (!contextTarget) return;
      const target = { ...contextTarget };
      closeContextMenu();
      if (target.type === 'category') {
        deleteCategory(target.id);
      } else if (target.type === 'project') {
        const cat = getSelectedCategory();
        if (cat) deleteProject(cat.id, target.id);
      } else if (target.type === 'file') {
        const proj = getSelectedProject();
        if (proj && Array.isArray(proj.files)) {
          proj.files = proj.files.filter((f) => f.id !== target.id);
          if (selectedFileId === target.id) {
            selectedFileId = null;
          }
          scheduleSave();
          renderProjects();
          renderContent();
        }
      }
    });

    // 全局 Ctrl+F 搜索
    openSearchBtn.addEventListener('click', openSearchModal);

    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) closeSearchModal();
    });

    searchInput.addEventListener('input', () => {
      updateSearchResults(searchInput.value);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearchModal();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (searchResultsData.length) {
          searchSelectedIndex = (searchSelectedIndex + 1) % searchResultsData.length;
          renderSearchResults(searchInput.value.trim());
          searchResultsEl.children[searchSelectedIndex]?.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (searchResultsData.length) {
          searchSelectedIndex = (searchSelectedIndex - 1 + searchResultsData.length) % searchResultsData.length;
          renderSearchResults(searchInput.value.trim());
          searchResultsEl.children[searchSelectedIndex]?.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = searchResultsData[searchSelectedIndex];
        if (item) selectSearchResult(item);
      }
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (searchModal.classList.contains('hidden')) {
          openSearchModal();
        } else {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === 'Escape' && !searchModal.classList.contains('hidden')) {
        closeSearchModal();
      }
    });

    // 主题切换
    themeToggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(state.theme);
      scheduleSave();
    });

    // 导出 / 导入备份
    exportBtn.addEventListener('click', async () => {
      try {
        const res = await api.exportData(state);
        if (!res.canceled) {
          showToast('备份已导出');
        }
      } catch {
        showToast('导出失败');
      }
    });

    importBtn.addEventListener('click', async () => {
      try {
        const res = await api.importData();
        if (!res.canceled && res.data) {
          state = res.data;
          applyTheme(state.theme || 'light');
          editingTarget = null;
          renderAll();
          showToast('备份已导入');
        }
      } catch (err) {
        showToast(err?.message || '导入失败，请检查文件格式');
      }
    });
  }

  async function init() {
    state = await api.load();
    let migrated = false;
    if (Array.isArray(state.categories)) {
      state.categories.forEach((cat) => {
        (cat.projects || []).forEach((proj) => {
          (proj.files || []).forEach((f) => {
            if (typeof f.path === 'string' && /^d:\\/i.test(f.path)) {
              f.path = 'E:\\' + f.path.slice(3);
              migrated = true;
            }
          });
        });
      });
    }
    if (migrated) {
      await api.save(state);
    }
    applyTheme(state.theme || 'light');
    bindEvents();
    renderAll();
  }

  init();
})();
