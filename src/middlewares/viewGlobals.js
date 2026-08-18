const icons = {
    dashboard: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2 7-7 7 7 2 2M5 10v10h4v-6h6v6h4V10"/>',
    bookings: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6M7 3h6l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2zm6 0v5h5"/>',
    conflict: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>',
    workers: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m3-10a4 4 0 100-8 4 4 0 000 8zm9 1a3 3 0 100-6 3 3 0 000 6"/>',
    mitras: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20H7a4 4 0 014-4h2a4 4 0 014 4zM12 12a4 4 0 100-8 4 4 0 000 8zm7 8v-1a4 4 0 00-2-3.5"/>',
    employees: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20H7v-2a5 5 0 0110 0v2zM12 12a4 4 0 100-8 4 4 0 000 8z"/>',
    leave: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3M5 11h14M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2zm3 10l2 2 4-4"/>',
    naka: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.7 16.7L13.4 21a2 2 0 01-2.8 0l-4.3-4.3a8 8 0 1111.4 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/>',
    skill: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1l2-1.5-2-3.5-2.5 1a8 8 0 00-1.7-1L14.8 3h-4l-.4 2.7a8 8 0 00-1.7 1L6.2 5.8l-2 3.5 2 1.5a7.4 7.4 0 000 2.1l-2 1.5 2 3.5 2.5-1a8 8 0 001.7 1l.4 2.7h4l.4-2.7a8 8 0 001.7-1l2.5 1 2-3.5-2-1.5a7.4 7.4 0 00.1-1z"/>',
    city: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 21h16M6 21V9l6-4 6 4v12M9 12h1m4 0h1m-6 4h1m4 0h1"/>',
    state: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.5 9h17M3.5 15h17M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    settings: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4M6 18v2m0-2a2 2 0 100-4m0 4a2 2 0 110-4m0 0V4m12 14v2m0-2a2 2 0 100-4m0 4a2 2 0 110-4m0 0V4"/>',
};

const viewGlobals = (req, res, next) => {
    res.locals.currentPath = req.originalUrl;

    if (!res.locals.user) {
        res.locals.user = null;
        res.locals.userRole = null;
    }

    const navGroups = [
        {
            name: null,
            items: [
                { name: 'Dashboard', path: '/admin/dashboard', icon: icons.dashboard, roles: ['superadmin', 'admin', 'employee'] },
            ],
        },
        {
            name: 'Operations',
            items: [
                { name: 'Bookings', path: '/admin/bookings', icon: icons.bookings, roles: ['superadmin', 'admin', 'employee'] },
                { name: 'Conflicts', path: '/admin/conflicts', icon: icons.conflict, roles: ['superadmin', 'admin', 'employee'] },
            ],
        },
        {
            name: 'Workforce',
            items: [
                { name: 'Workers', path: '/admin/workers', icon: icons.workers, roles: ['superadmin', 'admin', 'employee'] },
                { name: 'Mitras', path: '/admin/mitras', icon: icons.mitras, roles: ['superadmin', 'admin'] },
                { name: 'Employees', path: '/admin/employees', icon: icons.employees, roles: ['superadmin', 'admin'] },
                { name: 'Leave Management', path: '/admin/leaves', icon: icons.leave, roles: ['superadmin', 'admin'], exact: true },
                { name: 'My Leaves', path: '/admin/leaves/my', icon: icons.leave, roles: ['employee'] },
            ],
        },
        {
            name: 'Masters',
            items: [
                { name: 'Nakas', path: '/admin/nakas', icon: icons.naka, roles: ['superadmin', 'admin'] },
                { name: 'Skills', path: '/admin/skills', icon: icons.skill, roles: ['superadmin', 'admin'] },
                { name: 'Cities', path: '/admin/cities', icon: icons.city, roles: ['superadmin', 'admin'] },
                { name: 'States', path: '/admin/states', icon: icons.state, roles: ['superadmin', 'admin'] },
            ],
        },
        {
            name: 'Settings',
            items: [
                { name: 'Booking Settings', path: '/admin/booking-settings', icon: icons.settings, roles: ['superadmin', 'admin'] },
            ],
        },
    ];

    const pathOnly = req.path || req.originalUrl.split('?')[0];
    const allItems = navGroups.flatMap((group) => group.items);
    const matched = allItems
        .filter((item) => item.exact ? pathOnly === item.path : pathOnly.startsWith(item.path))
        .sort((a, b) => b.path.length - a.path.length)[0];

    res.locals.navGroups = navGroups;
    res.locals.navItems = allItems;
    res.locals.pageTitle = matched?.name || 'Control Center';

    next();
};

module.exports = viewGlobals;
