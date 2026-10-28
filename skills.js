const skillsList = document.querySelector(".skills-list");

let skillCards = [];
let positions = [];
let animationStarted = false;

const speed = 0.7;
const gap = 18;

async function loadSkills() {
    if (!skillsList) return;

    try {
        const response = await fetch("/api/skills", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("دریافت مهارت‌ها ناموفق بود.");
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.skills)) {
            throw new Error("ساختار اطلاعات مهارت‌ها معتبر نیست.");
        }

       let skillsTrack = skillsList.querySelector(".skills-track");

if (!skillsTrack) {
    skillsTrack = document.createElement("div");
    skillsTrack.className = "skills-track";
    skillsList.replaceChildren(skillsTrack);
} else {
    skillsTrack.replaceChildren();
}

        data.skills.forEach((skill) => {
            const card = document.createElement("a");
            card.className = "skill-card";
            card.href = "skills.html";

            const icon = document.createElement("img");
            icon.src = skill.icon_url || "";
            icon.alt = "";
            icon.loading = "lazy";

            const title = document.createElement("h3");
            title.textContent = skill.title;

            const percentage = document.createElement("p");
            percentage.textContent = `${skill.percentage}%`;

            card.append(icon, title, percentage);
			skillsTrack.appendChild(card);
        });

        skillCards = Array.from(
            skillsList.querySelectorAll(".skill-card")
        );

        setupSkills();

        if (!animationStarted) {
            animationStarted = true;
            requestAnimationFrame(animateSkills);
        }
    } catch (error) {
        console.error("خطا در بارگذاری مهارت‌ها:", error);
    }
}

function setupSkills() {
    if (!skillsList || skillCards.length === 0) {
        positions = [];
        return;
    }

    const listWidth = skillsList.offsetWidth;
    const cardWidth = skillCards[0].offsetWidth;

    positions = skillCards.map(
        (_, index) => listWidth - cardWidth - index * (cardWidth + gap)
    );

    skillCards.forEach((card, index) => {
        card.style.left = `${positions[index]}px`;
    });
}

function animateSkills() {
    if (!skillsList || skillCards.length === 0) {
        requestAnimationFrame(animateSkills);
        return;
    }

    if (window.innerWidth > 768) {
        const listWidth = skillsList.offsetWidth;
        const cardWidth = skillCards[0].offsetWidth;

        skillCards.forEach((card, index) => {
            positions[index] += speed;

            if (positions[index] > listWidth) {
                positions[index] =
                    Math.min(...positions) - cardWidth - gap;
            }

            card.style.left = `${positions[index]}px`;
        });

        const center = listWidth / 2;

        skillCards.forEach((card, index) => {
            const cardCenter = positions[index] + cardWidth / 2;
            const distance = Math.abs(center - cardCenter);

            card.classList.toggle(
                "active",
                distance < cardWidth / 2
            );
        });
    }

    requestAnimationFrame(animateSkills);
}

window.addEventListener("resize", setupSkills);

loadSkills();
