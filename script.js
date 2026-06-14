/**
 * ==========================================================================
 * 1. ИНИЦИАЛИЗАЦИЯ СОСТОЯНИЯ ИГРЫ И НАСТРОЕК
 * ==========================================================================
 */
let gameState = {
    balance: 0,
    incomePerHour: 0,
    clickPower: 1,
    energy: 100,
    maxEnergy: 100,
    energyRegen: 1, 
    maxLevelCap: 10,       // Жесткий лимит уровней для всех апгрейдов
    maxEnergyCap: 1000,    // Потолок максимальной энергии игрока
    upgrades: {
        hammer: { emoji: '🔨', level: 0, baseCost: 100, costMultiplier: 1.4, income: 1, type: 'click' },
        energyMax: { emoji: '🔋', level: 0, baseCost: 200, costMultiplier: 1.5, income: 50, type: 'energy_max' },
        energyRegen: { emoji: '☕', level: 0, baseCost: 250, costMultiplier: 1.6, income: 1, type: 'energy_regen' },
        boots: { emoji: '🥾', level: 0, baseCost: 150, costMultiplier: 1.5, income: 10, type: 'passive' },
        cigarettes: { emoji: '🚬', level: 0, baseCost: 800, costMultiplier: 1.6, income: 60, type: 'passive' }
    }
};

// Состояние для управления интерфейсом и навигацией
const navUI = {
    activeIndex: 0,
    isMouseInside: false,
    movedUpAfterClick: false  
};

/**
 * ==========================================================================
 * 2. ДОМ-ЭЛЕМЕНТЫ
 * ==========================================================================
 */
const balanceEl = document.getElementById('balance');
const incomeEl = document.getElementById('income');
const heroBtn = document.getElementById('heroBtn');
const energyValEl = document.getElementById('energy-val');
const energyMaxEl = document.getElementById('energy-max');
const energyFillEl = document.getElementById('energy-fill');
const shelfEl = document.getElementById('inventory-shelf');

const bottomNav = document.getElementById('bottomNav');
const slider = document.getElementById('liquidSlider');
const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
const screens = document.querySelectorAll('.game-screen');
const shopSheet = document.getElementById('screen-shop');

/**
 * ==========================================================================
 * 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ФОРМАТИРОВАНИЕ ЧИСЕЛ)
 * ==========================================================================
 */
function formatNumbers(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return Math.floor(num).toString();
}

/**
 * ==========================================================================
 * 4. МАТЕМАТИЧЕСКАЯ ФИЗИКА ПРУЖИНЫ С ЭФФЕКТОМ ЖЕЛЕ ДЛЯ ПОЛЗУНКА МЕНЮ
 * ==========================================================================
 */
let springState = {
    currentX: 0,    
    targetX: 0,     
    velocity: 0,    
    stiffness: 0.12, 
    damping: 0.72,   
    lastX: 0,        
    rafId: null     
};

function updateSpringPhysics() {
    let force = (springState.targetX - springState.currentX) * springState.stiffness;
    springState.velocity = (springState.velocity + force) * springState.damping;
    springState.currentX += springState.velocity;

    let stretchX = 1 + Math.min(0.35, Math.abs(springState.velocity) * 0.04);
    let stretchY = 1 - Math.min(0.15, Math.abs(springState.velocity) * 0.02);

    slider.style.transform = `translateX(${springState.currentX}px) scale(${stretchX}, ${stretchY})`;

    if (Math.abs(springState.velocity) > 0.01 || Math.abs(springState.targetX - springState.currentX) > 0.01) {
        springState.rafId = requestAnimationFrame(updateSpringPhysics);
    } else {
        springState.currentX = springState.targetX;
        slider.style.transform = `translateX(${springState.currentX}px) scale(1, 1)`;
        springState.rafId = null;
    }
}

function animateToTarget(targetX) {
    springState.targetX = targetX;
    if (!springState.rafId) {
        springState.rafId = requestAnimationFrame(updateSpringPhysics);
    }
}

