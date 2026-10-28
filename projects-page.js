const projectsPageList = document.querySelector('.projects-page-list');

async function loadAllProjects() {
    if (!projectsPageList) return;

    try {
        const projects = await fetchPortfolioProjects();
        const fragment = document.createDocumentFragment();

        if (projects.length === 0) {
            const message = document.createElement('p');
            message.textContent = 'هنوز پروژه‌ای ثبت نشده است.';
            fragment.appendChild(message);
            projectsPageList.replaceChildren(fragment);
            return;
        }

        projects.forEach((project) => {
            const projectUrl = project.project_url;
let validUrl = '';

if (projectUrl) {
    try {
        const url = new URL(projectUrl, window.location.href);

        if (
            url.origin === window.location.origin &&
            (url.protocol === 'http:' || url.protocol === 'https:')
        ) {
            validUrl = url.href;
        }
    } catch {
        validUrl = '';
    }
}

            const card = document.createElement(
                validUrl ? 'a' : 'article'
            );

            card.className = 'projects-page-card';

            if (validUrl) {
                card.href = validUrl;
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
            }

            const image = document.createElement('img');
            image.src = project.image_url ||
                'portfolio_images/project-04-restaurant.png';
            image.alt = project.title || 'نمونه‌کار';
            image.loading = 'lazy';

            image.addEventListener('error', () => {
                image.remove();
            }, { once: true });

            const info = document.createElement('div');
            info.className = 'projects-page-info';

            const title = document.createElement('h2');
            title.textContent = project.title || 'بدون عنوان';

            const description = document.createElement('p');
            const technologies = Array.isArray(project.technologies)
                ? project.technologies.join('، ')
                : project.technologies;

            description.textContent =
                project.description || technologies || '';

            const linkText = document.createElement('span');
            linkText.textContent = validUrl
                ? 'مشاهده پروژه'
                : 'جزئیات پروژه';

            info.append(title, description, linkText);
            card.append(image, info);
            fragment.appendChild(card);
        });

        projectsPageList.replaceChildren(fragment);

    } catch (error) {
        // در صورت خطا، پروژه‌های قبلی صفحه حذف نمی‌شوند.
        console.error('خطا در دریافت فهرست پروژه‌ها:', error);
    }
}

loadAllProjects();
