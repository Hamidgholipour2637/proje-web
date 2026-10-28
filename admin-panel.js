const status = document.getElementById("status");
const messages = document.getElementById("messages");

const projectsStatus = document.getElementById("projects-status");
const projectsList = document.getElementById("projects-list");
const projectForm = document.getElementById("project-form");

const projectId = document.getElementById("project-id");
const projectTitle = document.getElementById("project-title");
const projectDescription = document.getElementById("project-description");
const projectImageUrl = document.getElementById("project-image-url");
const projectUrl = document.getElementById("project-url");
const projectTechnologies = document.getElementById("project-technologies");
const projectDisplayOrder = document.getElementById("project-display-order");

const saveProjectButton = document.getElementById("save-project-button");
const cancelEditButton = document.getElementById("cancel-edit-button");

let csrfToken = null;
let projectsCache = [];

// دریافت توکن CSRF
async function getCsrfToken() {
    const response = await fetch("/api/csrf-token", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin"
    });

    const data = await response.json();

    if (!response.ok || !data.csrfToken) {
        throw new Error("دریافت توکن CSRF ناموفق بود.");
    }

    csrfToken = data.csrfToken;
    return csrfToken;
}

// ارسال درخواست تغییردهنده اطلاعات
async function secureFetch(url, options = {}) {
    const token = await getCsrfToken();

    return fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.headers || {}),
            "x-csrf-token": token
        }
    });
}

// انتقال به صفحه ورود مدیر
function redirectToLogin() {
    window.location.replace("/admin.html");
}

// بررسی پاسخ API
async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        redirectToLogin();
        throw new Error("نشست مدیر معتبر نیست.");
    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || "درخواست انجام نشد.");
    }

    return data;
}

// ساخت عنصر متنی امن
function createTextElement(tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text == null ? "" : String(text);

    if (className) {
        element.className = className;
    }

    return element;
}