function lockSliderToButton(index) {
    slider.classList.remove('following'); 
    const btn = navButtons[index];
    const navRect = bottomNav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    
    const targetX = (btnRect.left - navRect.left) + (btnRect.width / 2) - (slider.offsetWidth / 2); 
    animateToTarget(targetX);
    
    navButtons.forEach((b, i) => {
        if (i === index) {
            b.classList.add('active', 'hovered');
        } else {
            b.classList.remove('active', 'hovered');
        }
    });
    navUI.activeIndex = index;
}

window.addEventListener('mousemove', (e) => {
    const navRect = bottomNav.getBoundingClientRect();
    const sliderWidth = slider.offsetWidth;
    const isInsideMenuX = e.clientX >= navRect.left && e.clientX <= navRect.right;

    if (e.clientY < navRect.top) {
        navUI.movedUpAfterClick = true; 
        if (navUI.isMouseInside) {
            navUI.isMouseInside = false;
            lockSliderToButton(navUI.activeIndex); 
        }
        return; 
    }

    if (e.clientY >= navRect.top && e.clientY <= navRect.bottom && isInsideMenuX) {
        navUI.movedUpAfterClick = false; 
        navUI.isMouseInside = true;
        slider.classList.add('following'); 

        if (springState.rafId) {
            cancelAnimationFrame(springState.rafId);
            springState.rafId = null;
        }

        const mouseX = e.clientX - navRect.left;
        let posX = mouseX - sliderWidth / 2;
        
        const minX = 6;
        const maxX = navRect.width - sliderWidth - 6;
        
        if (posX < minX) {
            let overflow = minX - posX;
            let maxElasticDistance = 25;
            posX = minX - (maxElasticDistance * Math.tanh(overflow / maxElasticDistance));
        } else if (posX > maxX) {
            let overflow = posX - maxX;
            let maxElasticDistance = 25;
            posX = maxX + (maxElasticDistance * Math.tanh(overflow / maxElasticDistance));
        }
        
        let dragVelocity = posX - springState.lastX;
        springState.lastX = posX;

        let dragStretchX = 1 + Math.min(0.3, Math.abs(dragVelocity) * 0.03);
        let dragStretchY = 1 - Math.min(0.12, Math.abs(dragVelocity) * 0.015);

        springState.currentX = posX;
        slider.style.transform = `translateX(${posX}px) scale(${dragStretchX}, ${dragStretchY})`;

        navButtons.forEach((btn, i) => {
            const rect = btn.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right) {
                btn.classList.add('hovered');
            } else {
                if (i !== navUI.activeIndex) {
                    btn.classList.remove('hovered');
                }
            }
        });
    } else {
        if (navUI.isMouseInside) {
            navUI.isMouseInside = false;
            lockSliderToButton(navUI.activeIndex);
        }
    }
});

navButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
        navUI.movedUpAfterClick = false; 
        if (btn.getAttribute('data-shop') === 'true') {
            shopSheet.classList.add('open');
        } else {
            shopSheet.classList.remove('open');
            const screenId = btn.getAttribute('data-screen');
            screens.forEach(s => s.classList.remove('active-screen'));
            document.getElementById(screenId).classList.add('active-screen');
        }
        lockSliderToButton(index);
    });
});

function handleShopClose() {
    shopSheet.classList.remove('open');
    screens.forEach((screen, index) => {
        if (screen.classList.contains('active-screen')) {
            let btnIndex = index === 0 ? 0 : index + 1;
            lockSliderToButton(btnIndex);
        }
    });
}
document.getElementById('closeShopBtn').addEventListener('click', handleShopClose);
document.getElementById('closeShopTxtBtn').addEventListener('click', handleShopClose);

