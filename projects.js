const projectsList = document.querySelector('.projects-list');

async function loadHomeProjects() {
    if (!projectsList) return;

    try {
        const projects = await fetchPortfolioProjects();

        // نمایش حداکثر ۶ پروژه در صفحه اصلی
        projectsList.replaceChildren();

        if (projects.length === 0) {
            const message = document.createElement('p');
            message.textContent = 'هنوز پروژه‌ای ثبت نشده است.';
            projectsList.appendChild(message);
            return;
        }

        projects.slice(0, 6).forEach((project) => {
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

            const card = document.createElement(validUrl ? 'a' : 'article');
            card.className = 'project-card';

            if (validUrl) {
                card.href = validUrl;
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
            }

            const image = document.createElement('img');
            image.src = project.image_url || 'portfolio_images/project-04-restaurant.png';
            image.alt = project.title || 'نمونه‌کار';
            image.loading = 'lazy';

            image.addEventListener('error', () => {
                image.remove();
            }, { once: true });

            const info = document.createElement('div');
            info.className = 'project-info';

            const title = document.createElement('h3');
            title.textContent = project.title || 'بدون عنوان';

            const description = document.createElement('p');
            const technologies = Array.isArray(project.technologies)
                ? project.technologies.join('، ')
                : project.technologies;

            description.textContent =
                project.description || technologies || '';

            const linkText = document.createElement('strong');
            linkText.textContent = validUrl
                ? 'مشاهده پروژه →'
                : 'جزئیات پروژه';

            info.append(title, description, linkText);
            card.append(image, info);
            projectsList.appendChild(card);
        });

    } catch (error) {
        // در صورت خطا، کارت‌های قبلی سایت حفظ می‌شوند.
        console.error('خطا در دریافت پروژه‌ها:', error);
    }
}

function startProjectsSlider() {
    if (!projectsList) return;

    setInterval(() => {
        const card = projectsList.querySelector('.project-card');

        // اگر پروژه‌ای وجود ندارد، حرکت متوقف می‌ماند.
        if (!card || projectsList.scrollWidth <= projectsList.clientWidth) {
            return;
        }

        const gap = 15;
        const cardWidth = card.offsetWidth + gap;

        projectsList.scrollBy({
            left: -cardWidth,
            behavior: 'smooth'
        });

        setTimeout(() => {
            if (
                Math.abs(projectsList.scrollLeft) >=
                projectsList.scrollWidth -
                projectsList.clientWidth -
                5
            ) {
                projectsList.scrollTo({
                    left: 0,
                    behavior: 'smooth'
                });
            }
        }, 700);

    }, 3000);
}

async function initializeProjects() {
    await loadHomeProjects();
    startProjectsSlider();
}

initializeProjects();
