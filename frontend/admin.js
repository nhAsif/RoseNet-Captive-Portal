document.addEventListener('DOMContentLoaded', function() {
    feather.replace();

    // --- DOM Elements ---
    const loginView = document.getElementById('loginView');
    const appView = document.getElementById('app');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutButton = document.getElementById('logoutButton');
    const voucherList = document.getElementById('voucherList');
    const addVoucherForm = document.getElementById('addVoucherForm');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const passwordChangeMessage = document.getElementById('passwordChangeMessage');
    const settingsButton = document.getElementById('settingsButton');

    // Chart variables
    let voucherSalesChart, voucherStatusChart, trafficByZoneChart;
    
    // Set initial state explicitly to prevent flashes of content
    appView.style.display = 'none';
    loginView.style.display = 'flex';

    // --- View Management ---
    function showAppView() {
        appView.style.display = 'flex';
        loginView.style.display = 'none';
        loadInitialData();
        setupNavLinks();
    }

    function showLoginView() {
        loginView.style.display = 'flex';
        appView.style.display = 'none';
    }
    
    // --- Navigation ---
    function setupNavLinks() {
        const navLinks = document.querySelectorAll('.nav-link');
        const contentViews = document.querySelectorAll('.content-view');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');

                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                contentViews.forEach(v => v.classList.remove('active'));
                document.getElementById(view).classList.add('active');

                // Load data for the specific view
                if (view === 'vouchers') {
                    loadVouchers();
                } else if (view === 'dashboard') {
                    loadDashboardData();
                }
            });
        });

        settingsButton.addEventListener('click', () => {
            const view = 'settings';
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            contentViews.forEach(v => v.classList.remove('active'));
            document.getElementById(view).classList.add('active');
        });
    }

    // --- Data Loading ---
    function loadInitialData() {
        loadDashboardData();
    }

    // --- API & Data Handling ---
    async function handleLogin(e) {
        e.preventDefault();
        const password = document.getElementById('password').value;
        loginError.textContent = '';

        try {
            const response = await fetch('/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Login failed');
            }
            showAppView();
        } catch (error) {
            loginError.textContent = error.message;
        }
    }
    
    async function handleLogout() {
         try {
            await fetch('/admin/logout', { method: 'POST' });
        } finally {
            showLoginView();
        }
    }

    // --- Dashboard ---
    async function loadDashboardData() {
        try {
            const response = await fetch('/admin/stats');
            if (response.status === 401) { return handleLogout(); }
            if (!response.ok) throw new Error('Failed to load dashboard stats');
            
            const data = await response.json();

            document.getElementById('total-revenue').textContent = `$${(data.total_revenue || 0).toLocaleString()}`;
            document.getElementById('revenue-trend').textContent = `+${(data.revenue_trend || 0)}%`;
            document.getElementById('active-vouchers').textContent = data.active_vouchers || 0;
            document.getElementById('data-consumed').textContent = `${(data.data_consumed || 0)} GB`;
            document.getElementById('live-users').textContent = data.live_users || 0;

            const topPlansList = document.getElementById('top-plans-list');
            topPlansList.innerHTML = '';
            if (data.top_plans && data.top_plans.length > 0) {
                 topPlansList.innerHTML = data.top_plans.map(plan => `<li>${plan.name} (${plan.sales} sold)</li>`).join('');
            } else {
                topPlansList.innerHTML = '<li>No plan sales data available.</li>';
            }

            if (data.sales_stats) renderVoucherSalesChart(data.sales_stats);
            if (data.voucher_status) renderVoucherStatusChart(data.voucher_status);
            if (data.traffic_by_zone) renderTrafficByZoneChart(data.traffic_by_zone);

        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        }
    }

    // --- Voucher Management ---
    async function loadVouchers() {
        try {
            const response = await fetch('/admin/vouchers');
            if (response.status === 401) { return handleLogout(); }
            if (!response.ok) throw new Error('Failed to load vouchers');
            
            const vouchers = await response.json();
            voucherList.innerHTML = '';
            if (vouchers) {
                vouchers.sort((a, b) => b.id - a.id).forEach(addVoucherToTable);
            }
        } catch (error) {
            console.error(error.message);
        }
    }

    function addVoucherToTable(voucher) {
        const row = document.createElement('tr');
        row.setAttribute('data-id', voucher.id);

        let status, usedBy;
        if (voucher.is_used) {
            const startTime = new Date(voucher.start_time);
            const expires = new Date(startTime.getTime() + voucher.duration * 60000);
            if (new Date() > expires) {
                status = '<span class="status-chip status-expired">Expired</span>';
            } else {
                status = `<span class="status-chip status-active">Active</span>`;
            }
            usedBy = voucher.user_mac || 'N/A';
        } else {
            status = '<span class="status-chip status-unused">Unused</span>';
            usedBy = '—';
        }

        row.innerHTML = `
            <td>${voucher.name || 'N/A'}</td>
            <td>${voucher.code}</td>
            <td>${formatDuration(voucher.duration)}</td>
            <td>$${(voucher.price || 0).toFixed(2)}</td>
            <td>${status}</td>
            <td>${usedBy}</td>
            <td>
                <button class="action-button" onclick="deleteVoucher(${voucher.id})">
                    <i data-feather="trash-2"></i>
                </button>
            </td>
        `;
        voucherList.appendChild(row);
        feather.replace();
    }
    
    async function handleAddVoucher(e) {
        e.preventDefault();
        const duration = parseInt(document.getElementById('duration').value, 10);
        const durationUnit = document.getElementById('durationUnit').value;
        const code = document.getElementById('code').value.trim();
        const voucherName = document.getElementById('voucherName').value.trim();
        const price = parseFloat(document.getElementById('price').value) || 0;
        const isReusable = document.getElementById('isReusable').checked;

        let durationInMinutes = duration;
        if (durationUnit === 'days') durationInMinutes = duration * 24 * 60;
        else if (durationUnit === 'months') durationInMinutes = duration * 30 * 24 * 60;

        const voucherData = {
            duration: durationInMinutes,
            is_reusable: isReusable,
            price: price,
            name: voucherName,
            ...(code && { code })
        };

        try {
            const response = await fetch('/admin/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(voucherData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to add voucher');
            }
            
            await response.json();
            loadVouchers();
            addVoucherForm.reset();

        } catch (error) {
            alert(error.message);
        }
    }

    window.deleteVoucher = async function(id) {
        if (!confirm('Are you sure you want to delete this voucher?')) return;

        try {
            const response = await fetch('/admin/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete voucher');
            }
            document.querySelector(`tr[data-id='${id}']`).remove();
        } catch (error) {
            alert(error.message);
        }
    };

    // --- Settings ---
    async function handleChangePassword(e) {
        e.preventDefault();
        passwordChangeMessage.textContent = '';
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNewPassword) {
            passwordChangeMessage.textContent = 'New passwords do not match.';
            passwordChangeMessage.style.color = '#EF4444';
            return;
        }

        try {
            const response = await fetch('/admin/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to change password');
            
            passwordChangeMessage.textContent = 'Password changed successfully!';
            passwordChangeMessage.style.color = '#10B981';
            changePasswordForm.reset();
        } catch (error) {
            passwordChangeMessage.textContent = error.message;
            passwordChangeMessage.style.color = '#EF4444';
        }
    }

    // --- Chart Rendering ---
    function renderVoucherSalesChart(data) {
        const ctx = document.getElementById('voucherSalesChart').getContext('2d');
        if (voucherSalesChart) voucherSalesChart.destroy();
        voucherSalesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Voucher Sales',
                    data: data.data,
                    backgroundColor: 'rgba(144, 202, 249, 0.6)',
                    borderColor: 'rgba(144, 202, 249, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderVoucherStatusChart(data) {
        const ctx = document.getElementById('voucherStatusChart').getContext('2d');
        if (voucherStatusChart) voucherStatusChart.destroy();
        voucherStatusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Expired', 'Unused'],
                datasets: [{
                    data: [data.active, data.expired, data.unused],
                    backgroundColor: ['#A8D8EA', '#F4B8C3', '#F7E4A4'],
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    function renderTrafficByZoneChart(data) {
        const ctx = document.getElementById('trafficByZoneChart').getContext('2d');
        if (trafficByZoneChart) trafficByZoneChart.destroy();
        trafficByZoneChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Traffic',
                    data: data.data,
                    backgroundColor: 'rgba(144, 202, 249, 0.2)',
                    borderColor: 'rgba(144, 202, 249, 1)',
                    pointBackgroundColor: 'rgba(144, 202, 249, 1)',
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        angleLines: { color: '#E5E7EB' },
                        grid: { color: '#E5E7EB' },
                        pointLabels: { color: '#6B7280' },
                        ticks: { backdropColor: 'transparent' }
                    }
                }
            }
        });
    }
    
    // --- Utility ---
    function formatDuration(minutes) {
        if (minutes < 60) return `${minutes} min`;
        if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hours`;
        return `${(minutes / 1440).toFixed(1)} days`;
    }

    // --- Initialization ---
    async function initializeApp() {
        try {
            // Use a lightweight endpoint to check for a valid session
            const response = await fetch('/admin/stats'); 
            if (response.ok) {
                showAppView();
            } else { // Catches 401 Unauthorized
                showLoginView();
            }
        } catch (e) { // Catches network errors
            showLoginView();
        }
    }

    loginForm.addEventListener('submit', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    addVoucherForm.addEventListener('submit', handleAddVoucher);
    changePasswordForm.addEventListener('submit', handleChangePassword);
    
    initializeApp();
});
