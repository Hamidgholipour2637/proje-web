"use strict";

document.addEventListener("DOMContentLoaded", loadServices);

async function loadServices() {
    const container = document.getElementById("services-list");

    if (!container) {
        console.error("عنصر services-list در صفحه پیدا نشد.");
        return;
    }

    try {
        const response = await fetch("/api/services", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin"
        });

        const data = await response.json();

        if (!response.ok || data.success !== true ||
            !Array.isArray(data.services)) {
            throw new Error(data.message || "دریافت خدمات ناموفق بود.");
        }

        container.replaceChildren();

        if (data.services.length === 0) {
            container.textContent = "در حال حاضر خدمتی ثبت نشده است.";
            return;
        }

        for (const service of data.services) {
            const card = document.createElement("a");
            card.className = "service-card";
            card.href = service.link;

            const icon = document.createElement("img");
            icon.src = service.icon;
            icon.alt = "";
            icon.setAttribute("aria-hidden", "true");

            const title = document.createElement("h3");
            title.textContent = service.title;

            const description = document.createElement("p");
            description.textContent = service.description;

            const details = document.createElement("strong");
            details.textContent = "مشاهده جزئیات →";

            card.append(icon, title, description, details);
            container.appendChild(card);
        }
    } catch (error) {
        console.error("Load services error:", error);
        container.textContent = "بارگذاری خدمات با مشکل مواجه شد.";
    }
}
