
document.addEventListener("DOMContentLoaded", loadHomepageSettings);

async function loadHomepageSettings() {
    try {
        const response = await fetch("/api/homepage", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("دریافت تنظیمات صفحه اصلی ناموفق بود.");
        }

        const data = await response.json();

        if (!data.success || !data.settings) {
            throw new Error("اطلاعات صفحه اصلی معتبر نیست.");
        }

        const settings = data.settings;

        // عنوان اصلی؛ نام را پررنگ نگه می‌داریم
        const mainTitle = document.getElementById("homepage-main-title");

        if (mainTitle) {
            const title = settings.main_title;
            const name = "حمیدرضا قلی پور";
            const index = title.indexOf(name);

            mainTitle.replaceChildren();

            if (index !== -1) {
                mainTitle.append(
                    document.createTextNode(title.slice(0, index))
                );

                const strong = document.createElement("strong");
                strong.textContent = name;
                mainTitle.append(strong);

                mainTitle.append(
                    document.createTextNode(title.slice(index + name.length))
                );
            } else {
                mainTitle.textContent = title;
            }
        }

        // عنوان شغلی؛ حفظ استایل Front-End Developer
        const jobTitle = document.getElementById("homepage-job-title");

        if (jobTitle) {
            const title = settings.job_title;
            const phrase = "Front-End Developer";
            const index = title.indexOf(phrase);

            jobTitle.replaceChildren();

            if (index !== -1) {
                jobTitle.append(
                    document.createTextNode(title.slice(0, index))
                );

                const span = document.createElement("span");
                span.textContent = phrase;
                jobTitle.append(span);

                jobTitle.append(
                    document.createTextNode(title.slice(index + phrase.length))
                );
            } else {
                jobTitle.textContent = title;
            }
        }

        // متن معرفی
        const introduction = document.getElementById(
            "homepage-introduction"
        );

        if (introduction) {
            introduction.textContent = settings.introduction;
        }

        // پیام بنر
        const heroMessage = document.getElementById(
            "homepage-hero-message"
        );

        if (heroMessage) {
            const message = settings.hero_message;

            heroMessage.textContent = message.includes("\n")
                ? message
                : message.replace(" را ", " را\n");
        }
    } catch (error) {
        // در صورت خطا، متن اولیه HTML باقی می‌ماند
        console.error("Homepage settings error:", error);
    }
}


