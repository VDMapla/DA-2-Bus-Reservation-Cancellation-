let resSys = null;
let currentRouteId = null;
let selectedSeats = [];
let routeFare = 0;
let chartInstance = null;

const App = {
    init: function() {
        console.log("WASM Module Initialized.");
        FS.mkdir('/data');
        FS.mount(IDBFS, {}, '/data');
        
        // Sync from IndexedDB into WASM memory
        FS.syncfs(true, (err) => {
            if (err) console.error("IDBFS Sync Error:", err);
            
            // Instantiate AFTER sync so it reads the files if they exist
            resSys = new Module.ReservationSystem();
            
            document.getElementById('loader').style.opacity = '0';
            setTimeout(() => document.getElementById('loader').style.display = 'none', 500);
            
            this.loadDashboard();
        });
    },

    saveState: function() {
        // Sync WASM memory back to IndexedDB
        FS.syncfs(false, (err) => {
            if (err) console.error("IDBFS Save Error:", err);
            else console.log("State persistently saved!");
        });
    },

    showToast: function(msg, isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = `toast show ${isError ? 'error' : ''}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    loadDashboard: function() {
        const routesJson = resSys.getRoutesJSON();
        const routes = JSON.parse(routesJson);
        
        const reportsJson = resSys.getReportsJSON();
        const reports = JSON.parse(reportsJson);
        let totalRev = 0;
        let totalTix = 0;
        reports.forEach(d => { totalRev += d.revenue; totalTix += d.tickets; });
        
        document.getElementById('dash-tot-rev').textContent = '₹' + totalRev;
        document.getElementById('dash-tot-tickets').textContent = totalTix;
        document.getElementById('dash-tot-routes').textContent = routes.length;

        const container = document.getElementById('routes-container');
        container.innerHTML = '';

        routes.forEach(route => {
            const seatsAvail = route.seats.filter(s => s === 0).length;
            const card = document.createElement('div');
            card.className = 'route-card';
            card.onclick = () => this.openBooking(route.id, route.from, route.to, route.fare, route.seats);
            card.innerHTML = `
                <div class="route-header">
                    <span class="route-id"><i class="fa-solid fa-ticket"></i> ${route.id}</span>
                    <span class="route-fare"><i class="fa-solid fa-indian-rupee-sign"></i>${route.fare}</span>
                </div>
                <div class="route-path"><i class="fa-solid fa-location-dot" style="color:var(--primary-red);font-size:18px;"></i> ${route.from} <i class="fa-solid fa-arrow-right" style="color:var(--text-muted);font-size:14px;"></i> ${route.to}</div>
                <div class="route-meta">
                    <span><i class="fa-solid fa-chair"></i> ${seatsAvail} Seats Available</span>
                    <span><i class="fa-solid fa-users"></i> Cap: ${route.capacity}</span>
                </div>
            `;
            container.appendChild(card);
        });
    },

    loadMyTickets: function() {
        const container = document.getElementById('my-tickets-container');
        container.innerHTML = '';
        let myTickets = JSON.parse(localStorage.getItem('myTickets') || '[]');
        
        if (myTickets.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size: 18px;">You have no booked tickets yet.</p>';
            return;
        }

        myTickets.forEach(id => {
            const resStr = resSys.searchTicket(id);
            const res = JSON.parse(resStr);
            if (!res.error) {
                const card = document.createElement('div');
                card.className = 'route-card';
                card.style.cursor = 'default';
                card.innerHTML = `
                    <div class="route-header">
                        <span class="route-id"><i class="fa-solid fa-ticket"></i> ${res.ticketID}</span>
                        <span class="route-fare"><i class="fa-solid fa-indian-rupee-sign"></i>${res.totalAmount}</span>
                    </div>
                    <div class="route-path" style="font-size: 18px; margin-bottom: 15px;">Route: <span class="gold-text">${res.routeID}</span></div>
                    <div class="route-meta" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                        <span><i class="fa-solid fa-user"></i> ${res.name}</span>
                        <span><i class="fa-solid fa-chair"></i> Seats: ${res.seats.join(', ')}</span>
                    </div>
                `;
                container.appendChild(card);
            }
        });
    },

    openBooking: function(id, from, to, fare, seats) {
        currentRouteId = id;
        routeFare = fare;
        selectedSeats = [];
        
        document.getElementById('modal-route-title').textContent = `Book ${from} ➔ ${to}`;
        this.updateSummary();
        
        const grid = document.getElementById('seat-grid');
        grid.innerHTML = '';
        
        seats.forEach((status, idx) => {
            const seatNum = idx + 1;
            const seatEl = document.createElement('div');
            seatEl.className = 'seat ' + (status === 1 ? 'booked' : 'available');
            seatEl.textContent = seatNum;
            
            if (status === 0) {
                seatEl.onclick = () => this.toggleSeat(seatNum, seatEl);
            }
            grid.appendChild(seatEl);
        });

        document.getElementById('passenger-name').value = '';
        document.getElementById('booking-modal').classList.remove('hidden');
    },

    toggleSeat: function(num, el) {
        const idx = selectedSeats.indexOf(num);
        if (idx === -1) {
            selectedSeats.push(num);
            el.classList.add('selected');
            el.classList.remove('available');
        } else {
            selectedSeats.splice(idx, 1);
            el.classList.remove('selected');
            el.classList.add('available');
        }
        this.updateSummary();
    },

    updateSummary: function() {
        document.getElementById('summary-seats').textContent = selectedSeats.length > 0 ? selectedSeats.join(', ') : '0';
        document.getElementById('summary-total').textContent = selectedSeats.length * routeFare;
    },

    closeModal: function() {
        document.getElementById('booking-modal').classList.add('hidden');
    },

    confirmBooking: function() {
        const name = document.getElementById('passenger-name').value.trim();
        if (!name) {
            this.showToast("Please enter passenger name.", true);
            return;
        }
        if (selectedSeats.length === 0) {
            this.showToast("Please select at least one seat.", true);
            return;
        }

        const vec = new Module.VectorInt();
        selectedSeats.forEach(s => vec.push_back(s));
        
        const resStr = resSys.bookTicket(name, currentRouteId, vec);
        vec.delete(); // Free C++ memory

        const res = JSON.parse(resStr);
        if (res.error) {
            this.showToast(res.error, true);
        } else {
            let myTickets = JSON.parse(localStorage.getItem('myTickets') || '[]');
            if (!myTickets.includes(res.ticketID)) {
                myTickets.push(res.ticketID);
                localStorage.setItem('myTickets', JSON.stringify(myTickets));
            }
            this.saveState(); // Persist to IndexedDB
            this.showToast(`Success! Ticket ID: ${res.ticketID}`);
            this.closeModal();
            this.loadDashboard(); // refresh dashboard layout
        }
    },

    searchTicket: function() {
        const id = document.getElementById('search-id').value.trim();
        if (!id) return;

        const resStr = resSys.searchTicket(id);
        const res = JSON.parse(resStr);
        const out = document.getElementById('search-result');
        out.classList.remove('hidden');

        if (res.error) {
            out.innerHTML = `<p style="color:var(--primary-red)">${res.error}</p>`;
        } else {
            out.innerHTML = `
                <h3 style="margin-bottom:10px">Ticket Details</h3>
                <p><strong>ID:</strong> <span class="gold-text">${res.ticketID}</span></p>
                <p><strong>Name:</strong> ${res.name}</p>
                <p><strong>Route:</strong> ${res.routeID}</p>
                <p><strong>Seats:</strong> ${res.seats.join(', ')}</p>
                <p><strong>Total Paid:</strong> ₹${res.totalAmount}</p>
            `;
        }
    },

    cancelTicket: function() {
        const id = document.getElementById('cancel-id').value.trim();
        if (!id) return;

        const resStr = resSys.cancelTicket(id);
        const res = JSON.parse(resStr);
        if (res.error) {
            this.showToast(res.error, true);
        } else {
            let myTickets = JSON.parse(localStorage.getItem('myTickets') || '[]');
            myTickets = myTickets.filter(t => t !== id);
            localStorage.setItem('myTickets', JSON.stringify(myTickets));
            this.saveState(); // Persist to IndexedDB
            this.showToast("Ticket Cancelled Successfully.");
            document.getElementById('cancel-id').value = '';
            this.loadDashboard();
            if(document.getElementById('my-tickets').classList.contains('active')) {
                this.loadMyTickets();
            }
        }
    },

    loadReports: function() {
        const dataStr = resSys.getReportsJSON();
        const data = JSON.parse(dataStr);

        let maxT = -1;
        let topRoute = '';
        const labels = [];
        const revenues = [];
        
        data.forEach(d => {
            labels.push(d.routeID);
            revenues.push(d.revenue);
            if(d.tickets > maxT && d.tickets > 0) { maxT = d.tickets; topRoute = d.routeID; }
        });

        document.getElementById('top-route-display').textContent = topRoute || 'N/A';

        const ctx = document.getElementById('revenueChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (₹)',
                    data: revenues,
                    backgroundColor: '#D31122',
                    borderColor: '#b00f1c',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#f4f4f5' } }
                },
                scales: {
                    x: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }
};

window.app = App;

// Global exported Emscripten setup
var Module = {
    onRuntimeInitialized: function() {
        App.init();
    }
};

// UI Toggling
function showSection(id) {
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-' + id).classList.add('active');

    if (id === 'reports') {
        App.loadReports();
    } else if (id === 'dashboard') {
        App.loadDashboard();
    } else if (id === 'my-tickets') {
        App.loadMyTickets();
    }
}
