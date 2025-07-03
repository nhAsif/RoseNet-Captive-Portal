document.addEventListener('DOMContentLoaded', function() {
    const loginView = document.getElementById('loginView');
    const adminView = document.getElementById('adminView');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const addVoucherForm = document.getElementById('addVoucherForm');
    const voucherList = document.getElementById('voucherList');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const passwordChangeMessage = document.getElementById('passwordChangeMessage');
    const logoutButton = document.getElementById('logoutButton');

    // Check if already logged in (e.g. cookie exists)
    // A simple check without verifying the cookie's validity on the server side for this example.
    if (document.cookie.includes('voucher-admin-session=admin-is-logged-in')) {
        showAdminView();
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const password = document.getElementById('password').value;
        loginError.textContent = '';

        try {
            const response = await fetch('/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Login failed');
            }
            showAdminView();
        } catch (error) {
            loginError.textContent = error.message;
        }
    });

    addVoucherForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const duration = parseInt(document.getElementById('duration').value, 10);
        const durationUnit = document.getElementById('durationUnit').value;
        const code = document.getElementById('code').value.trim();
        const voucherName = document.getElementById('voucherName').value.trim();
        const isReusable = document.getElementById('isReusable').checked;

        let durationInMinutes = duration;
        if (durationUnit === 'days') {
            durationInMinutes = duration * 24 * 60;
        } else if (durationUnit === 'months') {
            durationInMinutes = duration * 30 * 24 * 60; // Assuming 30 days per month
        }

        const voucherData = {
            duration: durationInMinutes,
            is_reusable: isReusable
        };
        if (code) {
            voucherData.code = code;
        }
        if (voucherName) {
            voucherData.name = voucherName;
        }

        try {
            const response = await fetch('/admin/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(voucherData)
            });
            const newVoucher = await response.json();
            if (!response.ok) {
                throw new Error(newVoucher.error || 'Failed to add voucher');
            }
            addVoucherToTable(newVoucher);
            addVoucherForm.reset();
        } catch (error) {
            alert(error.message);
        }
    });

    function showAdminView() {
        loginView.classList.add('hidden');
        adminView.classList.remove('hidden');
        loadVouchers();
    }

    changePasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        passwordChangeMessage.textContent = '';

        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword === '') {
            passwordChangeMessage.textContent = 'New password cannot be empty.';
            return;
        }

        if (newPassword !== confirmNewPassword) {
            passwordChangeMessage.textContent = 'New passwords do not match.';
            return;
        }

        try {
            const response = await fetch('/admin/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to change password');
            }

            passwordChangeMessage.style.color = 'var(--primary)';
            passwordChangeMessage.textContent = 'Password changed successfully!';
            changePasswordForm.reset();
        } catch (error) {
            passwordChangeMessage.style.color = 'var(--error)';
            passwordChangeMessage.textContent = error.message;
        }
    });

    async function loadVouchers() {
        try {
            const response = await fetch('/admin/vouchers');
             if (response.status === 401) {
                // Session expired or invalid, redirect to login
                loginView.classList.remove('hidden');
                adminView.classList.add('hidden');
                // Clear the invalid cookie
                document.cookie = "voucher-admin-session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                return;
            }
            const vouchers = await response.json();
            if (!response.ok) {
                throw new Error(vouchers.error || 'Failed to load vouchers');
            }
            voucherList.innerHTML = '';
            if (vouchers) {
                vouchers.forEach(addVoucherToTable);
            }
        } catch (error) {
            alert(error.message);
        }
    }

    function addVoucherToTable(voucher) {
        const row = document.createElement('tr');
        row.className = 'table-row';
        row.setAttribute('data-id', voucher.id);

        let status = '';
        if (voucher.is_used) {
            const startTime = new Date(voucher.start_time);
            const expires = new Date(startTime.getTime() + voucher.duration * 60000);
            if (new Date() > expires) {
                status = '<span class="text-gray-500">Expired</span>';
            } else {
                status = `<span class="text-green-400">Active (expires ${expires.toLocaleTimeString()})</span>`;
            }
        } else {
            status = '<span class="text-yellow-400">Not Used</span>';
        }

        const usedBy = voucher.is_used ? `${voucher.user_mac || 'N/A'} (${voucher.user_ip || 'N/A'})` : '—';
        
        row.innerHTML = `
            <td class="p-3 font-mono">${voucher.name || 'N/A'}</td>
            <td class="p-3 font-mono">${voucher.code}</td>
            <td class="p-3">${voucher.duration} min</td>
            <td class="p-3">${status}</td>
            <td class="p-3 font-mono">${usedBy}</td>
            <td class="p-3">
                <button class="px-3 py-1 text-sm font-bold rounded-md btn-danger" onclick="deleteVoucher(${voucher.id})">Delete</button>
            </td>
        `;
        voucherList.prepend(row); // Add new vouchers to the top
    }

    window.deleteVoucher = async function(id) {
        if (!confirm('Are you sure you want to delete this voucher?')) {
            return;
        }

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
    }

    logoutButton.addEventListener('click', async function() {
        try {
            const response = await fetch('/admin/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                window.location.reload(); // Reload to show login page
            } else {
                const data = await response.json();
                alert(data.error || 'Logout failed');
            }
        } catch (error) {
            alert('Error during logout: ' + error.message);
        }
    });
});