// دریافت پیام‌های تماس
async function loadMessages() {
    status.textContent = "در حال دریافت پیام‌ها...";
    messages.replaceChildren();

    try {
        const response = await fetch("/api/admin/messages", {
            credentials: "same-origin",
            cache: "no-store"
        });

        const result = await readResponse(response);

        if (!Array.isArray(result.messages)) {
            throw new Error("ساختار پاسخ پیام‌ها معتبر نیست.");
        }

        const unreadCount = result.messages.filter(
            item => item.is_read !== true
        ).length;

        status.textContent =
            `تعداد کل پیام‌ها: ${result.messages.length} | ` +
            `خوانده‌نشده: ${unreadCount}`;

        if (result.messages.length === 0) {
            status.textContent = "هنوز پیامی دریافت نشده است.";
            return;
        }

        for (const item of result.messages) {
            const isRead = item.is_read === true;
            const card = document.createElement("article");

            card.className = `message ${isRead ? "read" : "unread"}`;

            card.append(
                createTextElement("h2", item.name),
                createTextElement(
                    "span",
                    isRead ? "خوانده‌شده" : "خوانده‌نشده",
                    `badge ${isRead ? "read" : "unread"}`
                ),
                createTextElement("p", `ایمیل: ${item.email}`),
                createTextElement("p", item.message),
                createTextElement(
                    "p",
                    item.created_at
                        ? new Date(item.created_at).toLocaleString("fa-IR")
                        : "",
                    "meta"
                )
            );

            const actions = document.createElement("div");
            actions.className = "actions";

            const readButton = document.createElement("button");
            readButton.type = "button";
            readButton.textContent = isRead
                ? "خوانده‌شده"
                : "علامت‌گذاری به‌عنوان خوانده‌شده";
            readButton.disabled = isRead;

            readButton.addEventListener("click", async () => {
                readButton.disabled = true;

                try {
                    const response = await secureFetch(
                        `/api/admin/messages/${item.id}/read`,
                        { method: "PATCH" }
                    );

                    await readResponse(response);
                    await loadMessages();
                } catch (error) {
                    if (error.message !== "نشست مدیر معتبر نیست.") {
                        alert(error.message);
                    }
                    readButton.disabled = false;
                }
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-button";
            deleteButton.textContent = "حذف پیام";

            deleteButton.addEventListener("click", async () => {
                if (!confirm("از حذف این پیام مطمئنی؟")) {
                    return;
                }

                deleteButton.disabled = true;

                try {
                    const response = await secureFetch(
                        `/api/admin/messages/${item.id}`,
                        { method: "DELETE" }
                    );

                    await readResponse(response);
                    await loadMessages();
                } catch (error) {
                    if (error.message !== "نشست مدیر معتبر نیست.") {
                        alert(error.message);
                    }
                    deleteButton.disabled = false;
                }
            });

            actions.append(readButton, deleteButton);
            card.appendChild(actions);
            messages.appendChild(card);
        }
    } catch (error) {
        console.error("Load messages error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            status.textContent = error.message || "دریافت پیام‌ها ناموفق بود.";
        }
    }
}

// دریافت پروژه‌ها
async function loadProjects() {
    projectsStatus.textContent = "در حال دریافت پروژه‌ها...";
    projectsList.replaceChildren();

    try {
        const response = await fetch("/api/projects", {
            credentials: "same-origin",
            cache: "no-store"
        });

        const result = await readResponse(response);

        if (!Array.isArray(result.projects)) {
            throw new Error("ساختار پاسخ پروژه‌ها معتبر نیست.");
        }

        projectsCache = result.projects;

        projectsStatus.textContent =
            `تعداد پروژه‌ها: ${projectsCache.length}`;

        if (projectsCache.length === 0) {
            projectsStatus.textContent = "هنوز پروژه‌ای ثبت نشده است.";
            return;
        }

        for (const project of projectsCache) {
            const card = document.createElement("article");
            card.className = "project-card";

            card.append(
                createTextElement("h3", project.title),
                createTextElement("p", project.description),
                createTextElement(
                    "p",
                    `فناوری‌ها: ${project.technologies || "ثبت نشده"}`
                ),
                createTextElement(
                    "p",
                    `ترتیب نمایش: ${project.display_order}`
                )
            );

            if (project.image_url) {
                const imageLink = document.createElement("a");
                imageLink.href = project.image_url;
                imageLink.target = "_blank";
                imageLink.rel = "noopener noreferrer";
                imageLink.textContent = "مشاهده تصویر پروژه";
                card.appendChild(imageLink);
            }

            if (project.project_url) {
                const projectLink = document.createElement("a");
                projectLink.href = project.project_url;
                projectLink.target = "_blank";
                projectLink.rel = "noopener noreferrer";
                projectLink.textContent = "مشاهده پروژه";
                card.appendChild(projectLink);
            }

            const actions = document.createElement("div");
            actions.className = "actions";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "ویرایش";
            editButton.addEventListener("click", () => {
                startProjectEdit(project);
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-button";
            deleteButton.textContent = "حذف";

            deleteButton.addEventListener("click", async () => {
                if (!confirm(`پروژه «${project.title}» حذف شود؟`)) {
                    return;
                }

                deleteButton.disabled = true;

                try {
                    const response = await secureFetch(
                        `/api/admin/projects/${project.id}`,
                        { method: "DELETE" }
                    );

                    const data = await readResponse(response);
                    projectsStatus.textContent =
                        data.message || "پروژه حذف شد.";

                    if (projectId.value === String(project.id)) {
                        resetProjectForm();
                    }

                    await loadProjects();
                } catch (error) {
                    if (error.message !== "نشست مدیر معتبر نیست.") {
                        alert(error.message);
                    }
                    deleteButton.disabled = false;
                }
            });

            actions.append(editButton, deleteButton);
            card.appendChild(actions);
            projectsList.appendChild(card);
        }
    } catch (error) {
        console.error("Load projects error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            projectsStatus.textContent =
                error.message || "دریافت پروژه‌ها ناموفق بود.";
        }
    }
}

// پر کردن فرم برای ویرایش
function startProjectEdit(project) {
    projectId.value = project.id;
    projectTitle.value = project.title || "";
    projectDescription.value = project.description || "";
    projectImageUrl.value = project.image_url || "";
    projectUrl.value = project.project_url || "";
    projectTechnologies.value = project.technologies || "";
    projectDisplayOrder.value = project.display_order ?? 0;

    document.getElementById("project-form-heading").textContent =
        "ویرایش پروژه";

    saveProjectButton.textContent = "ذخیره تغییرات";
    cancelEditButton.hidden = false;

    document.getElementById("projects-section").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    projectTitle.focus();
}

// بازنشانی فرم
function resetProjectForm() {
    projectForm.reset();
    projectId.value = "";
    projectDisplayOrder.value = "0";

    document.getElementById("project-form-heading").textContent =
        "افزودن پروژه جدید";

    saveProjectButton.textContent = "افزودن پروژه";
    cancelEditButton.hidden = true;
}

cancelEditButton.addEventListener("click", resetProjectForm);

// افزودن یا ویرایش پروژه
projectForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!projectForm.reportValidity()) {
        return;
    }

    const order = Number(projectDisplayOrder.value);

    if (
        !Number.isInteger(order) ||
        order < 0 ||
        order > 100000
    ) {
        alert("ترتیب نمایش باید عدد صحیحی بین صفر و ۱۰۰۰۰۰ باشد.");
        return;
    }

    const payload = {
        title: projectTitle.value.trim(),
        description: projectDescription.value.trim(),
        image_url: projectImageUrl.value.trim(),
        project_url: projectUrl.value.trim(),
        technologies: projectTechnologies.value.trim(),
        display_order: order
    };

    if (
        !payload.title ||
        payload.title.length > 200 ||
        !payload.description ||
        payload.description.length > 10000 ||
        payload.image_url.length > 500 ||
        payload.project_url.length > 500 ||
        payload.technologies.length > 2000
    ) {
        alert("یکی از فیلدها خالی یا بیش از حد مجاز است.");
        return;
    }

    const editing = projectId.value !== "";
    const endpoint = editing
        ? `/api/admin/projects/${encodeURIComponent(projectId.value)}`
        : "/api/admin/projects";

    saveProjectButton.disabled = true;
    projectsStatus.textContent = editing
        ? "در حال ذخیره تغییرات..."
        : "در حال افزودن پروژه...";

    try {
        const response = await secureFetch(endpoint, {
            method: editing ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await readResponse(response);

        projectsStatus.textContent =
            data.message || "عملیات با موفقیت انجام شد.";

        resetProjectForm();
        await loadProjects();
    } catch (error) {
        console.error("Save project error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            alert(error.message || "ذخیره پروژه انجام نشد.");
            projectsStatus.textContent =
                error.message || "ذخیره پروژه انجام نشد.";
        }
    } finally {
        saveProjectButton.disabled = false;
    }
});

// تازه‌سازی پیام‌ها و پروژه‌ها
document.getElementById("refresh-button").addEventListener(
    "click",
    loadMessages
);

document.getElementById("refresh-projects-button").addEventListener(
    "click",
    loadProjects
);

// خروج امن از پنل
document.getElementById("logout-button").addEventListener(
    "click",
    async () => {
        const logoutButton = document.getElementById("logout-button");
        logoutButton.disabled = true;

        try {
            const response = await secureFetch("/api/admin/logout", {
                method: "POST"
            });

            await readResponse(response);
            redirectToLogin();
        } catch (error) {
            console.error("Logout error:", error);

            if (error.message !== "نشست مدیر معتبر نیست.") {
                status.textContent = error.message || "خروج انجام نشد.";
            }

            logoutButton.disabled = false;
        }
    }
);

// بررسی نشست مدیر قبل از بارگذاری اطلاعات پنل
async function checkLogin() {
    try {
        const response = await fetch("/api/admin/check", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (response.status === 401) {
            redirectToLogin();
            return;
        }

        if (!response.ok) {
            status.textContent = "بررسی دسترسی انجام نشد.";
            return;
        }

      await Promise.all([
    loadMessages(),
    loadProjects(),
    loadSkills(),
    loadServices(),
    loadAbout()
]);
    } catch (error) {
        console.error("Login check error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            status.textContent = "ارتباط با سرور برقرار نشد.";
        }
    }
}


/* =========================
   مدیریت مهارت‌ها
========================= */

const skillsStatus = document.getElementById("skills-status");
const skillsList = document.getElementById("skills-list");
const skillForm = document.getElementById("skill-form");

const skillId = document.getElementById("skill-id");
const skillTitle = document.getElementById("skill-title");
const skillIconUrl = document.getElementById("skill-icon-url");
const skillPercentage = document.getElementById("skill-percentage");
const skillDisplayOrder = document.getElementById("skill-display-order");

const saveSkillButton = document.getElementById("save-skill-button");
const cancelSkillEditButton =
    document.getElementById("cancel-skill-edit-button");


// دریافت و نمایش مهارت‌ها
async function loadSkills() {
    skillsStatus.textContent = "در حال دریافت مهارت‌ها...";
    skillsList.replaceChildren();

    try {
        const response = await fetch("/api/skills", {
            credentials: "same-origin",
            cache: "no-store"
        });

        const result = await readResponse(response);

        if (!Array.isArray(result.skills)) {
            throw new Error("ساختار پاسخ مهارت‌ها معتبر نیست.");
        }

        skillsStatus.textContent =
            `تعداد مهارت‌ها: ${result.skills.length}`;

        if (result.skills.length === 0) {
            skillsStatus.textContent = "هنوز مهارتی ثبت نشده است.";
            return;
        }

        for (const skill of result.skills) {
            const card = document.createElement("article");
            card.className = "skill-admin-card";

            card.append(
                createTextElement("h3", skill.title),
                createTextElement(
                    "p",
                    `درصد مهارت: ${skill.percentage}%`
                ),
                createTextElement(
                    "p",
                    `آیکون: ${skill.icon_url || "ثبت نشده"}`
                ),
                createTextElement(
                    "p",
                    `ترتیب نمایش: ${skill.display_order}`
                )
            );

            const actions = document.createElement("div");
            actions.className = "actions";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "ویرایش";

            editButton.addEventListener("click", () => {
                skillId.value = skill.id;
                skillTitle.value = skill.title || "";
                skillIconUrl.value = skill.icon_url || "";
                skillPercentage.value = skill.percentage ?? 0;
                skillDisplayOrder.value = skill.display_order ?? 0;

                document.getElementById(
                    "skill-form-heading"
                ).textContent = "ویرایش مهارت";

                saveSkillButton.textContent = "ذخیره تغییرات";
                cancelSkillEditButton.hidden = false;

                document.getElementById("skills-section").scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                skillTitle.focus();
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-button";
            deleteButton.textContent = "حذف";

            deleteButton.addEventListener("click", async () => {
                if (!confirm(`مهارت «${skill.title}» حذف شود؟`)) {
                    return;
                }

                deleteButton.disabled = true;

                try {
                    const response = await secureFetch(
                        `/api/admin/skills/${encodeURIComponent(skill.id)}`,
                        { method: "DELETE" }
                    );

                    const data = await readResponse(response);
                    skillsStatus.textContent =
                        data.message || "مهارت حذف شد.";

                    if (skillId.value === String(skill.id)) {
                        resetSkillForm();
                    }

                    await loadSkills();
                } catch (error) {
                    if (error.message !== "نشست مدیر معتبر نیست.") {
                        alert(error.message);
                    }

                    deleteButton.disabled = false;
                }
            });

            actions.append(editButton, deleteButton);
            card.appendChild(actions);
            skillsList.appendChild(card);
        }
    } catch (error) {
        console.error("Load skills error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            skillsStatus.textContent =
                error.message || "دریافت مهارت‌ها ناموفق بود.";
        }
    }
}


// بازنشانی فرم مهارت
function resetSkillForm() {
    skillForm.reset();
    skillId.value = "";
    skillPercentage.value = "80";
    skillDisplayOrder.value = "0";

    document.getElementById(
        "skill-form-heading"
    ).textContent = "افزودن مهارت جدید";

    saveSkillButton.textContent = "افزودن مهارت";
    cancelSkillEditButton.hidden = true;
}

cancelSkillEditButton.addEventListener("click", resetSkillForm);


// افزودن یا ویرایش مهارت
skillForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!skillForm.reportValidity()) {
        return;
    }

    const percentage = Number(skillPercentage.value);
    const order = Number(skillDisplayOrder.value);

    if (
        !Number.isInteger(percentage) ||
        percentage < 0 ||
        percentage > 100 ||
        !Number.isInteger(order) ||
        order < 0 ||
        order > 100000
    ) {
        alert("درصد باید بین صفر تا ۱۰۰ و ترتیب بین صفر تا ۱۰۰۰۰۰ باشد.");
        return;
    }

    const payload = {
        title: skillTitle.value.trim(),
        icon_url: skillIconUrl.value.trim(),
        percentage,
        display_order: order
    };

    if (!payload.title || payload.title.length > 100 ||
        payload.icon_url.length > 500) {
        alert("نام مهارت یا آدرس آیکون معتبر نیست.");
        return;
    }

    const editing = skillId.value !== "";
    const endpoint = editing
        ? `/api/admin/skills/${encodeURIComponent(skillId.value)}`
        : "/api/admin/skills";

    saveSkillButton.disabled = true;
    skillsStatus.textContent = editing
        ? "در حال ذخیره تغییرات مهارت..."
        : "در حال افزودن مهارت...";

    try {
        const response = await secureFetch(endpoint, {
            method: editing ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await readResponse(response);

        skillsStatus.textContent =
            data.message || "عملیات مهارت انجام شد.";

        resetSkillForm();
        await loadSkills();
    } catch (error) {
        console.error("Save skill error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            skillsStatus.textContent =
                error.message || "ذخیره مهارت ناموفق بود.";

            alert(error.message || "ذخیره مهارت ناموفق بود.");
        }
    } finally {
        saveSkillButton.disabled = false;
    }
});

// تازه‌سازی مهارت‌ها
document.getElementById("refresh-skills-button")
    .addEventListener("click", loadSkills);


/* =========================
   مدیریت خدمات
========================= */

const servicesStatus = document.getElementById("services-status");
const servicesList = document.getElementById("services-list");
const serviceForm = document.getElementById("service-form");

const serviceId = document.getElementById("service-id");
const serviceTitle = document.getElementById("service-title");
const serviceDescription = document.getElementById("service-description");
const serviceIcon = document.getElementById("service-icon");
const serviceLink = document.getElementById("service-link");
const serviceDisplayOrder = document.getElementById("service-display-order");
const serviceActive = document.getElementById("service-active");

const saveServiceButton = document.getElementById("save-service-button");
const cancelServiceEditButton =
    document.getElementById("cancel-service-edit-button");

let servicesCache = [];

async function loadServices() {
    servicesStatus.textContent = "در حال دریافت خدمات...";
    servicesList.replaceChildren();

    try {
        const response = await fetch("/api/admin/services", {
            credentials: "same-origin",
            cache: "no-store"
        });

        const result = await readResponse(response);

        if (!Array.isArray(result.services)) {
            throw new Error("ساختار پاسخ خدمات معتبر نیست.");
        }

        servicesCache = result.services;
        servicesStatus.textContent =
            `تعداد خدمات: ${servicesCache.length}`;

        if (servicesCache.length === 0) {
            servicesStatus.textContent = "هنوز خدمتی ثبت نشده است.";
        }

        for (const service of servicesCache) {
            const card = document.createElement("article");
            card.className = "service-admin-card";

            card.append(
                createTextElement("h3", service.title),
                createTextElement("p", service.description),
                createTextElement("p", `آیکون: ${service.icon}`),
                createTextElement("p", `لینک: ${service.link}`),
                createTextElement(
                    "p",
                    `ترتیب نمایش: ${service.display_order}`
                ),
                createTextElement(
                    "p",
                    service.is_active ? "وضعیت: فعال" : "وضعیت: غیرفعال"
                )
            );

            const actions = document.createElement("div");
            actions.className = "actions";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "ویرایش";
            editButton.addEventListener("click", () => {
                serviceId.value = service.id;
                serviceTitle.value = service.title || "";
                serviceDescription.value = service.description || "";
                serviceIcon.value = service.icon || "";
                serviceLink.value = service.link || "";
                serviceDisplayOrder.value = service.display_order ?? 0;
                serviceActive.checked = service.is_active === true;

                document.getElementById("service-form-heading").textContent =
                    "ویرایش خدمت";
                saveServiceButton.textContent = "ذخیره تغییرات";
                cancelServiceEditButton.hidden = false;

                document.getElementById("services-section").scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                serviceTitle.focus();
            });

            const toggleButton = document.createElement("button");
            toggleButton.type = "button";
            toggleButton.textContent = service.is_active
                ? "غیرفعال کردن"
                : "فعال کردن";

            toggleButton.addEventListener("click", async () => {
                toggleButton.disabled = true;

                try {
                    const response = await secureFetch(
                        `/api/admin/services/${encodeURIComponent(service.id)}`,
                        {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                title: service.title,
                                description: service.description,
                                icon: service.icon,
                                link: service.link,
                                display_order: service.display_order,
                                is_active: !service.is_active
                            })
                        }
                    );

                    const data = await readResponse(response);
                    servicesStatus.textContent = data.message || "وضعیت تغییر کرد.";
                    await loadServices();
                } catch (error) {
                    if (error.message !== "نشست مدیر معتبر نیست.") {
                        alert(error.message);
                    }
                    toggleButton.disabled = false;
                }
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-button";
            deleteButton.textContent = "حذف";

            deleteButton.addEventListener("click", async () => {
                if (!confirm(`خدمت «${service.title}» حذف شود؟`)) {
                    return;
                }

                deleteButton.disabled = true;

                try {
                    const response = await secureFetch(
                        `/api/admin/services/${encodeURIComponent(service.id)}`,
                        { method: "DELETE" }
                    );

                    const data = await readResponse(response);
                    servicesStatus.textContent = data.message || "خدمت حذف شد.";

                    if (serviceId.value === String(service.id)) {
                        resetServiceForm();
                    }

                    await loadServices();
                } catch (error) {
                    if (error.message !== "نشست مدیر معتبر نیست.") {
                        alert(error.message);
                    }
                    deleteButton.disabled = false;
                }
            });

            actions.append(editButton, toggleButton, deleteButton);
            card.appendChild(actions);
            servicesList.appendChild(card);
        }
    } catch (error) {
        console.error("Load services error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            servicesStatus.textContent =
                error.message || "دریافت خدمات ناموفق بود.";
        }
    }
}

function resetServiceForm() {
    serviceForm.reset();
    serviceId.value = "";
    serviceDisplayOrder.value = "0";
    serviceActive.checked = true;

    document.getElementById("service-form-heading").textContent =
        "افزودن خدمت جدید";
    saveServiceButton.textContent = "افزودن خدمت";
    cancelServiceEditButton.hidden = true;
}

cancelServiceEditButton.addEventListener("click", resetServiceForm);

serviceForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!serviceForm.reportValidity()) return;

    const order = Number(serviceDisplayOrder.value);

    if (!Number.isInteger(order) || order < 0 || order > 100000) {
        alert("ترتیب نمایش باید عدد صحیحی بین صفر تا ۱۰۰۰۰۰ باشد.");
        return;
    }

    const payload = {
        title: serviceTitle.value.trim(),
        description: serviceDescription.value.trim(),
        icon: serviceIcon.value.trim(),
        link: serviceLink.value.trim(),
        display_order: order,
        is_active: serviceActive.checked
    };

    if (
        !payload.title || payload.title.length > 200 ||
        !payload.description || payload.description.length > 1000 ||
        !payload.icon || payload.icon.length > 500 ||
        !payload.link || payload.link.length > 500
    ) {
        alert("لطفاً اطلاعات خدمت را بررسی کن.");
        return;
    }

    const editing = serviceId.value !== "";
    const endpoint = editing
        ? `/api/admin/services/${encodeURIComponent(serviceId.value)}`
        : "/api/admin/services";

    saveServiceButton.disabled = true;
    servicesStatus.textContent = editing
        ? "در حال ذخیره تغییرات..."
        : "در حال افزودن خدمت...";

    try {
        const response = await secureFetch(endpoint, {
            method: editing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await readResponse(response);
        servicesStatus.textContent = data.message || "عملیات موفق بود.";

        resetServiceForm();
        await loadServices();
    } catch (error) {
        console.error("Save service error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            servicesStatus.textContent = error.message || "ذخیره خدمت ناموفق بود.";
            alert(error.message || "ذخیره خدمت ناموفق بود.");
        }
    } finally {
        saveServiceButton.disabled = false;
    }
});

document.getElementById("refresh-services-button")
    .addEventListener("click", loadServices);





// دریافت اطلاعات فعلی
async function loadAbout() {
    aboutStatus.textContent = "در حال دریافت اطلاعات...";

    try {
        const response = await fetch("/api/about", {
            credentials: "same-origin",
            cache: "no-store"
        });

        const result = await readResponse(response);

        if (!result.about) {
            throw new Error("اطلاعات درباره من در پاسخ سرور وجود ندارد.");
        }

        aboutTitle.value = result.about.title || "";
        aboutDescription.value = result.about.description || "";

        aboutStatus.textContent = "اطلاعات درباره من بارگذاری شد.";
    } catch (error) {
        console.error("Load about error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            aboutStatus.textContent =
                error.message || "دریافت اطلاعات ناموفق بود.";
        }
    }
}

// ذخیره تغییرات
aboutForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!aboutForm.reportValidity()) {
        return;
    }

    const payload = {
        title: aboutTitle.value.trim(),
        description: aboutDescription.value.trim()
    };

    if (
        !payload.title ||
        payload.title.length > 200 ||
        !payload.description ||
        payload.description.length > 10000
    ) {
        alert("لطفاً عنوان و توضیحات را بررسی کن.");
        return;
    }

    saveAboutButton.disabled = true;
    aboutStatus.textContent = "در حال ذخیره تغییرات...";

    try {
        const response = await secureFetch("/api/admin/about", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await readResponse(response);

        if (result.about) {
            aboutTitle.value = result.about.title || "";
            aboutDescription.value = result.about.description || "";
        }

        aboutStatus.textContent =
            result.message || "اطلاعات با موفقیت ذخیره شد.";
    } catch (error) {
        console.error("Save about error:", error);

        if (error.message !== "نشست مدیر معتبر نیست.") {
            aboutStatus.textContent =
                error.message || "ذخیره اطلاعات ناموفق بود.";

            alert(error.message || "ذخیره اطلاعات ناموفق بود.");
        }
    } finally {
        saveAboutButton.disabled = false;
    }
});

checkLogin();