window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const navRect = bottomNav.getBoundingClientRect();
    const sliderWidth = slider.offsetWidth;
    const isInsideMenuX = touch.clientX >= navRect.left && touch.clientX <= navRect.right;

    if (touch.clientY < navRect.top) {
        navUI.movedUpAfterClick = true;
        if (navUI.isMouseInside) {
            navUI.isMouseInside = false;
            lockSliderToButton(navUI.activeIndex);
        }
        return;
    }

    if (touch.clientY >= navRect.top && touch.clientY <= navRect.bottom && isInsideMenuX) {
        navUI.movedUpAfterClick = false;
        navUI.isMouseInside = true;
        slider.classList.add('following');

        if (springState.rafId) {
            cancelAnimationFrame(springState.rafId);
            springState.rafId = null;
        }

        const touchX = touch.clientX - navRect.left;
        let posX = touchX - sliderWidth / 2;
        const minX = 6;
        const maxX = navRect.width - sliderWidth - 6;

        if (posX < minX) {
            let overflow = minX - posX;
            let maxElasticDistance = 25;
            posX = minX - (maxElasticDistance * Math.tanh(overflow / maxElasticDistance));
        } else if (posX > maxX) {
            let overflow = posX - maxX;
            let maxElasticDistance = 25;
            posX = maxX + (maxElasticDistance * Math.tanh(overflow / maxElasticDistance));
        }

        let dragVelocity = posX - springState.lastX;
        springState.lastX = posX;
        let dragStretchX = 1 + Math.min(0.3, Math.abs(dragVelocity) * 0.03);
        let dragStretchY = 1 - Math.min(0.12, Math.abs(dragVelocity) * 0.015);

        springState.currentX = posX;
        slider.style.transform = `translateX(${posX}px) scale(${dragStretchX}, ${dragStretchY})`;

        navButtons.forEach((btn) => {
            const rect = btn.getBoundingClientRect();
            if (touch.clientX >= rect.left && touch.clientX <= rect.right) {
                btn.classList.add('hovered');
            } else if (!btn.classList.contains('active')) {
                btn.classList.remove('hovered');
            }
        });
    }
}, { passive: true });

bottomNav.addEventListener('touchend', () => {
    if (navUI.movedUpAfterClick) return; 
    const navRect = bottomNav.getBoundingClientRect();
    let closestIndex = 0;
    let minDistance = Infinity;
    let distances = [];

    navButtons.forEach((btn, i) => {
        const btnRect = btn.getBoundingClientRect();
        const targetX = (btnRect.left - navRect.left) + (btnRect.width / 2) - (slider.offsetWidth / 2);
        const dist = Math.abs(springState.currentX - targetX);
        distances.push({ index: i, dist: dist });
        
        if (dist < minDistance) {
            minDistance = dist;
            closestIndex = i;
        }
    });

    distances.sort((a, b) => a.dist - b.dist);
    if (distances.length > 1 && Math.abs(distances[0].dist - distances[1].dist) < 0.5) {
        closestIndex = Math.random() < 0.5 ? distances[0].index : distances[1].index;
    }
    navButtons[closestIndex].click();
});

/**
 * ==========================================================================
 * 5. ИГРОВАЯ ЛОГИКА (УПРУГИЙ ТАП ГЕРОЯ, ВЫЛЕТАЮЩИЙ ТЕКСТ, РАЗЛЕТ ИСКР)
 * ==========================================================================
 */
heroBtn.addEventListener('click', (e) => {
    if (gameState.energy >= 1) {
        gameState.balance += gameState.clickPower;
        gameState.energy -= 1;
        updateUI();
        
        // 1. Запуск сочного вылетающего текста
        createFloatingText(e);
        
        // 2. Генерация взрыва частиц искр
        createClickParticles(e);
        
        // 3. Анимация сочного сжатия и упругого отскока кнопки (Squish & Pop)
        heroBtn.style.transform = 'scale(0.90) rotate(-1deg)';
        setTimeout(() => {
            heroBtn.style.transform = 'scale(1.06) rotate(1deg)';
            setTimeout(() => {
                heroBtn.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    heroBtn.style.transform = 'scale(1)';
                }, 60);
            }, 60);
        }, 50);
    }
});

// Функция спавна летящих циферок дохода
function createFloatingText(e) {
    const text = document.createElement('div');
    text.className = 'floating-text';
    text.innerText = `+${formatNumbers(gameState.clickPower)}`;
    text.style.left = `${e.clientX - 15}px`;
    text.style.top = `${e.clientY - 20}px`;
    document.body.appendChild(text);
    setTimeout(() => text.remove(), 600);
}

