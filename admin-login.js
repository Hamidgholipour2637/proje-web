const form = document.getElementById("login-form");
const status = document.getElementById("status");
const button = form.querySelector('button[type="submit"]');

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    status.textContent = "در حال بررسی...";
    button.disabled = true;

    try {
        const csrfResponse = await fetch("/api/csrf-token", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin"
        });

        const csrfData = await csrfResponse.json();

        if (!csrfResponse.ok || !csrfData.csrfToken) {
            throw new Error("دریافت توکن امنیتی ناموفق بود.");
        }

        const password = document.getElementById("password").value;

        const response = await fetch("/api/admin/login", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-csrf-token": csrfData.csrfToken
            },
            body: new URLSearchParams({ password })
        });

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error("پاسخ سرور قابل خواندن نیست.");
        }

        if (response.ok && result.success === true) {
            status.textContent = "ورود موفقیت‌آمیز بود.";
            window.location.replace("/admin-panel.html");
            return;
        }

        status.textContent =
            result.message || "ورود ناموفق بود. اطلاعات را بررسی کن.";
    } catch (error) {
        console.error("Login error:", error);
        status.textContent =
            "خطا در ارتباط با سرور یا دریافت پاسخ معتبر.";
    } finally {
        button.disabled = false;
    }
});