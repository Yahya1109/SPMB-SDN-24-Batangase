import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// --- 1. SUPABASE CONFIGURATION ---
const supabaseUrl = 'https://abcxyz.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_anon_key_here';

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE_NAME = 'ppdb_registrations';
const STORAGE_BUCKET = 'ppdb_berkas';

// --- 2. APPLICATION STATE ---
const state = {
    data: [],
    currentUser: null,
    isAdminView: false,
    realtimeChannel: null
};

// --- 3. MAIN APP CONTROLLER ---
window.app = {
    init: async () => {
        app.setupTheme();
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        try {
            const { data: { session } } = await supabase.auth.getSession();
            state.currentUser = session?.user || null;
            state.isAdminView = !!state.currentUser;

            // Proteksi Rute Dasar
            if (currentPage === 'dashboard.html' && !state.isAdminView) {
                window.location.href = 'login.html';
                return;
            }

            // Realtime Auth Listener
            supabase.auth.onAuthStateChange((event, session) => {
                state.currentUser = session?.user || null;
                state.isAdminView = !!state.currentUser;
                
                if (currentPage === 'dashboard.html' && !state.isAdminView) {
                    window.location.href = 'login.html';
                } else if (currentPage === 'login.html' && state.isAdminView) {
                    window.location.href = 'dashboard.html';
                }
            });

            if (currentPage === 'dashboard.html' && state.isAdminView) {
                app.fetchDataAdmin();
            }
        } catch (error) {
            console.warn("Auth init failed:", error.message);
        }
    },

    toggleMobileMenu: () => {
        const menu = document.getElementById('mobileMenu');
        if(menu) menu.classList.toggle('hidden');
    },

    submitPPDB: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitForm');
        const loader = document.getElementById('loaderSubmit');
        const txt = document.getElementById('txtSubmit');
        const icon = document.getElementById('iconSubmit');
        
        const nik = document.getElementById('f_nik').value;
        if(nik.length !== 16) {
            app.showToast('NIK harus 16 digit!', 'error');
            return;
        }

        btn.disabled = true; loader.classList.remove('hidden'); icon.classList.add('hidden');
        txt.textContent = 'Memproses...';

        try {
            const noDaftar = 'PPDB-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

            const uploadFileSafely = async (inputId, path) => {
                const file = document.getElementById(inputId).files;
                if(!file) return "";
                try {
                    const filePath = `2026/${noDaftar}/${path}_${file.name}`;
                    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file);
                    if (error) throw error;
                    const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
                    return publicUrl;
                } catch (err) {
                    console.warn("Storage upload failed:", err);
                    return "berkas_disimpan_lokal"; 
                }
            };

            const urlKK = await uploadFileSafely('f_fileKK', 'KK');
            const urlAkta = await uploadFileSafely('f_fileAkta', 'AKTA');
            const urlFoto = await uploadFileSafely('f_fileFoto', 'FOTO');
            const urlKip = await uploadFileSafely('f_fileKip', 'KIP');

            const getVal = (id) => {
                const val = document.getElementById(id).value;
                return typeof val === 'string' ? val.toUpperCase().trim() : val;
            };

            const insertData = {
                no_pendaftaran: noDaftar, status: 'Menunggu Verifikasi',
                siswa: { nik: getVal('f_nik'), nisn: getVal('f_nisn'), nama: getVal('f_nama'), tempat_lahir: getVal('f_tempatLahir'), tgl_lahir: document.getElementById('f_tglLahir').value, jk: getVal('f_jk'), agama: getVal('f_agama'), alamat: getVal('f_alamat'), rt: getVal('f_rt'), rw: getVal('f_rw'), kelurahan: getVal('f_kelurahan'), kecamatan: getVal('f_kecamatan'), kabupaten: getVal('f_kabupaten'), kodepos: getVal('f_kodepos'), asal_sekolah: getVal('f_asalSekolah'), no_akta: getVal('f_noAkta'), kip: getVal('f_kip') },
                ortu: { ayah: { nama: getVal('f_namaAyah'), tahun: getVal('f_tahunAyah'), pend: getVal('f_pendidikanAyah'), pek: getVal('f_pekerjaanAyah'), peng: getVal('f_penghasilanAyah'), hp: getVal('f_hpAyah') }, ibu: { nama: getVal('f_namaIbu'), tahun: getVal('f_tahunIbu'), pend: getVal('f_pendidikanIbu'), pek: getVal('f_pekerjaanIbu'), peng: getVal('f_penghasilanIbu'), hp: getVal('f_hpIbu') } },
                wali: { nama: getVal('f_namaWali'), pek: getVal('f_pekerjaanWali'), hp: getVal('f_hpWali'), alamat: getVal('f_alamatWali') },
                periodik: { tinggi: getVal('f_tinggi'), berat: getVal('f_berat'), anak_ke: getVal('f_anakKe'), jml_saudara: getVal('f_jmlSaudara'), jarak: getVal('f_jarak'), waktu: getVal('f_waktu'), transport: getVal('f_transport') },
                berkas: { kk: urlKK, akta: urlAkta, foto: urlFoto, kip: urlKip }
            };

            const { error } = await supabase.from(TABLE_NAME).insert([insertData]);
            if (error) throw error;

            document.getElementById('formPendaftaran').reset();
            document.getElementById('displayNoDaftar').textContent = noDaftar;
            
            // Transisi ke tampilan sukses di file yang sama (form.html)
            document.getElementById('form-container').classList.add('hidden');
            const successView = document.getElementById('success-container');
            successView.classList.remove('hidden');
            successView.classList.add('flex');
            
            app.showToast('Pendaftaran Berhasil Dikirim!', 'success');
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error(error);
            app.showToast('Gagal mengirim data: ' + error.message, 'error');
        } finally {
            btn.disabled = false; loader.classList.add('hidden'); icon.classList.remove('hidden'); txt.textContent = 'Kirim Pendaftaran';
        }
    },

    login: async (e) => {
        e.preventDefault();
        const email = document.getElementById('l_email').value;
        const pass = document.getElementById('l_password').value;
        const btn = document.getElementById('btnLogin');
        const loader = document.getElementById('loaderLogin');
        
        btn.disabled = true; loader.classList.remove('hidden');

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email: email, password: pass });
            if (error) throw error;
            app.showToast('Login berhasil!', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 500);
        } catch (error) {
            app.showToast('Login gagal: Kredensial salah', 'error');
        } finally {
            btn.disabled = false; loader.classList.add('hidden');
        }
    },

    logout: async () => {
        try {
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        } catch (e) { console.error(e); }
    },

    fetchDataAdmin: async () => {
        try {
            const { data, error } = await supabase.from(TABLE_NAME).select('*').order('created_at', { ascending: false });
            if (error) throw error;
            state.data = data || [];
            app.renderDashboard();

            if (state.realtimeChannel) supabase.removeChannel(state.realtimeChannel);
            state.realtimeChannel = supabase.channel('table-db-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => { app.fetchDataAdmin(); })
                .subscribe();

        } catch (error) {
            console.warn(error);
            app.showToast('Koneksi database bermasalah.', 'error');
        }
    },

    renderDashboard: () => {
        let total = state.data.length, menunggu = 0, diterima = 0, l = 0, p = 0;
        state.data.forEach(d => {
            if(d.status === 'Menunggu Verifikasi') menunggu++;
            if(d.status === 'Diverifikasi') diterima++;
            if(d.siswa && d.siswa.jk === 'LAKI-LAKI') l++;
            if(d.siswa && d.siswa.jk === 'PEREMPUAN') p++;
        });

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statMenunggu').textContent = menunggu;
        document.getElementById('statDiterima').textContent = diterima;
        document.getElementById('statL').textContent = l;
        document.getElementById('statP').textContent = p;

        app.filterTable(); 
    },

    filterTable: () => {
        const search = document.getElementById('searchTable').value.toLowerCase();
        const status = document.getElementById('filterStatus').value;
        const filtered = state.data.filter(d => {
            const matchSearch = (d.siswa?.nama?.toLowerCase() || '').includes(search) || (d.no_pendaftaran?.toLowerCase() || '').includes(search);
            const matchStatus = status === 'all' || d.status === status;
            return matchSearch && matchStatus;
        });

        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        if(filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500">Tidak ada data ditemukan.</td></tr>`;
            return;
        }

        filtered.forEach(d => {
            let badgeClass = "bg-gray-100 text-gray-800";
            if(d.status === 'Menunggu Verifikasi') badgeClass = "bg-yellow-100 text-yellow-800 border border-yellow-200";
            if(d.status === 'Diverifikasi') badgeClass = "bg-green-100 text-green-800 border border-green-200";
            if(d.status === 'Ditolak') badgeClass = "bg-red-100 text-red-800 border border-red-200";
            if(d.status === 'Cadangan') badgeClass = "bg-purple-100 text-purple-800 border border-purple-200";

            let dateStr = d.created_at ? new Date(d.created_at).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year:'numeric'}) : '-';

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors";
            tr.innerHTML = `
                <td class="p-4 font-mono font-medium text-primary-600 dark:text-primary-400 whitespace-nowrap">${d.no_pendaftaran || '-'}</td>
                <td class="p-4 min-w-[200px] whitespace-normal break-words">
                    <p class="font-bold text-gray-900 dark:text-white leading-tight">${d.siswa?.nama || '-'}</p>
                    <p class="text-xs text-gray-500 mt-1">NIK: ${d.siswa?.nik || '-'}</p>
                </td>
                <td class="p-4 whitespace-nowrap">${(d.siswa?.jk || '-').substring(0,1)}</td>
                <td class="p-4 text-gray-500 whitespace-nowrap">${dateStr}</td>
                <td class="p-4 whitespace-nowrap"><span class="px-3 py-1.5 rounded-xl text-xs font-semibold ${badgeClass}">${d.status}</span></td>
                <td class="p-4 text-center no-print whitespace-nowrap">
                    <button onclick="app.showDetail('${d.id}')" class="text-blue-500 hover:text-blue-700 mx-0.5 p-2 bg-blue-50 dark:bg-slate-800 rounded-lg transition-colors" title="Detail"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="app.deleteData('${d.id}')" class="text-red-500 hover:text-red-700 mx-0.5 p-2 bg-red-50 dark:bg-slate-800 rounded-lg transition-colors" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    showDetail: (id) => {
        const d = state.data.find(x => x.id === id);
        if(!d) return;

        document.getElementById('m_title').textContent = `Detail Siswa: ${d.siswa?.nama}`;
        
        const renderRow = (lbl, val) => `
            <div class="flex flex-col sm:flex-row py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                <span class="text-slate-500 text-xs sm:text-sm sm:w-1/3 mb-1 sm:mb-0 shrink-0">${lbl}</span>
                <span class="font-medium text-slate-900 dark:text-white text-sm sm:w-2/3 break-words whitespace-normal leading-snug">${val || '-'}</span>
            </div>
        `;

        const alamatLengkap = `${d.siswa?.alamat || ''}, RT ${d.siswa?.rt || '-'}/${d.siswa?.rw || '-'}, Kel. ${d.siswa?.kelurahan || '-'}, Kec. ${d.siswa?.kecamatan || '-'}`;

        const html = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div>
                    <h4 class="font-bold text-base sm:text-lg border-b pb-2 mb-3 dark:border-slate-700 text-primary-700 dark:text-primary-400"><i class="fa-solid fa-user-graduate mr-2"></i> Data Siswa</h4>
                    <div class="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl">
                        ${renderRow('No. Pendaftaran', d.no_pendaftaran)}
                        ${renderRow('NIK', d.siswa?.nik)}
                        ${renderRow('Nama Lengkap', d.siswa?.nama)}
                        ${renderRow('Tempat, Tgl Lahir', `${d.siswa?.tempat_lahir}, ${d.siswa?.tgl_lahir}`)}
                        ${renderRow('Jenis Kelamin', d.siswa?.jk)}
                        ${renderRow('Agama', d.siswa?.agama)}
                        ${renderRow('Alamat Lengkap', alamatLengkap)}
                    </div>

                    <h4 class="font-bold text-base sm:text-lg border-b pb-2 mb-3 mt-6 dark:border-slate-700 text-primary-700 dark:text-primary-400"><i class="fa-solid fa-file-lines mr-2"></i> Berkas Upload</h4>
                    <div class="flex flex-wrap gap-2 sm:gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl">
                        ${d.berkas?.kk ? `<a href="${d.berkas.kk}" target="_blank" class="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-xl text-xs sm:text-sm font-medium transition-colors"><i class="fa-solid fa-download mr-1"></i> KK</a>` : '<span class="text-slate-400 text-sm">KK (-)</span>'}
                        ${d.berkas?.akta ? `<a href="${d.berkas.akta}" target="_blank" class="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-xl text-xs sm:text-sm font-medium transition-colors"><i class="fa-solid fa-download mr-1"></i> Akta</a>` : '<span class="text-slate-400 text-sm">Akta (-)</span>'}
                        ${d.berkas?.foto ? `<a href="${d.berkas.foto}" target="_blank" class="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-xl text-xs sm:text-sm font-medium transition-colors"><i class="fa-solid fa-image mr-1"></i> Foto</a>` : '<span class="text-slate-400 text-sm">Foto (-)</span>'}
                    </div>
                </div>
                
                <div>
                    <h4 class="font-bold text-base sm:text-lg border-b pb-2 mb-3 dark:border-slate-700 text-primary-700 dark:text-primary-400"><i class="fa-solid fa-people-roof mr-2"></i> Data Orang Tua</h4>
                    <div class="bg-blue-50/50 dark:bg-slate-900/40 p-4 rounded-2xl mb-4 border border-blue-100 dark:border-slate-700/50">
                        <p class="font-bold text-blue-700 dark:text-blue-400 mb-2 pb-1 border-b border-blue-200 dark:border-slate-700">Ayah</p>
                        ${renderRow('Nama Ayah', d.ortu?.ayah?.nama)}
                        ${renderRow('Pekerjaan', `${d.ortu?.ayah?.pek || '-'} (${d.ortu?.ayah?.peng || '-'})`)}
                        ${renderRow('No. HP', d.ortu?.ayah?.hp)}
                    </div>
                    <div class="bg-pink-50/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-pink-100 dark:border-slate-700/50">
                        <p class="font-bold text-pink-600 dark:text-pink-400 mb-2 pb-1 border-b border-pink-200 dark:border-slate-700">Ibu</p>
                        ${renderRow('Nama Ibu', d.ortu?.ibu?.nama)}
                        ${renderRow('Pekerjaan', d.ortu?.ibu?.pek)}
                        ${renderRow('No. HP', d.ortu?.ibu?.hp)}
                    </div>

                    <h4 class="font-bold text-base sm:text-lg border-b pb-2 mb-3 mt-6 dark:border-slate-700 text-primary-700 dark:text-primary-400"><i class="fa-solid fa-clipboard-check mr-2"></i> Aksi Admin</h4>
                    <div class="bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700/50 p-4 sm:p-5 rounded-2xl">
                        <label class="block text-sm font-bold text-yellow-800 dark:text-yellow-400 mb-3">Ubah Status Pendaftaran:</label>
                        <div class="flex flex-col sm:flex-row gap-3">
                            <select id="updateStatus_${d.id}" class="w-full px-4 py-2.5 rounded-xl border border-yellow-300 dark:border-yellow-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-yellow-400 text-sm">
                                <option value="Menunggu Verifikasi" ${d.status === 'Menunggu Verifikasi' ? 'selected' : ''}>Menunggu Verifikasi</option>
                                <option value="Diverifikasi" ${d.status === 'Diverifikasi' ? 'selected' : ''}>Terima / Diverifikasi</option>
                                <option value="Cadangan" ${d.status === 'Cadangan' ? 'selected' : ''}>Cadangan</option>
                                <option value="Ditolak" ${d.status === 'Ditolak' ? 'selected' : ''}>Tolak</option>
                            </select>
                            <button onclick="app.updateStatus('${d.id}')" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl hover:bg-primary-700 font-medium shrink-0 shadow-md">Simpan</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('m_body').innerHTML = html;
        
        const modal = document.getElementById('modalDetail');
        const content = document.getElementById('modalContent');
        if(modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                content.classList.remove('scale-95');
            }, 10);
        }
    },

    closeModal: () => {
        const modal = document.getElementById('modalDetail');
        const content = document.getElementById('modalContent');
        if(modal) {
            modal.classList.add('opacity-0');
            content.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }, 300);
        }
    },

    updateStatus: async (id) => {
        const newStatus = document.getElementById(`updateStatus_${id}`).value;
        try {
            const { error } = await supabase.from(TABLE_NAME).update({ status: newStatus }).eq('id', id);
            if(error) throw error;
            app.showToast('Status berhasil diupdate', 'success');
            app.closeModal();
        } catch(e) { app.showToast('Gagal update: ' + e.message, 'error'); }
    },

    deleteData: async (id) => {
        if(confirm("Yakin ingin menghapus data siswa ini secara permanen?")) {
            try {
                const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
                if(error) throw error;
                app.showToast('Data berhasil dihapus', 'success');
            } catch(e) { app.showToast('Gagal menghapus: ' + e.message, 'error'); }
        }
    },

    showToast: (msg, type = 'success') => {
        const toast = document.createElement('div');
        const color = type === 'success' ? 'bg-emerald-500' : (type === 'error' ? 'bg-red-500' : 'bg-gray-800');
        const icon = type === 'success' ? 'fa-check' : 'fa-triangle-exclamation';
        
        toast.className = `${color} text-white px-5 sm:px-6 py-3.5 rounded-2xl shadow-xl transform transition-all duration-300 translate-y-10 opacity-0 flex items-center max-w-sm ml-auto pointer-events-auto text-sm sm:text-base`;
        toast.innerHTML = `<div class="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center mr-3 shrink-0"><i class="fa-solid ${icon}"></i></div> <span>${msg}</span>`;
        
        const container = document.getElementById('toastContainer');
        if(container) {
            container.appendChild(toast);
            setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
            setTimeout(() => {
                toast.classList.add('translate-y-10', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }
    },

    setupTheme: () => {
        const html = document.documentElement;
        const toggles = document.querySelectorAll('#themeToggle, #themeToggleMobile');
        
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            html.classList.add('dark');
        } else { html.classList.remove('dark'); }

        const switchTheme = () => {
            html.classList.toggle('dark');
            localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
        };

        toggles.forEach(t => t.addEventListener('click', switchTheme));
        const mobileBtn = document.getElementById('mobileMenuBtn');
        if(mobileBtn) mobileBtn.addEventListener('click', app.toggleMobileMenu);
    }
};

document.addEventListener('DOMContentLoaded', app.init);