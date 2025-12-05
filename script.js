// script.js

let snomedData = [];
const DATA_FILE = 'data.json'; 
const LOCAL_STORAGE_KEY = 'snomedCustomData'; 
let myChart = null; 

let currentSortColumn = null;
let currentSortDirection = 'asc';
let currentFilter = '';
let currentSearch = '';

// --- UTILITY FUNCTIONS ---

function showSection(sectionId) {
    const sections = ['search-area', 'results-container', 'statistics-area', 'all-data-area'];
    
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const isDefaultView = sectionId === 'search-area';
            
            if (id === sectionId || (id === 'results-container' && isDefaultView)) {
                element.classList.remove('hidden-section');
            } else {
                element.classList.add('hidden-section');
            }
        }
    });

    const navBar = document.getElementById('nav-bar');
    if (sectionId === 'search-area') {
        navBar.classList.add('hidden-section');
    } else {
        navBar.classList.remove('hidden-section');
    }
}

// --- PENGELOLAAN DATA DAN CACHE ---

async function loadData() {
    try {
        const response = await fetch(DATA_FILE); 
        if (!response.ok) {
             throw new Error(`Gagal memuat file: ${response.status} ${response.statusText}.`);
        }
        
        const text = await response.text();
        if (!text) {
             throw new Error("File JSON kosong.");
        }
        let fileData = JSON.parse(text);

        if (!Array.isArray(fileData)) {
            throw new Error("Format file JSON tidak valid. Data harus berupa Array [...].");
        }
        
        const customDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
        let customData = customDataString ? JSON.parse(customDataString) : [];

        snomedData = fileData.concat(customData);

        // Data Cleaning & Persiapan Final
        snomedData = snomedData.map(item => ({
            No_Registrasi: String(item.No_Registrasi || 'N/A'),
            Kategori: String(item.Kategori || 'N/A'),
            Teks_Asli_Resume: String(item.Teks_Asli_Resume || ''),
            Kode_SNOMED: String(item.Kode_SNOMED || ''),
            FSN_SNOMED: String(item.FSN_SNOMED || ''),
            FSN_lower: String(item.FSN_SNOMED || '').toLowerCase(),
            Teks_Asli_lower: String(item.Teks_Asli_Resume || '').toLowerCase()
        }));
        
        console.log(`✅ Data berhasil dimuat: ${snomedData.length} baris.`);
        
        updateFilterOptions();

    } catch (error) {
        console.error('❌ Gagal memuat atau memproses data:', error);
        document.getElementById('results-container').innerHTML = `<p style="color:red; text-align:center;">
            ❌ GAGAL MEMUAT DATA. Pesan: ${error.message}. <br> 
            Pastikan server lokal berjalan dan file <strong>${DATA_FILE}</strong> ada.
        </p>`;
    }
}

// Menyimpan data yang diinput ke Local Storage
function saveCustomData(newData, indexToUpdate = -1) {
    const customDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
    let customData = customDataString ? JSON.parse(customDataString) : [];
    
    const originalJsonLength = snomedData.length - customData.length;

    if (indexToUpdate !== -1) {
        // Logika EDIT
        const customDataIndex = indexToUpdate - originalJsonLength;
        
        if (customDataIndex >= 0 && customDataIndex < customData.length) {
            customData.splice(customDataIndex, 1, newData);
        }
    } else {
        // Logika INPUT BARU
        customData.unshift(newData); 
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customData));
}

// --- LOGIKA PENCARIAN & DISPLAY ---

