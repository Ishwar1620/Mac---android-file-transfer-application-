/**
 * Android File Transfer Application
 * Main JavaScript application logic
 */

// Application State
const state = {
    selectedDevice: null,
    macCurrentPath: null,
    androidCurrentPath: '/sdcard/Download',
    selectedFiles: [],  // Changed from selectedFile to selectedFiles array
    ws: null,
    devices: []
};

// DOM Elements
const elements = {
    deviceSelect: document.getElementById('device-select'),
    connectionStatus: document.getElementById('connection-status'),
    macFiles: document.getElementById('mac-files'),
    androidFiles: document.getElementById('android-files'),
    macBreadcrumb: document.getElementById('mac-breadcrumb'),
    androidBreadcrumb: document.getElementById('android-breadcrumb'),
    transferIndicator: document.getElementById('transfer-indicator'),
    toastContainer: document.getElementById('toast-container'),
    progressModal: document.getElementById('progress-modal'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text'),
    transferFilename: document.getElementById('transfer-filename'),
    transferDirection: document.getElementById('transfer-direction'),
    transferStatus: document.getElementById('transfer-status'),
    closeProgress: document.getElementById('close-progress'),
    transferToAndroid: document.getElementById('transfer-to-android'),
    transferToMac: document.getElementById('transfer-to-mac'),
    macSelectionCount: document.getElementById('mac-selection-count'),
    androidSelectionCount: document.getElementById('android-selection-count')
};

// Initialize Application
async function init() {
    setupWebSocket();
    setupEventListeners();
    setupProgressModal();
    await loadMacFiles();
}

// WebSocket Setup
function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
        updateConnectionStatus('connected', 'Connected');
    };

    state.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'device_list') {
            updateDeviceList(data.devices);
        }
    };

    state.ws.onerror = () => {
        updateConnectionStatus('disconnected', 'Connection Error');
    };

    state.ws.onclose = () => {
        updateConnectionStatus('disconnected', 'Disconnected');
        // Attempt to reconnect after 3 seconds
        setTimeout(setupWebSocket, 3000);
    };
}

// Update Connection Status
function updateConnectionStatus(status, text) {
    const statusDot = elements.connectionStatus.querySelector('.status-dot');
    const statusText = elements.connectionStatus.querySelector('.status-text');

    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
}

// Update Device List
function updateDeviceList(devices) {
    state.devices = devices;
    elements.deviceSelect.innerHTML = '';

    if (devices.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No devices connected';
        elements.deviceSelect.appendChild(option);

        // Clear Android files if no devices
        if (state.selectedDevice) {
            state.selectedDevice = null;
            showEmptyState(elements.androidFiles, 'No device selected', 'Connect an Android device to get started');
        }
    } else {
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.serial;
            option.textContent = `${device.manufacturer} ${device.model} (${device.serial})`;
            elements.deviceSelect.appendChild(option);
        });

        // Auto-select first device if none selected
        if (!state.selectedDevice && devices.length > 0) {
            state.selectedDevice = devices[0].serial;
            elements.deviceSelect.value = state.selectedDevice;
            loadAndroidFiles();
        }
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Device selection
    elements.deviceSelect.addEventListener('change', (e) => {
        state.selectedDevice = e.target.value;
        if (state.selectedDevice) {
            state.androidCurrentPath = '/sdcard/Download';
            loadAndroidFiles();
        } else {
            showEmptyState(elements.androidFiles, 'No device selected', 'Select a device from the dropdown');
        }
    });

    // Drag and drop
    setupDragAndDrop(elements.macFiles, 'mac');
    setupDragAndDrop(elements.androidFiles, 'android');

    // Transfer buttons
    elements.transferToAndroid.addEventListener('click', () => {
        transferSelectedFiles('android');
    });

    elements.transferToMac.addEventListener('click', () => {
        transferSelectedFiles('mac');
    });
}

// Setup Progress Modal
function setupProgressModal() {
    elements.closeProgress.addEventListener('click', () => {
        hideProgressModal();
    });
}

// Show Progress Modal
function showProgressModal(filename, direction) {
    elements.transferFilename.textContent = filename;
    elements.transferDirection.textContent = direction;
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = '0%';
    elements.transferStatus.textContent = 'Preparing transfer...';
    elements.progressModal.classList.add('active');
}

// Hide Progress Modal
function hideProgressModal() {
    elements.progressModal.classList.remove('active');
}

// Update Progress
function updateProgress(percent, status) {
    elements.progressFill.style.width = percent + '%';
    elements.progressText.textContent = Math.round(percent) + '%';
    if (status) {
        elements.transferStatus.textContent = status;
    }
}