// 💥 ФУНКЦИЯ СПАВНА РАЗЛЕТАЮЩИХСЯ ЧАСТИЦ (Искры/Монетки)
function createClickParticles(e) {
    const particleCount = 6; // Количество искр за один клик
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'click-particle';
        
        // Стилизуем частицу прямо в JS (маленький неоновый круг)
        particle.style.position = 'fixed';
        particle.style.left = `${e.clientX}px`;
        particle.style.top = `${e.clientY}px`;
        particle.style.width = `${Math.random() * 6 + 4}px`;
        particle.style.height = particle.style.width;
        particle.style.backgroundColor = '#ffcc00'; // Цвет золотой искры
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '1000';
        particle.style.boxShadow = '0 0 10px #ffcc00, 0 0 20px #ffaa00';
        
        document.body.appendChild(particle);
        
        // Рассчитываем случайный вектор физического взрыва во все стороны (360 градусов)
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 3; // Скорость вылета
        let velocityX = Math.cos(angle) * speed;
        let velocityY = Math.sin(angle) * speed - 2; // Небольшой импульс вверх
        
        let currentLeft = e.clientX;
        let currentTop = e.clientY;
        let opacity = 1;
        const gravity = 0.22; // Сила притяжения (тянет искры вниз)

        // Анимационный цикл движения конкретной частицы
        function animateParticle() {
            velocityY += gravity; // Применяем гравитацию
            currentLeft += velocityX;
            currentTop += velocityY;
            opacity -= 0.03; // Постепенное затухание

            particle.style.left = `${currentLeft}px`;
            particle.style.top = `${currentTop}px`;
            particle.style.opacity = opacity;

            if (opacity > 0) {
                requestAnimationFrame(animateParticle);
            } else {
                particle.remove();
            }
        }
        
        requestAnimationFrame(animateParticle);
    }
}

/**
 * ==========================================================================
 * 6. СИСТЕМА УЛУЧШЕНИЙ И ПОКУПОК (МАГАЗИН) С ЛИМИТАМИ
 * ==========================================================================
 */
function buyUpgrade(id) {
    const upgrade = gameState.upgrades[id];
    
    if (upgrade.level >= gameState.maxLevelCap) return;
    if (upgrade.type === 'energy_max' && gameState.maxEnergy >= gameState.maxEnergyCap) return;

    const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level));
    
    if (gameState.balance >= cost) {
        gameState.balance -= cost;
        upgrade.level++;
        
        if (upgrade.type === 'click') {
            gameState.clickPower += upgrade.income;
        } else if (upgrade.type === 'energy_max') {
            gameState.maxEnergy = Math.min(gameState.maxEnergyCap, gameState.maxEnergy + upgrade.income);
            gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + upgrade.income);
        } else if (upgrade.type === 'energy_regen') {
            gameState.energyRegen += upgrade.income;
        } else if (upgrade.type === 'passive') {
            gameState.incomePerHour += upgrade.income;
        }
        
        const card = document.getElementById(`card-${id}`);
        const badge = document.getElementById(`badge-${id}`);
        
        card.classList.remove('purchased-anim');
        void card.offsetWidth;
        card.classList.add('purchased-anim');
        
        badge.classList.remove('pop');
        void badge.offsetWidth;
        badge.classList.add('pop');

        updateUI();
        
        const mainBadge = document.getElementById(`main-badge-${id}`);
        if (mainBadge) {
            mainBadge.classList.remove('pop');
            void mainBadge.offsetWidth;
            mainBadge.classList.add('pop');
        }
    }
}

document.getElementById('buy-hammer').addEventListener('click', () => buyUpgrade('hammer'));
document.getElementById('buy-energyMax').addEventListener('click', () => buyUpgrade('energyMax'));
document.getElementById('buy-energyRegen').addEventListener('click', () => buyUpgrade('energyRegen'));
document.getElementById('buy-boots').addEventListener('click', () => buyUpgrade('boots'));
document.getElementById('buy-cigarettes').addEventListener('click', () => buyUpgrade('cigarettes'));

/**
 * ==========================================================================
 * 7. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА (UI-RENDER)
 * ==========================================================================
 */