function displayResults(results) {
    const container = document.getElementById('results-container');
    const resultCount = document.getElementById('result-count');
    
    container.innerHTML = '';
    
    if (results.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Tidak ditemukan hasil untuk kata kunci ini.</p>';
        resultCount.textContent = `Ditemukan 0 kode terkait.`;
        return;
    }
    
    resultCount.textContent = `Ditemukan ${results.length} kode terkait.`;

    results.forEach(item => {
        const patients = snomedData
            .filter(data => data.Kode_SNOMED === item.Kode_SNOMED)
            .map(data => data.No_Registrasi);
        
        const uniqueValues = [...new Set(snomedData
            .filter(data => data.Kode_SNOMED === item.Kode_SNOMED)
            .map(data => data.Teks_Asli_Resume))];

        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <h3>Kode SNOMED-CT: ${item.Kode_SNOMED}</h3>
            <p><strong>FSN (Display Name):</strong> <code>${item.FSN_SNOMED}</code></p>
            <p><strong>Kategori:</strong> ${item.Kategori}</p>
            <p><strong>Digunakan pada Pasien (No. Registrasi):</strong></p>
            <div class="pasien-list">${[...new Set(patients)].join(', ')}</div>
            <p><strong>Teks Asli (Resume) Terkait:</strong> ${uniqueValues.join(' | ')}</p>
        `;
        container.appendChild(card);
    });
}

function performSearch(query) {
    if (snomedData.length === 0) return;
    
    showSection('search-area'); 
    
    if (!query) {
        document.getElementById('results-container').innerHTML = '<p class="placeholder-text">Masukkan kata kunci untuk memulai pencarian.</p>';
        document.getElementById('result-count').textContent = '';
        return;
    }

    const lowerQuery = query.toLowerCase();
    const foundCodes = new Map(); 

    snomedData.forEach(item => {
        const code = item.Kode_SNOMED;

        if (item.FSN_lower.includes(lowerQuery) || item.Teks_Asli_lower.includes(lowerQuery)) {
            if (!foundCodes.has(code)) {
                foundCodes.set(code, item);
            }
        }
    });

    const resultsArray = Array.from(foundCodes.values());
    displayResults(resultsArray);
}

// --- LOGIKA LIHAT DATA (SEARCH, SORT, FILTER, EDIT) ---

function updateFilterOptions() {
    const filterSelect = document.getElementById('dataFilterSelect');
    const categories = new Set(snomedData.map(item => item.Kategori).filter(k => k));
    
    filterSelect.innerHTML = '<option value="">Filter Kategori</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        filterSelect.appendChild(option);
    });
    
    filterSelect.value = currentFilter;
}


window.handleSort = (column) => {
    if (column === currentSortColumn) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    renderFullDataTable();
};

function renderFullDataTable() {
    const container = document.getElementById('full-data-table');
    showSection('all-data-area'); 

    if (snomedData.length === 0) {
        container.innerHTML = '<p>Tidak ada data untuk ditampilkan.</p>';
        return;
    }
    
    let displayData = [...snomedData]; 
    
    // Filter dan Search
    displayData = displayData.filter(item => {
        const matchesFilter = !currentFilter || item.Kategori === currentFilter;
        const matchesSearch = !currentSearch || Object.values(item).some(val => 
            String(val).toLowerCase().includes(currentSearch.toLowerCase())
        );
        return matchesFilter && matchesSearch;
    });
    
    // Logika Sorting
    if (currentSortColumn) {
        displayData.sort((a, b) => {
            const valA = String(a[currentSortColumn]).toLowerCase();
            const valB = String(b[currentSortColumn]).toLowerCase();
            
            if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    let tableHTML = '<table>';
    const headers = [
        { label: 'No Registrasi', key: 'No_Registrasi' },
        { label: 'Kategori', key: 'Kategori' },
        { label: 'Teks Asli', key: 'Teks_Asli_Resume' },
        { label: 'Kode SNOMED-CT', key: 'Kode_SNOMED' },
        { label: 'FSN SNOMED-CT', key: 'FSN_SNOMED' },
        { label: 'Aksi', key: 'Aksi' }
    ];
    
    // --- Header Tabel dengan Ikon Sort ---
    tableHTML += '<thead><tr><th>No</th>';
    headers.forEach(header => {
        if (header.key !== 'Aksi') {
             let icon = '';
             if (header.key === currentSortColumn) {
                icon = `<i class="sort-icon fas fa-sort-${currentSortDirection === 'asc' ? 'up' : 'down'}"></i>`;
             } else {
                 icon = `<i class="sort-icon fas fa-sort"></i>`;
             }
             tableHTML += `<th onclick="handleSort('${header.key}')">${header.label}${icon}</th>`;
        } else {
             tableHTML += `<th>${header.label}</th>`;
        }
    });
    tableHTML += '</tr></thead>';
    
    // --- Body Tabel ---
    tableHTML += '<tbody>';
    
    const customDataLength = localStorage.getItem(LOCAL_STORAGE_KEY) ? JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)).length : 0;
    const originalJsonLength = snomedData.length - customDataLength;

    displayData.forEach((item, index) => {
        const globalIndex = snomedData.findIndex(data => 
            data.No_Registrasi === item.No_Registrasi && data.FSN_SNOMED === item.FSN_SNOMED
        );
        
        const isCustomData = globalIndex >= originalJsonLength && globalIndex !== -1;
        
        const actionButton = isCustomData 
            ? `<button class="edit-btn" onclick="openEditModal(${globalIndex})">Edit</button>`
            : '—'; 

        tableHTML += `<tr>
            <td>${index + 1}</td>
            <td>${item.No_Registrasi}</td>
            <td>${item.Kategori}</td>
            <td>${item.Teks_Asli_Resume}</td>
            <td>${item.Kode_SNOMED}</td>
            <td>${item.FSN_SNOMED}</td>
            <td>${actionButton}</td>
        </tr>`;
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

// --- LOGIKA EDIT MODAL ---

window.openEditModal = (index) => {
    const data = snomedData[index];
    if (!data) return;

    const customDataLength = localStorage.getItem(LOCAL_STORAGE_KEY) ? JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)).length : 0;
    const originalJsonLength = snomedData.length - customDataLength;
    
    if (index < originalJsonLength) {
        alert("Maaf, data asli dari file JSON tidak dapat diedit.");
        return;
    }

    const modal = document.getElementById('editModal');
    const form = document.getElementById('editForm');
    
    form.editIndex.value = index; 
    form.edit_reg.value = data.No_Registrasi;
    form.edit_kat.value = data.Kategori; // Dropdown value
    form.edit_teks.value = data.Teks_Asli_Resume;
    form.edit_kode.value = data.Kode_SNOMED;
    form.edit_fsn.value = data.FSN_SNOMED;

    modal.style.display = "block";
}

function handleSaveEdit(e) {
    e.preventDefault();
    const form = e.target;
    const index = parseInt(form.editIndex.value);

    const newData = {
        No_Registrasi: form.edit_reg.value,
        Kategori: form.edit_kat.value,
        Teks_Asli_Resume: form.edit_teks.value,
        Kode_SNOMED: form.edit_kode.value,
        FSN_SNOMED: form.edit_fsn.value
    };
    
    saveCustomData(newData, index);
    
    loadData().then(() => {
        renderFullDataTable();
        document.getElementById('editModal').style.display = "none";
    });
}


// --- LOGIKA STATISTIK (GRAFIK & TABEL FREKUENSI) ---

function calculateGenderStats() {
    const genderCodes = snomedData.filter(item => item.Kategori && item.Kategori.toLowerCase() === 'person');
    
    const MAN_CODES = ['339947000']; 
    const WOMAN_CODES = ['224526002', '248152002']; 
    
    let manCount = 0;
    let womanCount = 0;

    const countedPatients = new Set(); 

    genderCodes.forEach(item => {
        const regId = item.No_Registrasi;
        
        if (countedPatients.has(regId)) {
            return; 
        }

        if (MAN_CODES.includes(item.Kode_SNOMED)) {
            manCount++;
            countedPatients.add(regId);
        } else if (WOMAN_CODES.includes(item.Kode_SNOMED)) {
            womanCount++;
            countedPatients.add(regId);
        }
    });

    return { manCount, womanCount };
}

function calculateFrequencyTable() {
    const frequencyMap = new Map();
    
    snomedData.forEach(item => {
        if (item.Kode_SNOMED && item.FSN_SNOMED && item.Kode_SNOMED !== 'N/A') {
            const key = `${item.Kode_SNOMED}|${item.FSN_SNOMED}`; 
            frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
        }
    });

    const tableData = Array.from(frequencyMap, ([key, count]) => {
        const [kode, fsn] = key.split('|');
        return { kode, fsn, count };
    }).sort((a, b) => b.count - a.count); 

    return tableData;
}

function renderStatistics() {
    showSection('statistics-area'); 
    
    // --- 1. Grafik Pie Gender ---
    const { manCount, womanCount } = calculateGenderStats();
    const genderCtx = document.getElementById('genderChart').getContext('2d');

    if (myChart) {
        myChart.destroy(); 
    }
    
    const totalGender = manCount + womanCount;

    if (totalGender > 0) {
        myChart = new Chart(genderCtx, {
            type: 'pie',
            data: {
                labels: [`Laki-laki (${manCount})`, `Perempuan (${womanCount})`],
                datasets: [{
                    label: 'Frekuensi Gender',
                    data: [manCount, womanCount],
                    backgroundColor: ['#007bff', '#ffc0cb'], 
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                         callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += context.raw;
                                label += ` (${((context.raw / totalGender) * 100).toFixed(1)}%)`;
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } else {
         document.getElementById('gender-chart-container').innerHTML = '<h3>Proporsi Gender Pasien</h3><p>Data gender (Man/Woman) belum ditemukan atau belum diinput dengan kode yang benar.</p>';
    }
    
    // --- 2. Tabel Frekuensi FSN ---
    const tableData = calculateFrequencyTable();
    const tableContainer = document.getElementById('frequency-table-container');

    if (tableData.length === 0) {
        tableContainer.innerHTML = '<h3>Tabel Frekuensi Kode SNOMED-CT (FSN)</h3><p>Tidak ada kode SNOMED-CT valid untuk dianalisis.</p>';
        return;
    }

    let tableHTML = '<table>';
    tableHTML += '<thead><tr><th>No</th><th>Kode SNOMED-CT</th><th>FSN</th><th>Jumlah</th></tr></thead>';
    tableHTML += '<tbody>';
    
    tableData.forEach((item, index) => {
        tableHTML += `<tr>
            <td>${index + 1}</td>
            <td>${item.kode}</td>
            <td>${item.fsn}</td>
            <td>${item.count}</td>
        </tr>`;
    });

    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = '<h3>Tabel Frekuensi Kode SNOMED-CT (FSN)</h3>' + tableHTML;
}

// --- INISIALISASI APLIKASI DAN EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    
    loadData().then(() => {
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (event) => {
            performSearch(event.target.value);
        });
        performSearch(''); 
        
        // Pemasangan Event Listeners untuk Kontrol Data Tabel
        const dataSearchInput = document.getElementById('dataSearchInput');
        const dataFilterSelect = document.getElementById('dataFilterSelect');

        dataSearchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderFullDataTable();
        });

        dataFilterSelect.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            renderFullDataTable();
        });
    });

    // Logika Modal Input Data
    const modalInput = document.getElementById("inputModal");
    const modalEdit = document.getElementById("editModal");
    const btnShow = document.getElementById("showInputForm");
    
    // Close button untuk Input Modal
    document.getElementsByClassName("close-button")[0].onclick = () => { modalInput.style.display = "none"; document.getElementById('inputMessage').textContent = ''; };
    // Close button untuk Edit Modal
    document.getElementsByClassName("close-button-edit")[0].onclick = () => { modalEdit.style.display = "none"; };
    document.getElementById('cancelEditButton').onclick = () => { modalEdit.style.display = "none"; };
    
    btnShow.onclick = () => { modalInput.style.display = "block"; };
    
    // Logika menutup modal saat klik di luar
    window.onclick = (event) => { 
        if (event.target == modalInput) { modalInput.style.display = "none"; document.getElementById('inputMessage').textContent = ''; } 
        if (event.target == modalEdit) { modalEdit.style.display = "none"; }
    };

    // Logika Save Input
    document.getElementById("inputForm").addEventListener('submit', (e) => {
        e.preventDefault();
        
        const form = e.target;
        const newData = {
            No_Registrasi: form.reg.value,
            Kategori: form.kat.value,
            Teks_Asli_Resume: form.teks.value,
            Kode_SNOMED: form.kode.value,
            FSN_SNOMED: form.fsn.value
        };

        saveCustomData(newData);
        loadData().then(() => { 
            form.querySelector('#inputMessage').textContent = 'Data berhasil ditambahkan!';
            form.reset(); 
            performSearch(document.getElementById('searchInput').value); 
        });
    });
    
    // Logika Save Edit
    document.getElementById('editForm').addEventListener('submit', handleSaveEdit);


    // Logika Tampilan Statistik
    document.getElementById("showStats").addEventListener('click', () => {
        renderStatistics(); 
    });
    
    // Logika Tombol Navigasi Sekunder
    document.getElementById('btnBack').addEventListener('click', () => {
        currentSortColumn = null;
        currentFilter = '';
        currentSearch = '';
        performSearch(document.getElementById('searchInput').value); 
    });
    
    // Logika Tombol Lihat Semua Data
    document.getElementById('btnViewData').addEventListener('click', () => {
        currentSortColumn = null;
        currentFilter = '';
        currentSearch = '';
        document.getElementById('dataSearchInput').value = '';
        document.getElementById('dataFilterSelect').value = '';

        renderFullDataTable(); 
    });
});