// Update Selection Counts
function updateSelectionCounts() {
    const macFiles = state.selectedFiles.filter(f => f.sourceType === 'mac');
    const androidFiles = state.selectedFiles.filter(f => f.sourceType === 'android');

    elements.macSelectionCount.textContent = macFiles.length;
    elements.androidSelectionCount.textContent = androidFiles.length;

    // Enable/disable transfer buttons
    elements.transferToAndroid.disabled = macFiles.length === 0 || !state.selectedDevice;
    elements.transferToMac.disabled = androidFiles.length === 0;
}

// Transfer Selected Files
async function transferSelectedFiles(targetType) {
    const filesToTransfer = state.selectedFiles.filter(f => {
        if (targetType === 'android') {
            return f.sourceType === 'mac';
        } else {
            return f.sourceType === 'android';
        }
    });

    if (filesToTransfer.length === 0) {
        showError('No files selected for transfer');
        return;
    }

    // Determine transfer direction
    let direction;
    if (targetType === 'android') {
        direction = 'Mac → Android';
    } else {
        direction = 'Android → Mac';
    }

    // Show progress modal
    const fileCount = filesToTransfer.length;
    const displayName = fileCount === 1 ? filesToTransfer[0].name : `${fileCount} files`;
    showProgressModal(displayName, direction);

    // Track progress across all files
    let completedFiles = 0;
    const updateOverallProgress = () => {
        const percent = (completedFiles / fileCount) * 100;
        updateProgress(percent, `Transferring ${completedFiles}/${fileCount} files...`);
    };

    updateProgress(0, 'Starting transfer...');

    try {
        // Transfer all files in parallel
        const transferPromises = filesToTransfer.map(async (file) => {
            const fileData = {
                path: file.path,
                name: file.name,
                sourceType: file.sourceType
            };

            try {
                await transferSingleFile(fileData, targetType);
                completedFiles++;
                updateOverallProgress();
            } catch (error) {
                showError(`Failed to transfer ${file.name}: ${error.message}`);
                throw error;
            }
        });

        // Wait for all transfers to complete
        await Promise.all(transferPromises);

        // Complete
        updateProgress(100, 'All files transferred!');
        await new Promise(resolve => setTimeout(resolve, 500));
        hideProgressModal();
        showSuccess(`Successfully transferred ${fileCount} file${fileCount > 1 ? 's' : ''}`);

        // Refresh target file list
        if (targetType === 'mac') {
            await loadMacFiles(state.macCurrentPath);
        } else {
            await loadAndroidFiles(state.androidCurrentPath);
        }
    } catch (error) {
        hideProgressModal();
        // Error already shown in the map function
    }

    // Clear selection after transfer
    state.selectedFiles = [];
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
    updateSelectionCounts();
}

// Load Mac Files
async function loadMacFiles(path = null) {
    try {
        showLoading(elements.macFiles);

        const url = path ? `/api/mac/files?path=${encodeURIComponent(path)}` : '/api/mac/files';
        const response = await fetch(url);
        const data = await response.json();

        state.macCurrentPath = data.current_path;
        updateBreadcrumb(elements.macBreadcrumb, data.current_path, 'mac');
        renderFileList(elements.macFiles, data.files, 'mac');
    } catch (error) {
        showError('Failed to load Mac files: ' + error.message);
        showEmptyState(elements.macFiles, 'Error loading files', error.message);
    }
}

