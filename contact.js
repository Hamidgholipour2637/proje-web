document.getElementById("contact-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const form = this;
    const status = document.getElementById("contact-status");
    const button = form.querySelector('button[type="submit"]');

    if (button.disabled) return;

    const formData = new FormData(form);
    const data = new URLSearchParams(formData);

    status.textContent = "Sending your message...";
    button.disabled = true;

    try {
        // مرحله اول: دریافت توکن CSRF
        const csrfResponse = await fetch("/api/csrf-token", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin"
        });

        const csrfData = await csrfResponse.json();

        if (!csrfResponse.ok || !csrfData.csrfToken) {
            throw new Error("Could not obtain CSRF token.");
        }

        // مرحله دوم: ارسال فرم همراه با توکن
        const response = await fetch("/api/contact", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-csrf-token": csrfData.csrfToken
            },
            body: data
        });

        const rawResponse = await response.text();

        console.log("HTTP status:", response.status);
        console.log("Server response:", rawResponse);

        let result;

        try {
            result = JSON.parse(rawResponse);
        } catch (error) {
            console.error("Invalid server response:", error);
            throw new Error("Server returned an invalid response.");
        }

        status.textContent =
            result.message || "No response message from server";

        if (response.ok && result.success) {
            form.reset();
        }

    } catch (error) {
        console.error("Contact form error:", error);
        status.textContent =
            "Could not send the message. Please try again.";
    } finally {
        button.disabled = false;
    }
});