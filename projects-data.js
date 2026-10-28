async function fetchPortfolioProjects() {
    const response = await fetch('/api/projects', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        },
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error('دریافت پروژه‌ها ناموفق بود.');
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.projects)) {
        throw new Error('ساختار اطلاعات پروژه‌ها معتبر نیست.');
    }

    return data.projects;
}