// Load Android Files
async function loadAndroidFiles(path = null) {
    if (!state.selectedDevice) {
        showEmptyState(elements.androidFiles, 'No device selected', 'Select a device from the dropdown');
        return;
    }

    try {
        showLoading(elements.androidFiles);

        const targetPath = path || state.androidCurrentPath;
        const url = `/api/android/files?serial=${state.selectedDevice}&path=${encodeURIComponent(targetPath)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to load Android files');
        }

        const data = await response.json();
        state.androidCurrentPath = data.current_path;
        updateBreadcrumb(elements.androidBreadcrumb, data.current_path, 'android');
        renderFileList(elements.androidFiles, data.files, 'android');
    } catch (error) {
        showError('Failed to load Android files: ' + error.message);
        showEmptyState(elements.androidFiles, 'Error loading files', error.message);
    }
}

// Update Breadcrumb
function updateBreadcrumb(element, path, type) {
    const parts = path.split('/').filter(p => p);
    element.innerHTML = '';

    // Add root
    const root = document.createElement('span');
    root.className = 'breadcrumb-item';
    root.textContent = type === 'mac' ? '~' : '/';
    root.addEventListener('click', () => {
        if (type === 'mac') {
            loadMacFiles();
        } else {
            loadAndroidFiles('/');
        }
    });
    element.appendChild(root);

    // Add path parts
    let currentPath = '';
    parts.forEach((part, index) => {
        const separator = document.createElement('span');
        separator.textContent = ' / ';
        separator.style.color = 'var(--text-muted)';
        element.appendChild(separator);

        currentPath += '/' + part;
        const item = document.createElement('span');
        item.className = 'breadcrumb-item';
        item.textContent = part;

        const pathToNavigate = currentPath;
        item.addEventListener('click', () => {
            if (type === 'mac') {
                loadMacFiles(pathToNavigate);
            } else {
                loadAndroidFiles(pathToNavigate);
            }
        });

        element.appendChild(item);
    });
}

// Render File List
function renderFileList(container, files, type) {
    container.innerHTML = '';

    if (files.length === 0) {
        showEmptyState(container, 'Empty directory', 'No files or folders found');
        return;
    }

    files.forEach(file => {
        const fileItem = createFileItem(file, type);
        container.appendChild(fileItem);
    });
}

// Create File Item
function createFileItem(file, type) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.draggable = true;
    item.dataset.path = file.path;
    item.dataset.name = file.name;
    item.dataset.isDirectory = file.is_directory;
    item.dataset.type = type;

    // Icon
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.classList.add('file-icon', file.is_directory ? 'folder' : 'file');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');

    if (file.is_directory) {
        icon.innerHTML = '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>';
    } else {
        icon.innerHTML = '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline>';
    }

    // File Info
    const info = document.createElement('div');
    info.className = 'file-info';

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = file.name;

    const meta = document.createElement('div');
    meta.className = 'file-meta';
    if (file.is_directory) {
        meta.textContent = 'Folder';
    } else {
        meta.textContent = formatFileSize(file.size);
    }

    info.appendChild(name);
    info.appendChild(meta);

    item.appendChild(icon);
    item.appendChild(info);

    // Click handler
    item.addEventListener('click', (e) => {
        if (file.is_directory) {
            if (type === 'mac') {
                loadMacFiles(file.path);
            } else {
                loadAndroidFiles(file.path);
            }
        } else {
            // Multi-select with Ctrl/Cmd key
            if (e.ctrlKey || e.metaKey) {
                // Toggle selection
                const index = state.selectedFiles.findIndex(f => f.path === file.path && f.sourceType === type);
                if (index > -1) {
                    // Deselect
                    state.selectedFiles.splice(index, 1);
                    item.classList.remove('selected');
                } else {
                    // Add to selection
                    state.selectedFiles.push({ ...file, sourceType: type });
                    item.classList.add('selected');
                }
            } else {
                // Single select - clear all and select this one
                document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
                state.selectedFiles = [{ ...file, sourceType: type }];
                item.classList.add('selected');
            }

            // Update selection counts
            updateSelectionCounts();
        }
    });

    // Drag handlers
    item.addEventListener('dragstart', (e) => {
        if (file.is_directory) {
            e.preventDefault();
            return;
        }

        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/json', JSON.stringify({
            path: file.path,
            name: file.name,
            sourceType: type
        }));
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
    });

    return item;
}

// Setup Drag and Drop
function setupDragAndDrop(container, targetType) {
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
        container.classList.remove('drag-over');
    });

    container.addEventListener('drop', async (e) => {
        e.preventDefault();
        container.classList.remove('drag-over');

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));

            // Don't allow dropping on same side
            if (data.sourceType === targetType) {
                return;
            }

            await transferFile(data, targetType);
        } catch (error) {
            showError('Transfer failed: ' + error.message);
        }
    });
}

// Transfer Single File (used internally by batch transfer)
async function transferSingleFile(fileData, targetType) {
    const { path: sourcePath, name, sourceType } = fileData;

    try {
        let endpoint, requestBody;

        if (sourceType === 'mac' && targetType === 'android') {
            // Mac to Android
            if (!state.selectedDevice) {
                throw new Error('No device selected');
            }

            endpoint = '/api/transfer/mac-to-android';
            requestBody = {
                source_path: sourcePath,
                destination_path: `${state.androidCurrentPath}/${name}`,
                device_serial: state.selectedDevice
            };
        } else if (sourceType === 'android' && targetType === 'mac') {
            // Android to Mac
            endpoint = '/api/transfer/android-to-mac';
            requestBody = {
                source_path: sourcePath,
                destination_path: `${state.macCurrentPath}/${name}`,
                device_serial: state.selectedDevice
            };
        } else {
            throw new Error('Invalid transfer direction');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Transfer failed');
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showLoading(container) {
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading files...</p>
        </div>
    `;
}

function showEmptyState(container, title, message) {
    container.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            <p>${title}</p>
            <span>${message}</span>
        </div>
    `;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.classList.add('toast-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');

    if (type === 'success') {
        icon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
    } else if (type === 'error') {
        icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';
    } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(messageEl);
    elements.toastContainer.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}

function showInfo(message) {
    showToast(message, 'info');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