function updateUI() {
    balanceEl.innerText = formatNumbers(gameState.balance);
    incomeEl.innerText = formatNumbers(gameState.incomePerHour);
    
    energyValEl.innerText = Math.floor(gameState.energy);
    energyMaxEl.innerText = gameState.maxEnergy;
    const energyPct = (gameState.energy / gameState.maxEnergy) * 100;
    energyFillEl.style.width = `${energyPct}%`;
    
    for (let id in gameState.upgrades) {
        const upgrade = gameState.upgrades[id];
        const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level));
        const btn = document.getElementById(`buy-${id}`);
        const badge = document.getElementById(`badge-${id}`);
        
        const isMaxLevel = upgrade.level >= gameState.maxLevelCap;
        const isMaxEnergyReached = (upgrade.type === 'energy_max' && gameState.maxEnergy >= gameState.maxEnergyCap);

        if (isMaxLevel || isMaxEnergyReached) {
            btn.innerText = "МАКС";
            btn.className = "buy-btn max-btn";
            btn.disabled = true;
            badge.classList.add('maxed');
        } else {
            btn.innerHTML = `Купить: <span class="card-cost">${formatNumbers(cost)}</span> $`;
            btn.disabled = gameState.balance < cost;
        }
        
        badge.innerText = upgrade.level;
        
        if (upgrade.level > 0) {
            badge.classList.add('show');
            
            if (!document.getElementById(`main-avatar-${id}`)) {
                const itemHtml = `
                    <div class="card-avatar" id="main-avatar-${id}">
                        <span class="card-emoji">${upgrade.emoji}</span>
                        <div class="level-badge show ${isMaxLevel || isMaxEnergyReached ? 'maxed' : ''}" id="main-badge-${id}">${upgrade.level}</div>
                    </div>
                `;
                shelfEl.insertAdjacentHTML('beforeend', itemHtml);
            } else {
                const mainB = document.getElementById('main-badge-' + id);
                mainB.innerText = upgrade.level;
                if (isMaxLevel || isMaxEnergyReached) mainB.classList.add('maxed');
            }
        } else {
            badge.classList.remove('show');
        }
    }
}

/**
 * ==========================================================================
 * 8. ИГРОВЫЕ ТАЙМЕРЫ (ГЕНЕРАЦИЯ ЭНЕРГИИ И ДОХОДА)
 * ==========================================================================
 */
setInterval(() => {
    if (gameState.incomePerHour > 0) {
        gameState.balance += (gameState.incomePerHour / 3600);
    }
    if (gameState.energy < gameState.maxEnergy) {
        gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + gameState.energyRegen);
    }
    updateUI();
}, 1000);

// Инициализация при загрузке документа
window.addEventListener('DOMContentLoaded', () => {
    updateUI();
    
    // Плавная инициализация упругой деформации для кнопки героя
    heroBtn.style.transition = 'transform 0.1s cubic-bezier(0.25, 1, 0.5, 1)';
    
    setTimeout(() => {
        const firstBtnRect = navButtons[0].getBoundingClientRect();
        const navRect = bottomNav.getBoundingClientRect();
        const startX = (firstBtnRect.left - navRect.left) + (firstBtnRect.width / 2) - (slider.offsetWidth / 2);
        springState.currentX = startX;
        springState.targetX = startX;
        springState.lastX = startX;
        slider.style.transform = `translateX(${startX}px) scale(1, 1)`;
        lockSliderToButton(0);
    }, 100);
});

function updateHeroImage(balance) {
    const heroImg = document.getElementById('heroImg');

    // Логика смены картинок
    if (balance >= 1000000000) {
        heroImg.src = "https://i.postimg.cc/ncR7yn6g/Chat-GPT-Image-Jun-9-2026-09-39-23-PM.png";
    } else if (balance >= 1000000) {
        heroImg.src = "https://i.postimg.cc/j50yMvB1/Chat-GPT-Image-Jun-9-2026-09-35-44-PM.png";
    } else if (balance >= 1000) {
        heroImg.src = "https://i.postimg.cc/9M7JMDHv/Chat-GPT-Image-Jun-9-2026-09-26-10-PM.png";
    }
}

// Вызывайте эту функцию каждый раз, когда меняется баланс:
// updateHeroImage(currentBalance);
